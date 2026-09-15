// Atlas por unidad vecinal — índice compuesto con pesos ajustables (práctica del Atlas de Cerebro Antioquia / Tensor).
// Cada métrica se normaliza min-max 0-100 entre las 37 UV (inversa cuando «menos es mejor»); cada dimensión es el
// promedio de sus métricas; el índice es el promedio ponderado por los pesos. Sin población: todo por superficie.
(function () {
  const A = { pesos: { movilidad: 1, servicios: 1, verde: 1, edificacion: 1 }, datos: null, resultado: null, metrica: 'indice' };
  function norm(vals, inv) { const v = vals.filter(x => x != null && isFinite(x)); const mn = Math.min(...v), mx = Math.max(...v); return x => x == null || !isFinite(x) || mx === mn ? null : Math.round((inv ? (mx - x) / (mx - mn) : (x - mn) / (mx - mn)) * 100); }
  function calcular(lago, pesos) {
    const j = lago.atlas_distritos || lago.atlas_uv; if (!j || !j.listas || !j.listas.uv) return null; A.datos = j; if (pesos) A.pesos = Object.assign({}, A.pesos, pesos);
    const uv = j.listas.uv, DIM = j.listas.dimensiones; const N = {}; Object.keys(DIM).forEach(d => { if (A.pesos[d] == null) A.pesos[d] = 1; }); Object.keys(A.pesos).forEach(d => { if (!DIM[d]) delete A.pesos[d]; });
    Object.entries(DIM).forEach(([d, def]) => def.metricas.forEach(([k, dir]) => { N[k] = norm(uv.map(u => u[k]), dir === 'inv'); }));
    const filas = uv.map(u => { const dims = {}; Object.entries(DIM).forEach(([d, def]) => { const vs = def.metricas.map(([k]) => N[k](u[k])).filter(x => x != null); dims[d] = vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null; }); const pw = Object.entries(A.pesos).filter(([d]) => dims[d] != null); const tot = pw.reduce((a, [, w]) => a + w, 0); const indice = tot ? Math.round(pw.reduce((a, [d, w]) => a + dims[d] * w, 0) / tot) : null; return Object.assign({}, u, { dims, indice }); });
    filas.sort((a, b) => (b.indice || 0) - (a.indice || 0)); filas.forEach((f, i) => f.puesto = i + 1);
    const idx = filas.map(f => f.indice).filter(x => x != null); const brecha = idx.length ? Math.max(...idx) - Math.min(...idx) : 0;
    A.resultado = { filas, brecha, mediana: idx.length ? idx.slice().sort((a, b) => a - b)[Math.floor(idx.length / 2)] : null };
    document.dispatchEvent(new CustomEvent('atlas:cambio', { detail: A.resultado }));
    return A.resultado;
  }
  const clase = i => i == null ? 'sin dato' : i >= 70 ? 'alto' : i >= 50 ? 'medio-alto' : i >= 30 ? 'medio-bajo' : 'bajo';
  // Rampa secuencial azul de la skill dataviz (claro = bajo, oscuro = alto) para el índice y cualquier métrica
  const RAMPA = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
  function color(v, mn, mx) { if (v == null || !isFinite(v)) return '#2a3a42'; const t = mx === mn ? 0 : (v - mn) / (mx - mn); return RAMPA[Math.min(RAMPA.length - 1, Math.floor(t * RAMPA.length))]; }
  function valoresPara(metrica) { const r = A.resultado; if (!r) return null; const vals = {}; r.filas.forEach(f => { vals[f.uv] = metrica === 'indice' ? f.indice : metrica.startsWith('dim:') ? f.dims[metrica.slice(4)] : f[metrica]; }); const vs = Object.values(vals).filter(x => x != null && isFinite(x)); return { vals, mn: vs.length ? Math.min(...vs) : 0, mx: vs.length ? Math.max(...vs) : 1, inv: false }; }
  window.ATLAS = { calcular, clase, color, valoresPara, RAMPA, estado: A };
})();
