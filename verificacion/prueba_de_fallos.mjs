#!/usr/bin/env node
// Una verificación que nunca falla no está verificando. Esta prueba copia el lago, lo rompe a propósito
// y exige que verificar.mjs atrape cada daño. También exige que la copia sana pase.
//   node verificacion/prueba_de_fallos.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LAGO = path.join(AQUI, '..', 'lago');
const VERIF = path.join(AQUI, 'verificar.mjs');
const leer = (d, n) => JSON.parse(fs.readFileSync(path.join(d, n), 'utf8'));
const escribir = (d, n, x) => fs.writeFileSync(path.join(d, n), JSON.stringify(x));

function copia() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lago-roto-'));
  fs.cpSync(LAGO, d, { recursive: true });
  return d;
}
function correr(d, extra = []) {
  const r = spawnSync(process.execPath, [VERIF, '--lago', d, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

const DANOS = [
  ['una cifra sin fuente', d => { const x = leer(d, 'seguridad_vial.json'); delete x.cifras.fallecidos_2025.fuente; escribir(d, 'seguridad_vial.json', x); }, /cifra fallecidos_2025: fuente conocida/],
  ['una nota con un correo y un teléfono ficticios', d => { const x = leer(d, 'calidad_de_vida_311.json'); x.notas.push('dudas: escribir a nombre@ejemplo.com o al (212) 555-0100'); escribir(d, 'calidad_de_vida_311.json', x); }, /ningún texto con correo, teléfono/],
  ['un campo con el apellido del propietario', d => { const x = leer(d, 'vivienda.json'); x.listas.obra_nueva.filas[0].owner_last_name = 'X'; x.listas.obra_nueva.columnas.owner_last_name = { descripcion: 'x', unidad: 'x', tipo_dato: 'Texto', tipo: 'medido', fuente: 'F05', vigencia: '2025' }; escribir(d, 'vivienda.json', x); }, /ningún campo con nombre de dato personal/],
  ['un porcentaje de 140 %', d => { const x = leer(d, 'demografia.json'); x.listas.distritos.filas[3].pct_pobreza = 140; escribir(d, 'demografia.json', x); }, /pct_pobreza: porcentaje entre 0 y 100/],
  ['un distrito que desaparece', d => { const x = leer(d, 'distritos.json'); x.listas.distritos.filas.pop(); escribir(d, 'distritos.json', x); }, /el atlas tiene los 55 distritos/],
  ['una fecha de prueba con hora', d => { const x = leer(d, 'movilidad.json'); x.probado = '2026-10-20T14:03:11'; escribir(d, 'movilidad.json', x); }, /probado es un día/],
  ['un campo que no está en el diccionario', d => { const x = leer(d, 'ambiente.json'); x.listas.arboles.filas[0].especie_rara = 3; escribir(d, 'ambiente.json', x); }, /todo campo está en el diccionario/],
  ['un conteo de 3 personas en un distrito', d => { const x = leer(d, 'seguridad_vial.json'); x.listas.distritos.filas[0].peatones_heridos = 3; escribir(d, 'seguridad_vial.json', x); }, /ningún conteo de personas entre 1 y 9/],
  ['una fuente del catálogo sin prueba', d => { const x = leer(d, 'catalogo.json'); x.fuentes[0].probado = null; escribir(d, 'catalogo.json', x); }, /toda fuente del catálogo tiene fecha real de prueba/],
  ['los boroughs que ya no suman la ciudad', d => { const x = leer(d, 'demografia.json'); x.listas.boroughs.filas[0].poblacion_2020 += 1000; escribir(d, 'demografia.json', x); }, /los 5 boroughs suman la población/],
  ['un paquete lago.js viejo', d => { const x = leer(d, 'economia_rodajes.json'); x.cifras.permisos_2025.valor += 1; escribir(d, 'economia_rodajes.json', x); }, /el paquete es idéntico/],
];

let malos = 0;
const sana = copia();
const r0 = correr(sana);
console.log(`${r0.code === 0 ? 'OK  ' : 'MAL '} la copia sana pasa (código ${r0.code})`);
if (r0.code !== 0) { malos++; console.log(r0.out); }
for (const [nombre, romper, espera] of DANOS) {
  const d = copia(); romper(d);
  const r = correr(d);
  const ok = r.code === 1 && espera.test(r.out);
  if (!ok) malos++;
  const linea = r.out.split('\n').find(l => l.startsWith('FAIL') && espera.test(l)) || '(no apareció el FAIL esperado)';
  console.log(`${ok ? 'OK  ' : 'MAL '} ${nombre}\n       ${linea}`);
  fs.rmSync(d, { recursive: true, force: true });
}
fs.rmSync(sana, { recursive: true, force: true });
console.log(`\n${DANOS.length - malos + (r0.code === 0 ? 1 : 0)} de ${DANOS.length + 1} casos se comportan como deben`);
process.exit(malos ? 1 : 0);
