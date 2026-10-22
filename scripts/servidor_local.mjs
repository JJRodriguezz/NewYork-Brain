#!/usr/bin/env node
// Sirve public/ con los MISMOS encabezados de vercel.json (incluida la CSP), para probar localmente lo que se va a desplegar.
//   node verificacion/verificar.mjs && node scripts/publicar.mjs && node scripts/servidor_local.mjs [puerto]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(RAIZ, 'public');
const conf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/geo+json' };
const puerto = +process.argv[2] || 8766;

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const archivo = path.join(PUB, rel);
  for (const regla of conf.headers) if (new RegExp('^' + regla.source.replace('(.*)', '.*') + '$').test(rel)) for (const h of regla.headers) res.setHeader(h.key, h.value);
  if (!archivo.startsWith(PUB) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', TIPOS[path.extname(archivo)] || 'application/octet-stream');
  fs.createReadStream(archivo).pipe(res);
}).listen(puerto, () => console.log(`public/ en http://localhost:${puerto} con los encabezados de vercel.json`));
