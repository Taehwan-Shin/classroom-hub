import { spawnSync } from 'node:child_process';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileHashes } from './verify-vendor.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const gitDir = path.join(root, '.git');
function git(args, env = process.env) {
  const result = spawnSync('git', [`--git-dir=${gitDir}`, `--work-tree=${root}`, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Git operation failed: ${args[0]}`);
  return result.stdout.trim();
}
const output = path.join(root, 'build/static');
const manifest = JSON.parse(await readFile(path.join(output, 'BUILD-MANIFEST.json'), 'utf8'));
const hashes = await fileHashes(output); delete hashes['BUILD-MANIFEST.json'];
if (manifest.kind !== 'classroom-hub-static-v1' || JSON.stringify(hashes) !== JSON.stringify(manifest.files)) throw new Error('Build integrity mismatch');
const remote = git(['config', '--get', 'remote.origin.url']);
if (remote !== 'https://Taehwan-Shin@github.com/Taehwan-Shin/classroom-hub.git') throw new Error('Wrong deployment repository');
git(['fetch', 'origin', 'gh-pages']);
const parent = git(['rev-parse', 'FETCH_HEAD']);
await mkdir(path.join(root, 'tmp'), { recursive: true });
const index = path.join(root, 'tmp', `pages-${randomUUID()}.index`);
const env = { ...process.env, GIT_INDEX_FILE: index };
try {
  git(['read-tree', parent], env);
  for (const name of ['tools.mjs', 'hub-view.mjs', 'BUILD-MANIFEST.json']) {
    const sha = git(['hash-object', '-w', path.join(output, name)]);
    git(['update-index', '--add', '--cacheinfo', `100644,${sha},${name}`], env);
  }
  const tree = git(['write-tree'], env);
  const sha = git(['commit-tree', tree, '-p', parent, '-m', `Connect Firebase diary (${manifest.release.slice(0, 12)})`]);
  git(['push', 'origin', `${sha}:refs/heads/gh-pages`]);
  console.log(JSON.stringify({ repository: 'Taehwan-Shin/classroom-hub', branch: 'gh-pages', parent, commit: sha, release: manifest.release }));
} finally { await unlink(index).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
