import { spawnSync } from 'node:child_process';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileHashes } from './verify-vendor.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
function git(args, env = process.env, input) {
  const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, `--git-dir=${path.join(root, '.git')}`, `--work-tree=${root}`, ...args], { cwd: root, env, input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Git operation failed: ${args[0]}`);
  return result.stdout.trim();
}
const output = path.join(root, 'build/static'), manifest = JSON.parse(await readFile(path.join(output, 'BUILD-MANIFEST.json'), 'utf8'));
const hashes = await fileHashes(output); delete hashes['BUILD-MANIFEST.json'];
if (manifest.kind !== 'classroom-hub-static-v1' || JSON.stringify(hashes) !== JSON.stringify(manifest.files)) throw new Error('Build integrity mismatch');
if (git(['config', '--get', 'remote.origin.url']) !== 'https://Taehwan-Shin@github.com/Taehwan-Shin/classroom-hub.git') throw new Error('Wrong repository');
git(['fetch', 'origin', 'gh-pages']);
const parent = git(['rev-parse', 'FETCH_HEAD']);
const previous = JSON.parse(git(['show', `${parent}:BUILD-MANIFEST.json`]));
const allowed = new Set(['app.mjs', 'hub-view.mjs', 'index.html', 'local-ocr.mjs', 'tools.mjs', 'privacy.css', 'privacy-view.mjs', 'privacy-pdf.mjs', 'privacy-pdf-export.mjs', 'privacy-detect.mjs', 'privacy-zip.mjs', 'privacy-excel-worker.mjs', 'vendor/sheetjs/xlsx.mjs', 'vendor/sheetjs/LICENSE']);
for (const [name, hash] of Object.entries(hashes)) if (hash !== previous.files[name] && !allowed.has(name)) throw new Error('Unexpected deployment change');
if (Object.keys(previous.files).some(name => !Object.hasOwn(hashes, name))) throw new Error('Unexpected deployment deletion');
const parseTools = source => JSON.parse(source.match(/export const tools = Object.freeze\(([\s\S]*?)\.map\(Object.freeze\)\);/)[1]);
const previousTools = parseTools(git(['show', `${parent}:tools.mjs`]));
const nextTools = parseTools(await readFile(path.join(output, 'tools.mjs'), 'utf8'));
if (JSON.stringify(previousTools.filter(t => t.id !== 'privacy-redactor')) !== JSON.stringify(nextTools.filter(t => t.id !== 'privacy-redactor'))) throw new Error('Existing hub links changed');
await mkdir(path.join(root, 'tmp'), { recursive: true });
const index = path.join(root, 'tmp', `privacy-pages-${randomUUID()}.index`), env = { ...process.env, GIT_INDEX_FILE: index };
try {
  git(['read-tree', parent], env);
  for (const name of [...Object.keys(hashes), 'BUILD-MANIFEST.json']) {
    const sha = git(['hash-object', '-w', path.join(output, name)]);
    git(['update-index', '--add', '--cacheinfo', `100644,${sha},${name}`], env);
  }
  const tree = git(['write-tree'], env), commit = git(['commit-tree', tree, '-p', parent, '-m', `Add local-only document privacy tool (${manifest.release.slice(0, 12)})`]);
  git(['push', 'origin', `${commit}:refs/heads/gh-pages`]);
  console.log(JSON.stringify({ branch: 'gh-pages', parent, commit, release: manifest.release, url: 'https://taehwan-shin.github.io/classroom-hub/#/privacy' }));
} finally { await unlink(index).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
