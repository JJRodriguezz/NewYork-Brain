#!/usr/bin/env node
// Verificación antes de publicar: con un solo FAIL no se publica (lo corre la ingesta, GitHub Actions y el build de Vercel).
// Sin dependencias: solo Node. Uso:
//   node verificacion/verificar.mjs                 verifica lago/ y que lago/lago.js coincida con él
//   node verificacion/verificar.mjs --sin-paquete   no revisa lago/lago.js (lo usa la ingesta antes de empaquetar)
//   node verificacion/verificar.mjs --lago <dir>    verifica otra carpeta (lo usan las pruebas de fallos)
//   node verificacion/verificar.mjs --detalle       imprime también cada PASS
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = k => args.includes(k);
const LAGO = path.resolve(args.includes('--lago') ? args[args.indexOf('--lago') + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lago'));
const HOY = new Date().toISOString().slice(0, 10);
const TIPOS = new Set(['medido', 'derivado', 'transcrito', 'declarado', 'proxy']);
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const K_MIN = 10;   // conteo mínimo de personas que se publica por distrito (ver README: «Público no es inocuo»)
// Campos con nombre de dato personal, y textos con correo, teléfono de EE. UU. o número de seguro social
const CAMPO_PERSONAL = /(^|_)(owner|applicant|first_name|last_name|nombre_persona|apellido|phone|telefono|celular|email|correo|ssn|vic_|susp_|address|direccion|incident_address|latitude|longitude|lat|lon)(_|$)/i;
const PII = /[\w.+-]+@[\w-]+\.[a-z]{2,}|\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/i;

let fallos = 0, pases = 0, avisos = 0;
const porArchivo = {};
function check(archivo, nombre, ok, detalle = '') {
  porArchivo[archivo] = porArchivo[archivo] || { pass: 0, fail: 0 };
  if (ok) { pases++; porArchivo[archivo].pass++; if (opt('--detalle')) console.log(`PASS ${archivo}: ${nombre}`); return true; }
  fallos++; porArchivo[archivo].fail++;
  console.log(`FAIL ${archivo}: ${nombre}${detalle !== '' ? ' <- ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 220) : ''}`);
  return false;
}
function aviso(archivo, texto) { avisos++; console.log(`AVISO ${archivo}: ${texto}`); }
const ids = f => (Array.isArray(f) ? f : [f]).filter(Boolean);
function recorre(x, clave, fn) {
  if (Array.isArray(x)) x.forEach(v => recorre(v, clave, fn));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) recorre(v, k, fn);
  else fn(clave, x);
}

// ------------------------------------------------------------------ carga
const leer = r => JSON.parse(fs.readFileSync(r, 'utf8'));
const archivos = fs.readdirSync(LAGO).filter(n => n.endsWith('.json')).sort();
const geos = fs.existsSync(path.join(LAGO, 'geo')) ? fs.readdirSync(path.join(LAGO, 'geo')).filter(n => n.endsWith('.geojson')).sort() : [];
const L = {}; for (const n of archivos) L[n.replace(/\.json$/, '')] = leer(path.join(LAGO, n));
const G = {}; for (const n of geos) G[n.replace(/\.geojson$/, '')] = leer(path.join(LAGO, 'geo', n));

const catalogo = L.catalogo;
check('catalogo.json', 'existe el catálogo', !!catalogo);
const CAT = Object.fromEntries((catalogo?.fuentes || []).map(f => [f.id, f]));
const conocida = id => !!CAT[id];

// ------------------------------------------------------------------ contrato
function contrato(nombre, d, esGeo = false) {
  check(nombre, 'tema es texto', typeof d.tema === 'string' && d.tema.length > 0, d.tema);
  check(nombre, 'probado es un día (sin hora)', DIA.test(String(d.probado)), d.probado);
  check(nombre, 'probado no está en el futuro', String(d.probado) <= HOY, d.probado);
  const dias = (Date.parse(HOY) - Date.parse(d.probado)) / 864e5;
  if (dias > 30) aviso(nombre, `la última prueba tiene ${Math.round(dias)} días`);
  const fs_ = d.fuentes || [];
  check(nombre, 'declara al menos una fuente', fs_.length > 0);
  for (const f of fs_) {
    check(nombre, `fuente ${f.id}: id con forma F##`, /^F\d{2}$/.test(f.id), f.id);
    check(nombre, `fuente ${f.id}: con url, licencia y vigencia`, !!(f.url && f.licencia && f.vigencia), f);
    check(nombre, `fuente ${f.id}: con día de prueba`, DIA.test(String(f.probado)), f.probado);
    check(nombre, `fuente ${f.id}: está en el catálogo`, conocida(f.id), f.id);
  }
  const fuenteOk = (ref, donde) => {
    const lista = ids(ref).filter(x => x !== 'cada fila');
    return check(nombre, `${donde}: fuente conocida`, lista.length > 0 && lista.every(conocida) || ref === 'cada fila', ref);
  };
  if (esGeo) return fuenteOk;
  for (const [k, c] of Object.entries(d.cifras || {})) {
    check(nombre, `cifra ${k}: con valor, unidad y vigencia`, c.valor !== null && c.valor !== undefined && c.valor !== '' && !!c.unidad && !!c.vigencia, c);
    check(nombre, `cifra ${k}: tipo válido`, TIPOS.has(c.tipo), c.tipo);
    fuenteOk(c.fuente, `cifra ${k}`);
    if (c.moe !== undefined) check(nombre, `cifra ${k}: margen de error ≥ 0`, typeof c.moe === 'number' && c.moe >= 0, c.moe);
  }
  for (const [k, s] of Object.entries(d.series || {})) {
    check(nombre, `serie ${k}: con unidad, vigencia y puntos`, !!s.unidad && !!s.vigencia && Array.isArray(s.puntos) && s.puntos.length > 0, { unidad: s.unidad, n: s.puntos?.length });
    check(nombre, `serie ${k}: tipo válido`, TIPOS.has(s.tipo), s.tipo);
    check(nombre, `serie ${k}: puntos [x, número]`, (s.puntos || []).every(p => Array.isArray(p) && p.length === 2 && typeof p[1] === 'number' && Number.isFinite(p[1])), s.puntos?.find(p => typeof p[1] !== 'number'));
    fuenteOk(s.fuente, `serie ${k}`);
  }
  for (const [k, l] of Object.entries(d.listas || {})) {
    const cols = l.columnas || {};
    check(nombre, `lista ${k}: tiene filas y columnas`, Array.isArray(l.filas) && Object.keys(cols).length > 0);
    const sobran = [...new Set(l.filas.flatMap(f => Object.keys(f)))].filter(c => !cols[c]);
    check(nombre, `lista ${k}: todo campo está en el diccionario (columnas)`, !sobran.length, sobran);
    for (const [c, def] of Object.entries(cols)) {
      check(nombre, `lista ${k}.${c}: con descripción, unidad, tipo y vigencia`, !!(def.descripcion && def.unidad && def.tipo_dato && def.vigencia) && TIPOS.has(def.tipo), def);
      fuenteOk(def.fuente, `lista ${k}.${c}`);
      if (def.moe) check(nombre, `lista ${k}.${c}: su margen de error existe`, !!cols[def.moe], def.moe);
      if (/_moe$/.test(c)) check(nombre, `lista ${k}.${c}: márgenes de error ≥ 0`, l.filas.every(f => f[c] == null || f[c] >= 0), l.filas.filter(f => f[c] < 0).map(f => `${f.puma || f.borough}=${f[c]}`));
      if (def.unidad === '%' && !/variacion|cambio/.test(c)) check(nombre, `lista ${k}.${c}: porcentaje entre 0 y 100`, l.filas.every(f => f[c] == null || (f[c] >= 0 && f[c] <= 100)), l.filas.filter(f => f[c] < 0 || f[c] > 100).map(f => `${f.puma || f.borough || f.lugar}=${f[c]}`));
    }
  }
  return fuenteOk;
}

// ------------------------------------------------------------------ datos personales
function personas(nombre, d) {
  const claves = new Set(), textos = [];
  recorre(d, '', (k, v) => { claves.add(k); if (typeof v === 'string') textos.push([k, v]); });
  for (const [k, l] of Object.entries(d.listas || {})) for (const c of Object.keys(l.columnas || {})) claves.add(c);
  const sospechosos = [...claves].filter(k => CAMPO_PERSONAL.test(k));
  check(nombre, 'ningún campo con nombre de dato personal', !sospechosos.length, sospechosos);
  const hallado = textos.find(([k, v]) => !/^(url|consulta)$/.test(k) && PII.test(v));
  check(nombre, 'ningún texto con correo, teléfono o número de seguro social', !hallado, hallado);
}

// ------------------------------------------------------------------ recorrido
for (const n of archivos) {
  const d = L[n.replace(/\.json$/, '')];
  contrato(n, d);
  personas(n, d);
}
for (const n of geos) {
  const g = G[n.replace(/\.geojson$/, '')], nom = 'geo/' + n;
  const fuenteOk = contrato(nom, g, true);
  const cols = g.columnas || {};
  for (const [c, def] of Object.entries(cols)) { check(nom, `columna ${c}: descrita`, !!(def.descripcion && def.unidad && TIPOS.has(def.tipo)), def); fuenteOk(def.fuente || g.fuentes?.[0]?.id, `columna ${c}`); }
  const props = [...new Set(g.features.flatMap(f => Object.keys(f.properties || {})))];
  check(nom, 'toda propiedad está en el diccionario (columnas)', props.every(p => cols[p]), props.filter(p => !cols[p]));
  check(nom, 'ninguna propiedad con nombre de dato personal', !props.some(p => CAMPO_PERSONAL.test(p)), props.filter(p => CAMPO_PERSONAL.test(p)));
  let fuera = null;
  for (const f of g.features) {
    const pts = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.?\d*,-?\d+\.?\d*/g) || [];
    for (const p of pts) { const [x, y] = p.split(',').map(Number); if (!(x > -74.3 && x < -73.6 && y > 40.4 && y < 41.0)) { fuera = p; break; } }
    if (fuera) break;
  }
  check(nom, 'coordenadas WGS84 dentro de Nueva York', !fuera, fuera);
}

// ------------------------------------------------------------------ dominio (Nueva York)
const lista = (t, l) => L[t]?.listas?.[l]?.filas || [];
const suma = (fs_, k) => fs_.reduce((a, f) => a + (f[k] || 0), 0);
const BORO = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
if (L.demografia) {
  const b = lista('demografia', 'boroughs'), d = lista('demografia', 'distritos');
  const pob = L.demografia.cifras.poblacion_2020?.valor;
  check('demografia.json', 'población 2020 en un rango sensato (8,0–9,5 M)', pob > 8e6 && pob < 9.5e6, pob);
  check('demografia.json', 'los 5 boroughs suman la población de la ciudad', suma(b, 'poblacion_2020') === pob, [suma(b, 'poblacion_2020'), pob]);
  check('demografia.json', 'son exactamente los 5 boroughs', b.length === 5 && BORO.every(x => b.some(f => f.borough === x)), b.map(f => f.borough));
  check('demografia.json', 'son 55 distritos (PUMA) sin repetir', d.length === 55 && new Set(d.map(f => f.puma)).size === 55, d.length);
  const pa = suma(b, 'poblacion_acs'), pd = suma(d, 'poblacion_acs');
  check('demografia.json', 'los 55 distritos suman la población ACS de los boroughs (±1 %)', Math.abs(pa - pd) / pa < 0.01, [pa, pd]);
  check('demografia.json', 'ingreso mediano entre US$10 mil y US$300 mil', d.every(f => f.ingreso_mediano > 1e4 && f.ingreso_mediano < 3e5), d.find(f => !(f.ingreso_mediano > 1e4 && f.ingreso_mediano < 3e5)));
}
if (L.distritos) {
  const d = lista('distritos', 'distritos'), pumas = new Set((G.distritos_puma?.features || []).map(f => f.properties.puma));
  check('distritos.json', 'el atlas tiene los 55 distritos del mapa', d.length === 55 && d.every(f => pumas.has(f.puma)), d.filter(f => !pumas.has(f.puma)).map(f => f.puma));
  check('distritos.json', 'PM2,5 entre 2 y 20 µg/m³', d.every(f => f.pm25 == null || (f.pm25 > 2 && f.pm25 < 20)), d.find(f => f.pm25 <= 2 || f.pm25 >= 20));
  check('distritos.json', 'ninguna tasa negativa', d.every(f => Object.entries(f).every(([k, v]) => !/_por_/.test(k) || v == null || v >= 0)), d.find(f => Object.entries(f).some(([k, v]) => /_por_/.test(k) && v < 0)));
}
if (L.seguridad_vial) {
  const b = lista('seguridad_vial', 'boroughs'), d = lista('seguridad_vial', 'distritos'), c = L.seguridad_vial.cifras;
  check('seguridad_vial.json', 'los boroughs suman el total de choques', suma(b, 'colisiones') === c.colisiones_2025?.valor, [suma(b, 'colisiones'), c.colisiones_2025?.valor]);
  check('seguridad_vial.json', 'los distritos no suman más choques que la ciudad', suma(d, 'colisiones') <= c.colisiones_2025?.valor);
  check('seguridad_vial.json', 'fallecidos por tipo de víctima ≤ fallecidos', b.every(f => f.peatones_fallecidos + f.ciclistas_fallecidos + f.ocupantes_fallecidos <= f.fallecidos + 5));
}
if (L.calidad_de_vida_311) {
  const b = lista('calidad_de_vida_311', 'boroughs'), d = lista('calidad_de_vida_311', 'distritos'), t = L.calidad_de_vida_311.cifras.solicitudes_2025?.valor;
  check('calidad_de_vida_311.json', 'los boroughs suman el total 311', suma(b, 'solicitudes') === t, [suma(b, 'solicitudes'), t]);
  check('calidad_de_vida_311.json', 'los distritos no suman más que la ciudad', suma(d, 'solicitudes') <= t);
  check('calidad_de_vida_311.json', 'entre 1 y 10 millones de solicitudes al año', t > 1e6 && t < 1e7, t);
}
if (L.seguridad_delitos) {
  const b = lista('seguridad_delitos', 'boroughs'), t = L.seguridad_delitos.cifras.denuncias_2025?.valor;
  check('seguridad_delitos.json', 'los boroughs suman el total de denuncias', suma(b, 'denuncias') === t, [suma(b, 'denuncias'), t]);
  check('seguridad_delitos.json', 'graves ≤ denuncias en cada borough', b.every(f => f.graves <= f.denuncias));
}
if (L.vivienda) {
  const c = L.vivienda.cifras;
  check('vivienda.json', 'el filtro -I1 reduce las viviendas (no se cuentan trámites repetidos)', c.viviendas_propuestas_2025?.valor < c.viviendas_sin_depurar_2025?.valor, [c.viviendas_propuestas_2025?.valor, c.viviendas_sin_depurar_2025?.valor]);
}
if (L.movilidad) {
  const s = L.movilidad.series.subte?.puntos || [];
  check('movilidad.json', 'subte entre 0,3 y 8 millones de viajes diarios', s.every(p => p[1] > 3e5 && p[1] < 8e6), s.find(p => !(p[1] > 3e5 && p[1] < 8e6)));
  check('movilidad.json', 'no se publica el mes en curso (llega incompleto)', !s.some(p => p[0] === HOY.slice(0, 7)));
}
if (L.declarados) {
  check('declarados.json', 'toda cifra de un comunicado está marcada como declarada', Object.values(L.declarados.cifras).every(c => c.tipo === 'declarado'));
}
if (catalogo) {
  const sin = catalogo.fuentes.filter(f => !DIA.test(String(f.probado))).map(f => f.id);
  check('catalogo.json', 'toda fuente del catálogo tiene fecha real de prueba', !sin.length, sin);
  const usadas = new Set(); for (const d of [...Object.values(L), ...Object.values(G)]) recorre(d, '', (k, v) => { if (k === 'fuente' && typeof v === 'string' && /^F\d{2}$/.test(v)) usadas.add(v); });
  check('catalogo.json', 'toda fuente citada en el lago existe en el catálogo', [...usadas].every(conocida), [...usadas].filter(x => !conocida(x)));
}
// conteo mínimo de personas por distrito
for (const [t, d] of Object.entries(L)) {
  const l = d.listas?.distritos; if (!l) continue;
  for (const [c, def] of Object.entries(l.columnas)) {
    if (def.unidad !== 'personas' || def.tipo !== 'medido') continue;
    const chicos = l.filas.filter(f => f[c] > 0 && f[c] < K_MIN);
    check(`${t}.json`, `distritos.${c}: ningún conteo de personas entre 1 y ${K_MIN - 1}`, !chicos.length, chicos.map(f => `${f.puma}=${f[c]}`));
  }
}

// ------------------------------------------------------------------ paquete
if (!opt('--sin-paquete')) {
  const ruta = path.join(LAGO, 'lago.js');
  if (check('lago.js', 'existe el paquete', fs.existsSync(ruta))) {
    const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(ruta, 'utf8'), ctx);
    const P = ctx.window.LAGO_PAQUETE || {};
    const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const distintos = [...Object.keys(L).filter(k => !iguales(P.datos?.[k], L[k])), ...Object.keys(G).filter(k => !iguales(P.geo?.[k], G[k])).map(k => 'geo/' + k)];
    check('lago.js', 'el paquete es idéntico a los archivos del lago', !distintos.length, distintos);
  }
}

for (const [a, r] of Object.entries(porArchivo)) if (!opt('--detalle') && !r.fail) console.log(`PASS ${a}: ${r.pass} comprobaciones`);
console.log(`\n${pases} PASS · ${fallos} FAIL · ${avisos} avisos`);
process.exit(fallos ? 1 : 0);
