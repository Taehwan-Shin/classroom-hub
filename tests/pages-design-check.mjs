import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const live = process.argv[3];
const base = live || 'http://127.0.0.1:4186/';
let server, browser, checks = 0;
try {
  if (!live) {
    server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4186' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => { throw new Error('Preview unavailable'); })]);
  }
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const page = await browser.newPage(); const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (new URL(r.url()).origin !== new URL(base).origin && !r.url().startsWith('data:')) external.push('external'); });
  const check = (condition, label) => { assert.ok(condition, label); checks++; };
  await mkdir(new URL('../qa/', import.meta.url), { recursive: true });
  for (const [width, height] of [[320, 900], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1366, 720], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await page.goto(base);
    await page.waitForSelector('.tool-card');
    for (const image of await page.locator('.card-art img').all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(n => n.decode()); }
    await page.evaluate(() => scrollTo(0, 0));
    check(await page.locator('.tool-card').count() === 5, 'five tools preserved');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow ${width}`);
    check(await page.locator('.card-action').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height >= 44)), '44px actions');
    if (width >= 1000) {
      const layout = await page.evaluate(() => ({ total: document.documentElement.scrollHeight, viewport: innerHeight }));
      check(layout.total <= layout.viewport, `no scroll ${width}x${height}: ${JSON.stringify(layout)}`);
    }
    if ([320, 1366].includes(width)) await page.screenshot({ path: fileURLToPath(new URL(`../qa/pages-design-${live ? 'live' : 'local'}-${width}.png`, import.meta.url)), fullPage: true });
  }
  check(await page.locator('[href="https://classroom-polynomial-forest.vercel.app/"].tool-card').count() === 1, 'existing game URL preserved');
  check(await page.locator('[href="https://classroom-diary-098bae6e.web.app/#/diary"].tool-card').count() === 1, 'existing diary URL preserved');
  check(await page.locator('.tool-card').evaluateAll(nodes => nodes.every(n => n.referrerPolicy === 'no-referrer')), 'no referrer preserved');
  await page.locator('.tool-card[href="#/privacy"]').click(); check(await page.locator('#privacy-file').isVisible(), 'privacy input works');
  await page.goto(`${base}#/pdf`); check(await page.locator('#pdf-file').isVisible(), 'PDF input works');
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto(`${base}#/timer`);
  await page.waitForSelector('#start');
  check(await page.locator('#start, #reset').evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth)), 'timer labels fit mobile');
  await page.locator('#start').click(); await page.locator('#pause').click();
  check(await page.locator('.timer-stage').getAttribute('data-state') === 'paused', 'timer actions work');
  check(errors.length === 0 && external.length === 0, `browser/CSP errors ${errors.length}, external requests ${external.length}`);
  console.log(JSON.stringify({ checks, mode: live ? 'live' : 'local', errors, external: external.length }));
} finally { await browser?.close(); if (server && server.exitCode === null) { server.kill('SIGINT'); await once(server, 'exit'); } }
