// Renderiza cada sección desde el lago. Genérico (cifras → tiles, series → líneas) + narrativa por tema
// (leads y señales) que se afina en NARRATIVA. Nada se escribe a mano: si el dato no está, la tile no aparece.
(function () {
  const $ = s => document.querySelector(s);
  const F = () => window.G.fmt;
  const fuenteDe = (j, id) => (j.fuentes || []).find(f => f.id === id) || {};
  const nombreFuente = (j, id) => { const f = fuenteDe(j, id); if (!f.nombre) return id; let n = f.nombre.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+—.*$/, '').replace(/\s*·.*$/, '').replace(/\s*\/.*$/, '').trim(); return n.length > 34 ? n.slice(0, 32) + '…' : n; };
  const estadoCifra = (j, c) => c.estado || (fuenteDe(j, c.fuente).estado === 'declarado' ? 'declarado' : '');
  function valorFmt(c) { const v = c.valor; if (typeof v !== 'number') return String(v); const u = (c.unidad || '').toLowerCase(); if (c.decimales != null) return F().n(v, c.decimales); if (/0-1/.test(u) && Math.abs(v) < 1) return F().n(v, 3); if (u === 'm$' && Math.abs(v) >= 1e5) return F().n(v / 1e6, Math.abs(v) >= 1e7 ? 1 : 2); if (u === '$' && Math.abs(v) >= 1e8) return F().n(v / 1e9, 1); if (u.includes('%')) return F().n(v, Math.abs(v) < 10 && Math.round(v * 100) % 100 ? 2 : 1); if (Math.abs(v) >= 1e6) return F().k(v); return F().n(v, c.decimales); }
  function unidadFmt(c) { const u = c.unidad || ''; if (typeof c.valor !== 'number') return u; if (u === 'M$' && Math.abs(c.valor) >= 1e5) return 'mil M$'; if (u === '$' && Math.abs(c.valor) >= 1e8) return 'mil M$'; return u; }

  function tiles(cont, j, claves, extra) {
    if (!j || !j.cifras) return 0; let n = 0;
    (claves || Object.keys(j.cifras)).forEach(k => { const c = j.cifras[k]; if (!c || c.valor == null) return; window.G.tile(cont, { valor: valorFmt(c), unidad: unidadFmt(c), etiqueta: c.etiqueta || c.nota_corta || (window.ETIQ && ETIQ[k]) || k.replace(/_/g, ' '), fuente: nombreFuente(j, c.fuente), vigencia: c.vigencia, estado: estadoCifra(j, c), title: c.nota || '' }); n++; });
    return n;
  }
  function serieCard(cont, j, k, titulo, opts) {
    const s = j && j.series && j.series[k]; if (!s || !s.puntos || !s.puntos.length) return null;
    const c = window.G.card(cont, titulo || s.etiqueta || k.replace(/_/g, ' '), (s.unidad || '') + (s.vigencia ? ' · ' + s.vigencia : ''), opts);
    const series = Array.isArray(s.series) ? s.series : [{ nombre: s.etiqueta || k, puntos: s.puntos }];
    const o = Object.assign({}, opts || {}); if (/%/.test(s.unidad || '')) { o.fmtV = v => F().n(v, 1) + ' %'; o.fmtY = v => F().n(v, 0); }
    if ((opts && opts.barras) || s.tipo === 'barras') window.G.barras(c.cuerpo, s.puntos.map(p => ({ etiqueta: String(p[0]), valor: p[1] })), { horizontal: false, fmtV: o.fmtV }); else window.G.linea(c.cuerpo, series, o);
    if (s.nota) c.nota(s.nota); c.fuente(`Fuente: ${nombreFuente(j, s.fuente)}${fuenteDe(j, s.fuente).url ? ` · <a href="${fuenteDe(j, s.fuente).url}" target="_blank" rel="noopener">enlace</a>` : ''}`);
    return c;
  }
  function multiSerieCard(cont, j, claves, titulo, opts) {
    const ss = claves.map(k => j && j.series && j.series[k]).filter(s => s && s.puntos && s.puntos.length); if (!ss.length) return null;
    const c = window.G.card(cont, titulo, ss[0].unidad || '', opts);
    window.G.linea(c.cuerpo, ss.map((s, i) => ({ nombre: s.etiqueta || claves[i], puntos: s.puntos })), opts || {});
    c.fuente('Fuente: ' + [...new Set(ss.map(s => nombreFuente(j, s.fuente)))].join(' · ')); return c;
  }
  function listaCard(cont, j, k, titulo, cols, opts) { const l = j && j.listas && j.listas[k]; if (!l || !l.length) return null; const c = window.G.card(cont, titulo, `${l.length} filas`, opts); window.G.tabla(c.cuerpo, cols, l.slice(0, (opts && opts.max) || 25)); return c; }
  function barrasCard(cont, j, k, titulo, opts) { const l = j && j.listas && j.listas[k]; if (!l || !l.length) return null; const c = window.G.card(cont, titulo, opts && opts.sub || '', opts); const e = (opts && opts.etiqueta) || 'nombre', v = (opts && opts.valor) || 'valor'; window.G.barras(c.cuerpo, l.slice(0, (opts && opts.max) || 12).map(x => ({ etiqueta: String(x[e] || x.etiqueta || x.rubro || x.categoria || x.nombre), valor: Number(x[v] ?? x.valor ?? x.n ?? x.total ?? 0) })), { fmtV: opts && opts.fmtV }); if (opts && opts.fuente) c.fuente('Fuente: ' + nombreFuente(j, opts.fuente)); return c; }
  function señal(cont, clase, titulo, texto) { const d = document.createElement('div'); d.className = 'senal ' + (clase || ''); d.innerHTML = `<b>${titulo}</b><span>${texto}</span>`; cont.appendChild(d); }
  function pill(estado) { return `<span class="pill ${estado}">${estado}</span>`; }

  function render(L) {
    const cif = (t, k) => L[t] && L[t].cifras && L[t].cifras[k] ? L[t].cifras[k].valor : null;
    try { window.NARRATIVA && NARRATIVA.antes && NARRATIVA.antes(L); } catch (e) { console.error('narrativa antes', e); }
    // Panorama: las cifras ancla de cada tema (las que cada JSON declare en `ancla`, o las 3 primeras)
    const pt = $('#panoramaTiles');
    [
      ['demografia', ['manhattan_pob_proy_2026']],
      ['social', ['manhattan_idh_2019', 'manhattan_pobreza_2018']],
      ['economia', ['precio_m2_manhattan_usd']],
      ['turismo', ['hospedajes_calificados_manhattan']],
      ['municipio', ['pim_2026_manhattan']],
      ['seguridad', ['denuncias_total_2025_manhattan']],
      ['geo', ['areas_verdes_ha_manhattan']],
      ['infraestructura', ['subestaciones_manhattan', 'congestion_ny_2025_pct']],
    ].forEach(([t, claves]) => { const j = L[t]; if (!j || !j.cifras) return; tiles(pt, j, claves.filter(k => j.cifras[k])); });
    if (L.geo_resumen && L.geo_resumen.cifras) { /* ya cubierto arriba si geo_resumen sigue el contrato */ }
    // Secciones temáticas: genérico + narrativa
    const MAPA_SEC = { gente: ['demografia', 'social'], economia: ['economia'], municipio: ['municipio'], seguridad: ['seguridad'], turismo: ['turismo'], cultura: ['geo_resumen'], correlaciones: ['correlaciones'], atlas: ['atlas_distritos'], ambiente: ['sensores'], escucha: ['escucha'] };
    for (const sec in MAPA_SEC) {
      const cont = $('#' + sec + 'Tiles'), gcont = $('#' + sec + 'Graficos');
      let hecho = false; try { hecho = window.NARRATIVA && NARRATIVA[sec] ? NARRATIVA[sec](L, { tiles, serieCard, multiSerieCard, listaCard, barrasCard, señal, cont, gcont, cif, nombreFuente, fuenteDe }) : false; } catch (e) { console.error('narrativa', sec, e); try { const n = document.getElementById('sondaLienzo'); n.textContent = JSON.stringify(Object.assign(JSON.parse(n.textContent || '{}'), { ['error_' + sec]: String(e && e.message) })); } catch (_) { } }
      if (hecho !== true) MAPA_SEC[sec].forEach(t => { const j = L[t]; if (!j) return; if (!hecho) tiles(cont, j); Object.keys(j.series || {}).forEach(k => serieCard(gcont, j, k)); });
    }
    fuentes(L);
    try { window.NARRATIVA && NARRATIVA.despues && NARRATIVA.despues(L); } catch (e) { console.error('narrativa despues', e); }
  }

  function fuentes(L) {
    const cat = L.catalogo; const cont = $('#fuentesTabla'); if (!cat) { cont.textContent = 'catálogo no disponible'; return; }
    $('#fuentesLead').innerHTML = `${cat.n} datasets probados en vivo · ${Object.entries(cat.por_estado || {}).map(([e, n]) => `${pill(e)} ${n}`).join(' ')}. Cada tema del lago nace de un <code>ingesta/pull_&lt;tema&gt;.py</code> reproducible y sin llaves; <code>verificar.py</code> corre antes de cada despliegue. Lo que se leyó de un PDF o una nota de prensa está marcado <em>declarado</em>; lo que no existe abierto queda como <em>candidato</em> con la URL probada, para no inventarlo.`;
    const datasets = Array.isArray(cat.datasets) ? cat.datasets : [];
    const filtros = document.createElement('div'); filtros.className = 'filtros'; const temas = ['todos', ...new Set(datasets.map(d => d.tema).filter(Boolean))]; filtros.innerHTML = temas.map((t, i) => `<button class="${i === 0 ? 'on' : ''}" data-t="${t}">${t}</button>`).join(''); cont.appendChild(filtros);
    const wrap = document.createElement('div'); cont.appendChild(wrap);
    const pintar = (t) => { wrap.innerHTML = ''; const rows = datasets.filter(d => t === 'todos' || d.tema === t); window.G.tabla(wrap, [{ t: 'DATASET', f: d => `<b>${d.nombre || d.id}</b><br><small style="color:#728a92">${d.entidad || ''}${d.resolucion ? ' · ' + d.resolucion : ''}</small>` }, { t: 'TEMA', k: 'tema' }, { t: 'VIGENCIA', k: 'vigencia' }, { t: 'ESTADO', f: d => pill(d.estado) }, { t: 'USO / NOTA', f: d => `${d.uso || ''}${d.nota ? `<br><small style="color:#728a92">${d.nota}</small>` : ''}` }, { t: 'URL', f: d => d.url ? `<a href="${d.url}" target="_blank" rel="noopener">↗</a>` : '' }], rows); };
    filtros.querySelectorAll('button').forEach(b => b.onclick = () => { filtros.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); pintar(b.dataset.t); }); pintar('todos');
  }

  window.SECCIONES = { render, tiles, serieCard, multiSerieCard, listaCard, barrasCard, señal };
})();
