// Only the reviewed design delta can be published. Existing app links/data code stay byte-identical.
import { spawnSync } from 'node:child_process';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileHashes } from './verify-vendor.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
function git(args, env = process.env) {
  const result = spawnSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, `--git-dir=${path.join(root, '.git')}`, `--work-tree=${root}`, ...args], { cwd: root, env: { ...env, GIT_TERMINAL_PROMPT: '0' }, windowsHide: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Git operation failed: ${args[0]}`);
  return result.stdout.trim();
}
const output = path.join(root, 'build/static');
const manifest = JSON.parse(await readFile(path.join(output, 'BUILD-MANIFEST.json'), 'utf8'));
const hashes = await fileHashes(output); delete hashes['BUILD-MANIFEST.json'];
if (manifest.kind !== 'classroom-hub-static-v1' || JSON.stringify(hashes) !== JSON.stringify(manifest.files)) throw new Error('Build integrity mismatch');
if (git(['config', '--get', 'remote.origin.url']) !== 'https://Taehwan-Shin@github.com/Taehwan-Shin/classroom-hub.git') throw new Error('Wrong repository');
const publish = process.argv[2] === '--publish';
if (!publish && process.argv[2] !== '--check') throw new Error('Use --check or --publish');
if (publish) git(['fetch', 'origin', 'gh-pages']);
const parent = git(['rev-parse', publish ? 'FETCH_HEAD' : 'origin/gh-pages']);
const previous = JSON.parse(git(['show', `${parent}:BUILD-MANIFEST.json`]));
const allowed = new Set(['hub-view.mjs', 'styles.css', 'timer-view.mjs', 'assets/illustrations/timer-v1.webp', 'assets/illustrations/pdf-v1.webp', 'assets/illustrations/forest-v1.webp', 'assets/illustrations/journal-v1.webp']);
const changed = Object.keys(hashes).filter(name => hashes[name] !== previous.files[name]);
if (changed.some(name => !allowed.has(name))) throw new Error(`Unexpected deployment changes: ${changed.filter(name => !allowed.has(name)).join(', ')}`);
if (Object.keys(previous.files).some(name => !Object.hasOwn(hashes, name))) throw new Error('Unexpected deployment deletion');
if (Object.keys(hashes).some(name => /(^|\/)(data|\.env|diary[^/]*\.mjs)(\/|$)/i.test(name))) throw new Error('Private file in output');
if (!publish) { console.log(JSON.stringify({ parent, release: manifest.release, changed, files: Object.keys(hashes).length })); }
else if (!changed.length) { console.log('No design changes to publish'); }
else {
  await mkdir(path.join(root, 'tmp'), { recursive: true });
  const index = path.join(root, 'tmp', `design-pages-${randomUUID()}.index`), env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(['read-tree', parent], env);
    for (const name of [...changed, 'BUILD-MANIFEST.json']) {
      const sha = git(['hash-object', '-w', path.join(output, name)]);
      git(['update-index', '--add', '--cacheinfo', `100644,${sha},${name}`], env);
    }
    const tree = git(['write-tree'], env);
    const commit = git(['commit-tree', tree, '-p', parent, '-m', `Apply compact illustrated hub design (${manifest.release.slice(0, 12)})`]);
    // A normal fast-forward push rejects a concurrent update. Never force.
    git(['push', 'origin', `${commit}:refs/heads/gh-pages`]);
    console.log(JSON.stringify({ parent, commit, release: manifest.release, changed, url: 'https://taehwan-shin.github.io/classroom-hub/' }));
  } finally { await unlink(index).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
