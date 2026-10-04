// Primitivas de visualización en SVG (sin librerías): tiles, tarjetas, barras, líneas, dispersión y tablas.
// Toda cifra que se pinta lleva fuente y estado (observado · derivado · declarado · transcrito).
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const esc = v => String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const nf = (d = 0) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const fmt = {
    n: (v, d = 0) => v == null || isNaN(v) ? '—' : nf(d).format(v),
    k: v => v == null ? '—' : Math.abs(v) >= 1e9 ? nf(1).format(v / 1e9) + ' mil M' : Math.abs(v) >= 1e6 ? nf(1).format(v / 1e6) + ' M' : Math.abs(v) >= 1e4 ? nf(0).format(v / 1e3) + ' mil' : nf(0).format(v),
    usd: v => v == null ? '—' : 'US$ ' + nf(0).format(v),
    pct: (v, d = 1) => v == null ? '—' : nf(d).format(v) + ' %',
    signo: (v, d = 1) => v == null ? '—' : (v > 0 ? '+' : '') + nf(d).format(v) + ' %',
  };
  const PALETA = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
  const BORO_COLOR = { Manhattan: 'var(--c1)', Brooklyn: 'var(--c2)', Queens: 'var(--c3)', Bronx: 'var(--c4)', 'Staten Island': 'var(--c5)' };

  // ---- tooltip compartido
  const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'status');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
  function conTip(el, html) {
    el.addEventListener('mousemove', e => { tip.innerHTML = typeof html === 'function' ? html() : html; tip.classList.add('on'); const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; });
    el.addEventListener('mouseleave', () => tip.classList.remove('on'));
  }

  function el(tag, attrs, padre) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); padre && padre.appendChild(e); return e; }
  function svg(w, h, padre) { const s = el('svg', { viewBox: `0 0 ${w} ${h}`, class: 'g', role: 'img' }); padre.appendChild(s); return s; }
  function txt(s, x, y, t, a = {}) { const e = el('text', Object.assign({ x, y }, a), s); e.textContent = t; return e; }
  const escala = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
  function bonito(max) { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }

  // ---- tile: cifra con etiqueta, fuente y estado
  function tile(cont, o) {
    const d = document.createElement('div'); d.className = 'tile'; if (o.title) d.title = o.title;
    d.innerHTML = `<div class="v">${o.valor}${o.unidad ? `<small>${esc(o.unidad)}</small>` : ''}</div><div class="l">${o.etiqueta}</div>` +
      `<div class="f">${o.estado ? `<span class="estado ${o.estado}">${o.estado}</span>` : ''}<span>${esc(o.fuente || '')}${o.vigencia ? ' · ' + esc(o.vigencia) : ''}</span></div>`;
    cont.appendChild(d); return d;
  }

  // ---- tarjeta con cuerpo, nota y fuente
  function card(cont, titulo, sub, opts = {}) {
    const c = document.createElement('article'); c.className = 'card' + (opts.ancha ? ' ancha' : '');
    c.innerHTML = `<h3>${titulo}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="cuerpo"></div>`;
    cont.appendChild(c);
    const api = { el: c, cuerpo: c.querySelector('.cuerpo') };
    api.nota = h => { const p = document.createElement('div'); p.className = 'nota'; p.innerHTML = h; c.appendChild(p); return api; };
    api.calidad = h => { const p = document.createElement('div'); p.className = 'calidad'; p.innerHTML = h; c.appendChild(p); return api; };
    api.fuente = h => { const p = document.createElement('div'); p.className = 'fuente'; p.innerHTML = h; c.appendChild(p); return api; };
    return api;
  }

  // ---- barras horizontales (opcional: margen de error, color por fila, línea de referencia)
  function barras(cont, filas, o = {}) {
    const W = 560, fila = o.alto || 26, izq = o.izq || 118, der = 86, H = filas.length * fila + 8;
    const s = svg(W, H, cont);
    const max = o.max || Math.max(...filas.map(f => (f.valor || 0) + (f.moe || 0)));
    const x = escala(0, max, izq, W - der);
    filas.forEach((f, i) => {
      const y = i * fila + 4;
      txt(s, izq - 8, y + fila / 2 + 4, f.etiqueta, { 'text-anchor': 'end', class: 'lbl' });
      el('rect', { x: izq, y: y + 4, width: W - der - izq, height: fila - 9, rx: 3, fill: 'var(--surface-2)' }, s);
      const r = el('rect', { x: izq, y: y + 4, width: Math.max(1, x(f.valor || 0) - izq), height: fila - 9, rx: 3, fill: f.color || o.color || 'var(--accent)' }, s);
      if (f.moe) { const a = x(f.valor - f.moe), b = x(f.valor + f.moe), cy = y + fila / 2; el('line', { x1: a, x2: b, y1: cy, y2: cy, stroke: 'var(--text)', 'stroke-width': 1.2 }, s); el('line', { x1: a, x2: a, y1: cy - 4, y2: cy + 4, stroke: 'var(--text)' }, s); el('line', { x1: b, x2: b, y1: cy - 4, y2: cy + 4, stroke: 'var(--text)' }, s); }
      txt(s, W - der + 6, y + fila / 2 + 4, o.fmt ? o.fmt(f.valor) : fmt.n(f.valor), { class: 'val' });
      if (f.tip) conTip(r, f.tip);
    });
    if (o.ref != null) { const rx = x(o.ref); el('line', { x1: rx, x2: rx, y1: 0, y2: H, stroke: 'var(--text)', 'stroke-dasharray': '3 3', opacity: .6 }, s); txt(s, rx + 4, 10, o.refEtiqueta || '', { 'font-size': 9.5 }); }
    return s;
  }

  // ---- barras apiladas al 100 % (composición)
  function apiladas(cont, filas, partes, o = {}) {
    const W = 560, fila = 28, izq = o.izq || 118, H = filas.length * fila + 4, s = svg(W, H, cont);
    filas.forEach((f, i) => {
      const y = i * fila + 2; let x0 = izq; const tot = partes.reduce((a, p) => a + (f[p.k] || 0), 0) || 1;
      txt(s, izq - 8, y + fila / 2 + 4, f.etiqueta, { 'text-anchor': 'end', class: 'lbl' });
      partes.forEach((p, j) => { const w = (f[p.k] || 0) / (o.base100 ? 100 : tot) * (W - izq - 4); const r = el('rect', { x: x0, y: y + 4, width: Math.max(0, w), height: fila - 9, fill: p.color || PALETA[j] }, s); conTip(r, `<b>${esc(f.etiqueta)}</b><br>${esc(p.nombre)}: ${o.fmt ? o.fmt(f[p.k]) : fmt.n(f[p.k], 1)}`); if (w > 34) txt(s, x0 + 4, y + fila / 2 + 4, o.fmt ? o.fmt(f[p.k]) : fmt.n(f[p.k], 0), { fill: '#fff', 'font-size': 10 }); x0 += w; });
    });
    leyenda(cont, partes.map((p, j) => ({ nombre: p.nombre, color: p.color || PALETA[j] })));
    return s;
  }

  // ---- columnas agrupadas (categorías × series)
  function columnas(cont, cats, series, o = {}) {
    const W = 560, H = o.H || 220, iz = 46, ab = 40, ar = 12;
    const s = svg(W, H, cont); const max = bonito(Math.max(...series.flatMap(se => se.valores)));
    const y = escala(0, max, H - ab, ar); const bw = (W - iz - 8) / cats.length; const w = Math.min(28, (bw - 12) / series.length);
    for (let t = 0; t <= 4; t++) { const v = max * t / 4; el('line', { x1: iz, x2: W, y1: y(v), y2: y(v), class: 'grid-l' }, s); txt(s, iz - 6, y(v) + 3, fmt.k(v), { 'text-anchor': 'end' }); }
    cats.forEach((c, i) => {
      const cx = iz + bw * i + bw / 2; txt(s, cx, H - ab + 15, c, { 'text-anchor': 'middle', class: 'lbl', 'font-size': 11 });
      series.forEach((se, j) => { const v = se.valores[i]; const x0 = cx - (series.length * w) / 2 + j * w; const r = el('rect', { x: x0, y: y(v), width: w - 2, height: Math.max(0, H - ab - y(v)), fill: se.color || PALETA[j], rx: 2 }, s); conTip(r, `<b>${esc(c)}</b> · ${esc(se.nombre)}<br>${o.fmt ? o.fmt(v) : fmt.n(v)}`); });
    });
    if (series.length > 1) leyenda(cont, series.map((se, j) => ({ nombre: se.nombre, color: se.color || PALETA[j] })));
    return s;
  }

  // ---- líneas temporales (x = 'AAAA-MM' o año)
  function lineas(cont, series, o = {}) {
    const W = 600, H = o.H || 240, iz = 52, ab = 26, ar = 10, de = 14;
    const s = svg(W, H, cont);
    const xs = [...new Set(series.flatMap(se => se.puntos.map(p => p[0])))].sort();
    const vals = series.flatMap(se => se.puntos.map(p => p[1])).filter(v => v != null);
    const min = o.cero === false ? Math.min(...vals) * .95 : 0; const max = bonito(Math.max(...vals) * 1.02);
    const x = i => iz + i / ((xs.length - 1) || 1) * (W - iz - de); const y = escala(min, max, H - ab, ar);
    for (let t = 0; t <= 4; t++) { const v = min + (max - min) * t / 4; el('line', { x1: iz, x2: W - de, y1: y(v), y2: y(v), class: 'grid-l' }, s); txt(s, iz - 6, y(v) + 3, o.fmtY ? o.fmtY(v) : fmt.k(v), { 'text-anchor': 'end' }); }
    const paso = Math.ceil(xs.length / 8);
    xs.forEach((v, i) => { if (i % paso === 0 || i === xs.length - 1) txt(s, x(i), H - 8, String(v), { 'text-anchor': 'middle', 'font-size': 9.5 }); });
    (o.marcas || []).forEach(m => { const i = xs.indexOf(m.x); if (i < 0) return; el('line', { x1: x(i), x2: x(i), y1: ar, y2: H - ab, stroke: 'var(--text)', 'stroke-dasharray': '3 3', opacity: .5 }, s); txt(s, x(i) + 4, ar + 10, m.texto, { 'font-size': 9.5, fill: 'var(--text)' }); });
    series.forEach((se, j) => {
      const pts = se.puntos.filter(p => p[1] != null).map(p => [x(xs.indexOf(p[0])), y(p[1]), p]);
      el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), fill: 'none', stroke: se.color || PALETA[j], 'stroke-width': se.grosor || 2, 'stroke-dasharray': se.punteada ? '4 3' : '' }, s);
      pts.forEach(p => { const c = el('circle', { cx: p[0], cy: p[1], r: 6, fill: 'transparent' }, s); conTip(c, `<b>${esc(se.nombre)}</b> · ${esc(p[2][0])}<br>${o.fmtV ? o.fmtV(p[2][1]) : fmt.n(p[2][1])}`); });
    });
    if (series.length > 1 || o.leyenda) leyenda(cont, series.map((se, j) => ({ nombre: se.nombre, color: se.color || PALETA[j] })));
    return s;
  }

  // ---- dispersión con recta de ajuste
  function dispersion(cont, puntos, o = {}) {
    const W = 620, H = o.H || 380, iz = 58, ab = 42, ar = 12, de = 16; const s = svg(W, H, cont);
    const xsv = puntos.map(p => p.x), ysv = puntos.map(p => p.y);
    const pad = (a, b) => { const r = (b - a) || 1; return [a - r * .06, b + r * .06]; };
    const [x0, x1] = pad(Math.min(...xsv), Math.max(...xsv)), [y0, y1] = pad(Math.min(...ysv), Math.max(...ysv));
    const x = escala(x0, x1, iz, W - de), y = escala(y0, y1, H - ab, ar);
    for (let t = 0; t <= 4; t++) { const vx = x0 + (x1 - x0) * t / 4, vy = y0 + (y1 - y0) * t / 4; el('line', { x1: x(vx), x2: x(vx), y1: ar, y2: H - ab, class: 'grid-l' }, s); el('line', { x1: iz, x2: W - de, y1: y(vy), y2: y(vy), class: 'grid-l' }, s); txt(s, x(vx), H - ab + 14, o.fmtX ? o.fmtX(vx) : fmt.k(vx), { 'text-anchor': 'middle' }); txt(s, iz - 6, y(vy) + 3, o.fmtY ? o.fmtY(vy) : fmt.k(vy), { 'text-anchor': 'end' }); }
    txt(s, (iz + W - de) / 2, H - 4, o.ejeX || '', { 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 11 });
    const ty = txt(s, 14, (ar + H - ab) / 2, o.ejeY || '', { 'text-anchor': 'middle', fill: 'var(--text)', 'font-size': 11 }); ty.setAttribute('transform', `rotate(-90 14 ${(ar + H - ab) / 2})`);
    const r = regresion(xsv, ysv);
    if (r) el('line', { x1: x(x0), y1: y(r.a + r.b * x0), x2: x(x1), y2: y(r.a + r.b * x1), stroke: 'var(--text)', 'stroke-dasharray': '5 4', opacity: .45 }, s);
    puntos.forEach(p => { const c = el('circle', { cx: x(p.x), cy: y(p.y), r: p.destacado ? 7 : 5, fill: p.color || 'var(--accent)', class: 'pt' + (p.destacado ? ' sel' : '') }, s); conTip(c, p.tip || esc(p.nombre)); if (p.onclick) c.addEventListener('click', p.onclick); if (p.destacado) txt(s, x(p.x) + 9, y(p.y) - 7, p.nombre, { fill: 'var(--text)', 'font-weight': 600, 'font-size': 11 }); });
    return s;
  }

  function leyenda(cont, items) { const d = document.createElement('div'); d.className = 'leyenda'; d.innerHTML = items.map(i => `<span><i style="background:${i.color}"></i>${esc(i.nombre)}</span>`).join(''); cont.appendChild(d); }

  // ---- tabla ordenable
  function tabla(cont, cols, filas, o = {}) {
    const w = document.createElement('div'); w.className = 'tabla-wrap'; if (o.alto) { w.style.maxHeight = o.alto + 'px'; w.style.overflowY = 'auto'; }
    const t = document.createElement('table'); t.className = 't'; w.appendChild(t); cont.appendChild(w);
    let orden = o.orden || null, dir = o.dir || -1;
    const maxCol = {}; cols.forEach(c => { if (c.barra) maxCol[c.k] = Math.max(...filas.map(f => +f[c.k] || 0)); });
    function pintar() {
      const fs = [...filas]; if (orden) fs.sort((a, b) => { const va = a[orden], vb = b[orden]; if (va == null) return 1; if (vb == null) return -1; return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir; });
      t.innerHTML = `<thead><tr>${cols.map(c => `<th class="${c.num ? 'n' : ''}" data-k="${c.k}" ${orden === c.k ? `aria-sort="${dir > 0 ? 'ascending' : 'descending'}"` : ''} title="${esc(c.ayuda || '')}">${c.t}</th>`).join('')}</tr></thead><tbody>` +
        fs.map(f => `<tr ${o.fila ? o.fila(f) : ''}>${cols.map(c => { const v = f[c.k]; const s = c.f ? c.f(v, f) : (c.num ? fmt.n(v, c.d || 0) : esc(v)); if (c.barra && typeof v === 'number') return `<td class="n celda-barra"><i style="width:${(v / (maxCol[c.k] || 1) * 100).toFixed(1)}%"></i><span>${s}</span></td>`; return `<td class="${c.num ? 'n' : ''} ${c.wrap ? 'wrap' : ''}">${s}</td>`; }).join('')}</tr>`).join('') + '</tbody>';
      t.querySelectorAll('th').forEach(th => th.onclick = () => { const k = th.dataset.k; dir = orden === k ? -dir : -1; orden = k; pintar(); });
      o.despues && o.despues(t);
    }
    pintar(); return t;
  }

  // ---- estadística
  function pearson(x, y) { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0; }
  function rangos(v) { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = Array(v.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1; } return r; }
  function spearman(x, y) { return pearson(rangos(x), rangos(y)); }
  function regresion(x, y) { const n = x.length; if (n < 3) return null; const mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b }; }
  // valor p bilateral aproximado para r con n casos (t de Student, aproximación normal para gl grandes)
  function pValor(r, n) { const gl = n - 2; if (gl < 1 || Math.abs(r) >= 1) return 0; const t = Math.abs(r) * Math.sqrt(gl / (1 - r * r)); const x = gl / (gl + t * t); return betaInc(x, gl / 2, .5); }
  function betaInc(x, a, b) { // fracción continua de Lentz
    const lbeta = lgamma(a + b) - lgamma(a) - lgamma(b); const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b + lbeta) / a;
    let f = 1, c = 1, d = 0; for (let i = 0; i <= 200; i++) { const m = i / 2; let num; if (i === 0) num = 1; else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)); else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)); d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30; const cd = c * d; f *= cd; if (Math.abs(1 - cd) < 1e-8) break; }
    return front * (f - 1);
  }
  function lgamma(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }

  window.G = { esc, fmt, PALETA, BORO_COLOR, tile, card, barras, apiladas, columnas, lineas, dispersion, tabla, leyenda, conTip, pearson, spearman, pValor, regresion };
})();
