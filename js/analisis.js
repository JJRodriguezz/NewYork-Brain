// Funciones puras: sin APIs, sin datos sintéticos y sin imputar valores ausentes.
(function (root) {
  const valido = v => typeof v === 'number' && Number.isFinite(v);
  function percentil(v, valores) {
    const a = valores.filter(valido);
    if (!valido(v) || !a.length) return null;
    if (a.length === 1) return 50;
    const menores = a.filter(x => x < v).length, iguales = a.filter(x => x === v).length;
    return (menores + (iguales - 1) / 2) / (a.length - 1) * 100;
  }
  function indice(d, pesos) {
    let suma = 0, total = 0;
    for (const [k, w] of Object.entries(pesos)) {
      if (!valido(w) || w < 0) return null;
      if (!w) continue;
      if (!valido(d['_p_' + k])) return null;
      suma += d['_p_' + k] * w; total += w;
    }
    return total ? suma / total : null;
  }
  function diferencia(a, b) {
    if (!valido(a) || !valido(b)) return { absoluta: null, porcentaje: null };
    return { absoluta: b - a, porcentaje: a === 0 ? null : (b - a) / a * 100 };
  }
  function anillo(p, r) {
    let dentro = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [x, y] = r[i], [u, v] = r[j];
      if ((y > p[1]) !== (v > p[1]) && p[0] < (u - x) * (p[1] - y) / (v - y) + x) dentro = !dentro;
    }
    return dentro;
  }
  function contiene(p, geometria) {
    const polys = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.type === 'MultiPolygon' ? geometria.coordinates : [];
    return polys.some(poly => anillo(p, poly[0]) && !poly.slice(1).some(r => anillo(p, r)));
  }
  function distancia(a, b) {
    const rad = x => x * Math.PI / 180, dlat = rad(b[1] - a[1]), dlon = rad(b[0] - a[0]);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dlon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function circulo(p, metros) {
    const lat = p[1] * Math.PI / 180, lon = p[0] * Math.PI / 180, d = metros / 6371000;
    const r = Array.from({ length: 65 }, (_, i) => {
      const t = i * 2 * Math.PI / 64;
      const y = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(t));
      const x = lon + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(y));
      return [x * 180 / Math.PI, y * 180 / Math.PI];
    });
    r[64] = r[0];
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [r] } }] };
  }

  // ---------- incertidumbre del ACS en los rankings ----------
  // Generador reproducible (mulberry32) y normal estándar (Box-Muller): la misma semilla da siempre el mismo resultado.
  function rng(semilla) { let a = semilla >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normal(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  // Simula n veces cada dimensión dentro de su margen de error (MOE al 90 % → desviación = MOE / 1,645),
  // recalcula percentiles, índice y puesto. Devuelve por distrito el puesto mediano y su intervalo del 90 %.
  function rangosConError(filas, dims, pesos, opciones = {}) {
    const n = opciones.n || 500, r = rng(opciones.semilla || 2026), id = opciones.id || 'puma';
    const activas = Object.entries(dims).filter(([k]) => valido(pesos[k]) && pesos[k] > 0);
    if (!activas.length || filas.some(f => activas.some(([, d]) => !valido(f[d.k])))) return null;
    const puestos = Object.fromEntries(filas.map(f => [f[id], []]));
    for (let s = 0; s < n; s++) {
      const sim = filas.map(f => ({ [id]: f[id] }));
      for (const [k, d] of activas) {
        const vals = filas.map(f => f[d.k] + (d.moe && valido(f[d.moe]) ? normal(r) * f[d.moe] / 1.645 : 0));
        sim.forEach((x, i) => { x['_p_' + k] = percentil(vals[i], vals); });
      }
      sim.forEach(x => { x._i = indice(x, pesos); });
      sim.sort((a, b) => b._i - a._i).forEach((x, i) => puestos[x[id]].push(i + 1));
    }
    const q = (a, p) => { const v = [...a].sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]; };
    return Object.fromEntries(Object.entries(puestos).map(([k, a]) => [k, { mediana: q(a, .5), desde: q(a, .05), hasta: q(a, .95) }]));
  }
  // Agrupa distritos que no se pueden ordenar entre sí: entra al grupo quien pudo quedar tan arriba como el último puesto probable del primero.
  function grupos(rangos) {
    const orden = Object.entries(rangos).sort((a, b) => a[1].mediana - b[1].mediana || a[1].desde - b[1].desde);
    const out = []; let g = null;
    for (const [k, r] of orden) {
      if (!g || r.desde > g.lider.hasta) { g = { lider: r, miembros: [] }; out.push(g); }
      g.miembros.push(k);
    }
    return out.map((x, i) => ({ grupo: i + 1, desde: Math.min(...x.miembros.map(m => rangos[m].desde)), hasta: Math.max(...x.miembros.map(m => rangos[m].hasta)), miembros: x.miembros }));
  }
  // Benjamini-Hochberg: controla la proporción de falsos hallazgos cuando se hacen muchas comparaciones a la vez.
  function benjaminiHochberg(ps) {
    const m = ps.length, orden = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), q = Array(m);
    let min = 1;
    for (let j = m - 1; j >= 0; j--) { min = Math.min(min, orden[j][0] * m / (j + 1)); q[orden[j][1]] = min; }
    return q;
  }
  const api = { valido, percentil, indice, diferencia, contiene, distancia, circulo, rng, normal, rangosConError, grupos, benjaminiHochberg };
  root.ANALISIS = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
