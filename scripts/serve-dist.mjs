#!/usr/bin/env node
/**
 * Sirve dist/camisetas360-frontend/browser como lo hace nginx.conf, para medir rendimiento del
 * build de producción en Playwright sin Docker: gzip para texto, caché larga para assets con
 * hash, index.html sin caché, /health y fallback SPA. Sin dependencias.
 *
 * Uso: node scripts/serve-dist.mjs [puerto=4300]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
  'dist/camisetas360-frontend/browser',
);
const port = Number(process.argv[2] ?? 4300);

if (!existsSync(join(root, 'index.html'))) {
  console.error(`[serve-dist] No existe ${root}/index.html: ejecuta pnpm run build`);
  process.exit(1);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRIMIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('OK\n');
    return;
  }
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(400).end();
    return;
  }
  const esArchivo = existsSync(file) && statSync(file).isFile();
  const ext = extname(file);
  if (!esArchivo) {
    // Assets inexistentes -> 404 (como try_files $uri =404); rutas de la SPA -> index.html.
    if (ext && ext !== '.html') {
      res.writeHead(404).end();
      return;
    }
    file = join(root, 'index.html');
  }
  const tipo = TIPOS[extname(file)] ?? 'application/octet-stream';
  const headers = {
    'Content-Type': tipo,
    'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    Vary: 'Accept-Encoding',
  };
  const gzip =
    COMPRIMIBLE.has(extname(file)) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (gzip) headers['Content-Encoding'] = 'gzip';
  res.writeHead(200, headers);
  const stream = createReadStream(file);
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
}).listen(port, () => console.log(`[serve-dist] http://localhost:${port}`));
