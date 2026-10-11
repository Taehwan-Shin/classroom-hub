import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from './security-policy.mjs';

if (process.env.PREVIEW_STATIC && process.env.PREVIEW_STATIC !== '1') throw new Error('Invalid preview mode');
const staticPreview = process.env.PREVIEW_STATIC === '1';
const root = await realpath(fileURLToPath(new URL(staticPreview ? '../build/static/' : '../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  const ocrWorker = request.url?.split('?')[0] === '/ocr-worker.js';
  for (const [name, value] of Object.entries(securityHeaders({ ocr: ocrWorker }))) response.setHeader(name, value);
  if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403); response.end('Forbidden'); return; }
  if (request.url?.split('?')[0].startsWith('/api/')) { response.writeHead(404); response.end('Not found'); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end('Method not allowed'); return; }
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    const target = await realpath(path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`));
    const relative = path.relative(root, target);
    const type = types[path.extname(target)];
    if (relative.startsWith('..') || path.isAbsolute(relative) || !type) throw new Error('Not allowed');
    const data = await readFile(target);
    response.writeHead(200, { 'Content-Type': type });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); }
});
server.on('error', () => { process.stderr.write('Local preview could not start. Choose another PORT if it is in use.\n'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => process.stdout.write(`Local: http://127.0.0.1:${port}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
