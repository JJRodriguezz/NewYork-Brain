#!/usr/bin/env node
// Arma public/, lo único que se despliega. Lista blanca: si un archivo no está aquí, no se publica
// (scripts, pruebas, exploración, entregables y bitácoras quedan fuera aunque estén en el repositorio).
// Lo corre el build de Vercel DESPUÉS de verificacion/verificar.mjs: si la verificación falla, no se llega aquí.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'public');
const LISTA = ['index.html', 'NewYork.html', 'css', 'js', 'lago/lago.js', 'lago/geo', ...fs.readdirSync(path.join(RAIZ, 'lago')).filter(n => n.endsWith('.json')).map(n => 'lago/' + n)];

fs.rmSync(DESTINO, { recursive: true, force: true });
let n = 0, bytes = 0;
for (const rel of LISTA) {
  const origen = path.join(RAIZ, rel);
  if (!fs.existsSync(origen)) { console.error(`✗ falta ${rel}`); process.exit(1); }
  fs.cpSync(origen, path.join(DESTINO, rel), { recursive: true });
}
(function contar(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) contar(p); else { n++; bytes += fs.statSync(p).size; } } })(DESTINO);
console.log(`✓ public/: ${n} archivos, ${(bytes / 1024).toFixed(0)} KB (lista blanca: ${LISTA.length} entradas)`);
