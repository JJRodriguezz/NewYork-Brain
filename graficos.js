// Gráficos SVG a mano (sin librerías): línea, barras, pirámide, tiles. Reglas de la skill dataviz:
// un solo eje, marcas finas, leyenda si ≥2 series, hover con crosshair/tooltip, texto en tinta (nunca color de serie).
(function () {
  const PAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
  const fmt = {
    n(v, d) { if (v == null || isNaN(v)) return '—'; const a = Math.abs(v); if (d == null) d = a >= 100 ? 0 : a >= 10 ? 1 : 2; return v.toLocaleString('es-CL', { maximumFractionDigits: d, minimumFractionDigits: 0 }); },
    k(v) { if (v == null || isNaN(v)) return '—'; const a = Math.abs(v); if (a >= 1e12) return fmt.n(v / 1e12, 2) + ' B'; if (a >= 1e9) return fmt.n(v / 1e9, 2) + ' mil M'; if (a >= 1e6) return fmt.n(v / 1e6, 2) + ' M'; if (a >= 1e4) return fmt.n(v / 1e3, 1) + ' k'; return fmt.n(v); },
    pct(v, d) { return v == null ? '—' : fmt.n(v, d == null ? 1 : d) + ' %'; },
  };
  const tip = document.getElementById('tip');
  function showTip(html, x, y) { tip.innerHTML = html; tip.hidden = false; const r = tip.getBoundingClientRect(); let tx = x + 14, ty = y + 14; if (tx + r.width > innerWidth - 8) tx = x - r.width - 14; if (ty + r.height > innerHeight - 8) ty = y - r.height - 14; tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; }
  function hideTip() { tip.hidden = true; }
  const svgNS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function nice(max) { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; const s = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10; return s * p; }

  // series: [{nombre, puntos:[[x,y],...]}] — x categórico (string) compartido
  function linea(cont, series, opts) {
    opts = opts || {}; cont.innerHTML = ''; cont.classList.add('viz');
    const W = Math.max(480, Math.min(1400, cont.clientWidth || 640)), H = opts.alto || (W > 900 ? 300 : 220), m = { t: 14, r: 16, b: 28, l: 48 };
    const xs = []; series.forEach(s => s.puntos.forEach(p => { if (!xs.includes(p[0])) xs.push(p[0]); }));
    if (!opts.noOrdenar) xs.sort();
    const vals = series.flatMap(s => s.puntos.map(p => p[1]).filter(v => v != null));
    let yMax = opts.yMax != null ? opts.yMax : nice(Math.max(...vals, 0) * 1.05); let yMin = opts.yMin != null ? opts.yMin : Math.min(0, ...vals);
    if (yMax === yMin) yMax = yMin + 1;
    const X = i => m.l + (xs.length > 1 ? i / (xs.length - 1) : .5) * (W - m.l - m.r), Y = v => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, cont);
    for (let i = 0; i <= 4; i++) { const v = yMin + (yMax - yMin) * i / 4; el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg); const t = el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, svg); t.textContent = opts.fmtY ? opts.fmtY(v) : fmt.k(v); }
    const paso = Math.ceil(xs.length / (W > 900 ? 12 : 8));
    xs.forEach((x, i) => { if (i % paso === 0 || (i === xs.length - 1 && (i % paso) >= paso / 2)) { const t = el('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, svg); t.textContent = opts.fmtX ? opts.fmtX(x) : x; } });
    if (yMin < 0) el('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), class: 'eje' }, svg);
    series.forEach((s, si) => {
      const col = s.color || PAL[si % PAL.length];
      const pts = xs.map((x, i) => { const p = s.puntos.find(q => q[0] === x); return p && p[1] != null ? [X(i), Y(p[1])] : null; });
      let d = '', abierto = false; pts.forEach(p => { if (!p) { abierto = false; return; } d += (abierto ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); abierto = true; });
      if (opts.area) { const first = pts.find(Boolean), last = [...pts].reverse().find(Boolean); if (first && last) el('path', { d: d + `L${last[0]} ${Y(Math.max(0, yMin))}L${first[0]} ${Y(Math.max(0, yMin))}Z`, fill: col, opacity: .12 }, svg); }
      el('path', { d, fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (xs.length <= 24) pts.forEach(p => p && el('circle', { cx: p[0], cy: p[1], r: 3, fill: col, stroke: '#101c22', 'stroke-width': 2 }, svg));
      const last = [...pts].reverse().find(Boolean); if (last && series.length > 1 && series.length <= 4 && !opts.sinEtiquetas) { const cabe = last[0] < W - m.r - s.nombre.length * 6.5; const t = el('text', { x: cabe ? last[0] + 6 : last[0] - 4, y: cabe ? last[1] + 4 : last[1] - 8, class: 'dl', 'text-anchor': cabe ? 'start' : 'end' }, svg); t.textContent = s.nombre; }
    });
    const cross = el('line', { y1: m.t, y2: H - m.b, class: 'cross', visibility: 'hidden' }, svg);
    const zona = el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    zona.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; let i = Math.round((px - m.l) / (W - m.l - m.r) * (xs.length - 1)); i = Math.max(0, Math.min(xs.length - 1, i)); cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible'); const filas = series.map((s, si) => { const p = s.puntos.find(q => q[0] === xs[i]); return `<div><span style="color:${s.color || PAL[si % PAL.length]}">■</span> ${s.nombre}: <b>${p && p[1] != null ? (opts.fmtV || fmt.n)(p[1]) : '—'}</b></div>`; }).join(''); showTip(`<div>${opts.fmtX ? opts.fmtX(xs[i]) : xs[i]}</div>${filas}`, e.clientX, e.clientY); });
    zona.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
    if (series.length > 1) leyenda(cont, series);
  }

  // barras: items [{etiqueta, valor, color?}], horizontal por defecto
  function barras(cont, items, opts) {
    opts = opts || {}; cont.innerHTML = ''; cont.classList.add('viz'); items = (items || []).filter(i => i && i.valor != null && isFinite(i.valor)).map(i => Object.assign({}, i, { etiqueta: String(i.etiqueta == null ? '' : i.etiqueta) })); if (!items.length) { cont.innerHTML = '<p class="nota">sin datos</p>'; return; }
    const horiz = opts.horizontal !== false;
    if (horiz) {
      const W = Math.max(480, Math.min(1400, cont.clientWidth || 640)), fila = 24, m = { l: Math.min(W * .45, Math.max(...items.map(i => i.etiqueta.length)) * 6.6 + 12), r: 70 }, H = items.length * fila + 6;
      const max = nice(Math.max(...items.map(i => i.valor), 0)); const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, cont);
      items.forEach((it, i) => { const w = Math.max(0, it.valor / max * (W - m.l - m.r)); const y = 3 + i * fila; const r = el('rect', { x: m.l, y, width: w, height: fila - 6, rx: 4, fill: it.color || opts.color || PAL[0] }, svg); const t = el('text', { x: m.l - 8, y: y + fila / 2 + 1, 'text-anchor': 'end', class: 'dl' }, svg); t.textContent = it.etiqueta; const v = el('text', { x: m.l + w + 6, y: y + fila / 2 + 1 }, svg); v.textContent = (opts.fmtV || fmt.k)(it.valor); r.addEventListener('mousemove', e => showTip(`${it.etiqueta}<br><b>${(opts.fmtV || fmt.n)(it.valor)}</b>${it.nota ? '<br>' + it.nota : ''}`, e.clientX, e.clientY)); r.addEventListener('mouseleave', hideTip); });
    } else {
      const W = Math.max(480, Math.min(1400, cont.clientWidth || 640)), H = opts.alto || 200, m = { t: 12, r: 10, b: 26, l: 46 }; const max = nice(Math.max(...items.map(i => i.valor), 0)); const min = Math.min(0, ...items.map(i => i.valor));
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, cont); const bw = (W - m.l - m.r) / items.length; const Y = v => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
      for (let i = 0; i <= 4; i++) { const v = min + (max - min) * i / 4; el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg); const t = el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, svg); t.textContent = (opts.fmtY || fmt.k)(v); }
      const paso = Math.ceil(items.length / 10);
      items.forEach((it, i) => { const x = m.l + i * bw + 2, h = Math.abs(Y(it.valor) - Y(0)); const r = el('rect', { x, y: Math.min(Y(it.valor), Y(0)), width: bw - 4, height: h, rx: 3, fill: it.color || opts.color || PAL[0] }, svg); if (i % paso === 0) { const t = el('text', { x: x + (bw - 4) / 2, y: H - 8, 'text-anchor': 'middle' }, svg); t.textContent = it.etiqueta; } r.addEventListener('mousemove', e => showTip(`${it.etiqueta}<br><b>${(opts.fmtV || fmt.n)(it.valor)}</b>${it.nota ? '<br>' + it.nota : ''}`, e.clientX, e.clientY)); r.addEventListener('mouseleave', hideTip); });
    }
  }

  // pirámide: grupos [{edad, hombres, mujeres}]
  function piramide(cont, grupos, opts) {
    opts = opts || {}; cont.innerHTML = ''; cont.classList.add('viz');
    const W = Math.max(480, Math.min(1400, cont.clientWidth || 640)), fila = 16, H = grupos.length * fila + 20, cx = W / 2, lw = 44; const max = nice(Math.max(...grupos.flatMap(g => [g.hombres, g.mujeres])));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, cont); const esc = (W / 2 - lw - 10) / max;
    grupos.forEach((g, i) => { const y = H - 20 - (i + 1) * fila + 2; const t = el('text', { x: cx, y: y + fila / 2 + 1, 'text-anchor': 'middle' }, svg); t.textContent = g.edad; const h = el('rect', { x: cx - lw / 2 - g.hombres * esc, y, width: g.hombres * esc, height: fila - 3, rx: 3, fill: PAL[0] }, svg); const mj = el('rect', { x: cx + lw / 2, y, width: g.mujeres * esc, height: fila - 3, rx: 3, fill: PAL[4] }, svg); [h, mj].forEach((r, k) => { r.addEventListener('mousemove', e => showTip(`${g.edad} años · ${k ? 'mujeres' : 'hombres'}<br><b>${fmt.n(k ? g.mujeres : g.hombres)}</b>`, e.clientX, e.clientY)); r.addEventListener('mouseleave', hideTip); }); });
    const t1 = el('text', { x: cx - lw / 2 - 4, y: H - 4, 'text-anchor': 'end', class: 'dl' }, svg); t1.textContent = 'Hombres'; const t2 = el('text', { x: cx + lw / 2 + 4, y: H - 4, class: 'dl' }, svg); t2.textContent = 'Mujeres';
  }

  function leyenda(cont, series) { const l = document.createElement('div'); l.className = 'leyenda-viz'; l.innerHTML = series.map((s, i) => `<span style="--sw:${s.color || PAL[i % PAL.length]}">${s.nombre}</span>`).join(''); cont.appendChild(l); }

  function tile(cont, o) { const d = document.createElement('div'); d.className = 'tile' + (o.estado === 'declarado' ? ' decl' : o.estado === 'vivo' ? ' vivo' : ''); d.innerHTML = `<div class="v">${o.valor}<span class="u">${o.unidad || ''}</span></div><div class="l">${o.etiqueta}</div><div class="f">${o.fuente || ''}${o.vigencia ? ' · ' + o.vigencia : ''}</div>`; if (o.title) d.title = o.title; cont.appendChild(d); return d; }
  function card(cont, titulo, sub, opts) { const c = document.createElement('div'); c.className = 'card' + (opts && opts.ancha ? ' ancha' : ''); c.innerHTML = `<h2>${titulo}${sub ? `<small>${sub}</small>` : ''}</h2>`; const cuerpo = document.createElement('div'); c.appendChild(cuerpo); cont.appendChild(c); c.cuerpo = cuerpo; c.nota = (t) => { const p = document.createElement('p'); p.className = 'nota'; p.innerHTML = t; c.appendChild(p); return c; }; c.fuente = (t) => { const p = document.createElement('div'); p.className = 'fuente'; p.innerHTML = t; c.appendChild(p); return c; }; return c; }
  function tabla(cont, cols, filas) { const w = document.createElement('div'); w.className = 'tabla-wrap'; w.innerHTML = `<table class="tabla"><thead><tr>${cols.map(c => `<th>${c.t}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${cols.map(c => `<td class="${c.n ? 'n' : ''}">${c.f ? c.f(f) : f[c.k] == null ? '—' : f[c.k]}</td>`).join('')}</tr>`).join('')}</tbody></table>`; cont.appendChild(w); return w; }

  window.G = { PAL, fmt, linea, barras, piramide, tile, card, tabla, showTip, hideTip };
})();
