// Diagnóstico territorial: seis dimensiones observadas por distrito → índice de atención (percentiles 0–100).
// Con el margen de error del ACS: el puesto se muestra como intervalo (simulación) y los distritos que no se
// pueden distinguir entre sí se presentan como un grupo, sin orden interno.
(function () {
  const $ = s => document.querySelector(s);
  const DIM = {   // la definición (nombre, unidad, fuente, vigencia, MOE) sale de lago/distritos.json
    calidad: { k: 'solicitudes_311_por_1000' }, seguridad: { k: 'delitos_graves_por_1000' }, vial: { k: 'heridos_transito_por_10000' },
    vivienda: { k: 'pct_hogares_con_carga_alquiler' }, pobreza: { k: 'pct_pobreza' }, aire: { k: 'pm25' },
  };
  const PERFIL = {
    equilibrio: { nombre: 'Equilibrio', p: { calidad: 1, seguridad: 1, vial: 1, vivienda: 1, pobreza: 1, aire: 1 } },
    social: { nombre: 'Vivienda y pobreza', p: { calidad: .5, seguridad: .5, vial: .5, vivienda: 3, pobreza: 3, aire: .5 } },
    seguridad: { nombre: 'Seguridad', p: { calidad: 1, seguridad: 3, vial: 3, vivienda: .5, pobreza: .5, aire: .5 } },
    ambiente: { nombre: 'Ambiente', p: { calidad: 1, seguridad: .5, vial: .5, vivienda: .5, pobreza: 1, aire: 3 } },
  };
  let D = [], perfil = 'equilibrio', A, B, temporizador;
  let pesos = Object.fromEntries(Object.keys(DIM).map(k => [k, 1]));
  const cache = {};
  const med = k => { const v = D.map(d => d[k]).filter(v => v != null).sort((a, b) => a - b); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const max = k => Math.max(...D.map(d => (d[k] || 0) + (LG.moe(d, k) || 0)));
  const pesosDe = pf => pf === 'personalizado' ? pesos : PERFIL[pf].p;

  function percentiles() {
    Object.entries(DIM).forEach(([dk, dm]) => {
      const vals = D.map(d => d[dm.k]).filter(v => v != null);
      D.forEach(d => { d['_p_' + dk] = ANALISIS.percentil(d[dm.k], vals); });
    });
  }
  const puntaje = (d, pf) => ANALISIS.indice(d, pesosDe(pf));
  const ranking = pf => [...D].sort((a, b) => (puntaje(b, pf) ?? -1) - (puntaje(a, pf) ?? -1) || a.puma.localeCompare(b.puma));
  const rango = (d, pf) => puntaje(d, pf) == null ? null : ranking(pf).indexOf(d) + 1;
  // intervalo del puesto con el margen de error (500 simulaciones, semilla fija: el resultado no cambia al recargar)
  function rangos(pf) {
    const w = pesosDe(pf), clave = JSON.stringify(w);
    if (!(clave in cache)) cache[clave] = ANALISIS.rangosConError(D, Object.fromEntries(Object.entries(DIM).map(([k, d]) => [k, { k: d.k, moe: LG.metrica(d.k)?.moe }])), w, { n: 500 });
    return cache[clave];
  }
  const nombrePerfil = () => perfil === 'personalizado' ? 'Personalizado' : PERFIL[perfil].nombre;
  function notificar() { window.dispatchEvent(new CustomEvent('prioridad-cambiada')); }
  const porId = id => D.find(d => d.puma === id);
  const def = k => LG.metrica(k) || {};
  const textoRango = r => !r ? '—' : r.desde === r.hasta ? `#${r.desde}` : `#${r.desde}–${r.hasta}`;

  function render() {
    const a = porId(A), b = porId(B), n = D.length, top = Math.ceil(n / 5);
    const R = rangos(perfil), ra = R && R[a.puma];
    const robust = Object.keys(PERFIL).map(pf => ({ pf, r: rangos(pf)?.[a.puma] }));
    const seguro = robust.filter(x => x.r && x.r.hasta <= top).length, posible = robust.filter(x => x.r && x.r.desde <= top).length;
    const lectura = seguro === 4 ? 'está en el quintil de mayor atención con <b>todas</b> las prioridades, incluso dentro del margen de error: la conclusión es robusta.'
      : posible === 0 ? 'no entra al quintil de mayor atención con ninguna prioridad, ni siquiera dentro del margen de error.'
        : `puede entrar al quintil de mayor atención con ${posible} de 4 prioridades (con certeza en ${seguro}): <b>la conclusión depende de qué se priorice y del margen de error</b>.`;
    const filas = Object.entries(DIM).map(([dk, dm]) => {
      const d = def(dm.k), m = med(dm.k), mx = max(dm.k) || 1, va = a[dm.k], vb = b[dm.k], ma = LG.moe(a, dm.k), mb = LG.moe(b, dm.k);
      const barra = (v, moe, color) => `<div class="mini"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${color}"></i>${moe ? `<u style="left:${((v - moe) / mx * 100).toFixed(1)}%;width:${(2 * moe / mx * 100).toFixed(1)}%"></u>` : ''}<b style="left:${(m / mx * 100).toFixed(1)}%" title="mediana NYC"></b><span>${G.fmt.n(v, d.decimales ?? 1)}${moe ? ` ±${G.fmt.n(moe, d.decimales ?? 1)}` : ''}</span></div>`;
      const dist = a === b ? null : LG.distinguibles(va, ma, vb, mb);
      return `<div class="dim-fila"><button type="button" class="nm" data-ficha="${dm.k}">${G.esc(d.etiqueta || dm.k)}<small>${G.esc(d.unidad || '')} · ${G.esc(LG.ids(d.fuente).join('+'))} ⓘ</small></button>${barra(va, ma, 'color-mix(in srgb,var(--accent) 70%,transparent)')}${barra(vb, mb, 'color-mix(in srgb,var(--accent-2) 70%,transparent)')}<span class="sig ${dist === false ? 'igual' : ''}" title="Regla del Census Bureau al 90 %: |A−B| > √(MOEa²+MOEb²)">${dist === null ? '' : dist ? '≠' : '≈'}</span></div>`;
    }).join('');
    const opciones = sel => D.slice().sort((x, y) => x.etiqueta.localeCompare(y.etiqueta)).map(d => `<option value="${d.puma}" ${d.puma === sel ? 'selected' : ''}>${G.esc(d.etiqueta)} · ${G.esc(d.nombre)}</option>`).join('');
    const masAlta = Object.entries(DIM).sort((x, y) => a['_p_' + y[0]] - a['_p_' + x[0]])[0];
    const grupos = R ? ANALISIS.grupos(R) : [];
    let mostrados = 0;
    const listaGrupos = grupos.filter(g => { const ok = mostrados < 10; mostrados += g.miembros.length; return ok; }).map(g => {
      const miembros = g.miembros.map(porId).sort((x, y) => x.nombre.localeCompare(y.nombre));
      return `<li class="grupo"><div class="grupo-h"><b>Grupo ${g.grupo}</b> · puestos posibles ${textoRango(g)}${g.miembros.length > 1 ? ` · <span title="Sus intervalos se cruzan: el margen de error no permite decir cuál va primero">no se ordenan entre sí</span>` : ''}</div>
        <ul>${miembros.map(d => `<li><a href="#" data-p="${d.puma}">${G.esc(d.nombre)}</a> <span class="pill">${G.esc(d.borough)}</span> <span class="mono" title="puesto mediano e intervalo del 90 %">${textoRango(R[d.puma])}</span></li>`).join('')}</ul></li>`;
    }).join('');
    $('#diagnostico').innerHTML = `
      <article class="card">
        <div class="diag-tag">Diagnóstico territorial · ${n} distritos comunitarios</div>
        <h2>¿Qué ocurre en ${G.esc(a.nombre)}?</h2>
        <p class="lede" style="font-size:13px;margin:0">Seis dimensiones observadas, convertidas a percentil frente a los otros distritos. Cambia la prioridad y observa si la conclusión se sostiene, también dentro del margen de error del ACS.</p>
        <div class="fila-ctrl" style="margin-top:14px">
          <label class="campo">Distrito principal<select id="dgA">${opciones(A)}</select></label>
          <button class="btn-ic" id="dgSwap" title="Intercambiar" aria-label="Intercambiar distritos">⇄</button>
          <label class="campo">Comparar con<select id="dgB">${opciones(B)}</select></label>
        </div>
        <div class="chips" style="margin-top:12px" role="group" aria-label="Prioridad del diagnóstico">${[...Object.entries(PERFIL), ['personalizado', { nombre: 'Personalizado' }]].map(([k, p]) => `<button class="chip ${k === perfil ? 'on' : ''}" data-pf="${k}">${p.nombre}</button>`).join('')}</div>
        ${perfil === 'personalizado' ? `<div class="pesos">${Object.entries(DIM).map(([k, d]) => `<label>${G.esc(def(d.k).etiqueta)}<input type="range" data-peso="${k}" min="0" max="100" value="${pesos[k]}" aria-label="Peso de ${G.esc(def(d.k).etiqueta)}"><output data-salida="${k}">${G.fmt.n(pesos[k] / (Object.values(pesos).reduce((x, y) => x + y, 0) || 1) * 100, 1)} %</output></label>`).join('')}</div><p class="nota">Los pesos se normalizan a 100 %. Si todos son cero, el índice queda sin resultado.</p>` : ''}
        <div class="veredicto"><div style="display:flex;gap:14px;align-items:center"><div class="rk">${ra ? textoRango(ra) : '—'}</div><div>de ${n} en necesidad de atención con prioridad <b>${nombrePerfil()}</b> (puntaje ${G.fmt.n(puntaje(a, perfil), 0)}/100${ra ? `; puesto mediano #${ra.mediana}` : ''}). Su dimensión más crítica es <b>${G.esc((def(masAlta[1].k).etiqueta || '').toLowerCase())}</b> (percentil ${G.fmt.n(a['_p_' + masAlta[0]], 0)}).</div></div>
          <div style="margin-top:8px;font-size:12.5px">${G.esc(a.nombre)} ${lectura}</div>
          <div class="robustez">${robust.map(x => `<span class="${x.r && x.r.hasta <= top ? 'top' : x.r && x.r.desde <= top ? 'quizas' : ''}">${PERFIL[x.pf].nombre}: ${textoRango(x.r)}</span>`).join('')}</div></div>
        <div style="margin-top:14px"><div class="leyenda" style="margin:0 0 4px"><span><i style="background:var(--accent)"></i>${G.esc(a.nombre)}</span><span><i style="background:var(--accent-2)"></i>${G.esc(b.nombre)}</span><span><i style="background:var(--text);width:2px"></i>mediana de NYC</span><span><i class="moe-i"></i>margen de error (90 %)</span><span><b>≈</b> la diferencia cabe en el margen · <b>≠</b> diferencia real</span></div>${filas}</div>
        ${a.puma === '4165' ? '<div class="calidad">Midtown tiene pocos residentes y millones de personas de paso: sus tasas por habitante se disparan. Léelo como carga de servicio, no como riesgo por residente.</div>' : ''}
      </article>
      <article class="card">
        <div class="diag-tag">Ranking · prioridad ${nombrePerfil()}</div>
        <h2 style="font-size:20px">Los distritos que piden más atención</h2>
        <p class="nota" style="margin:6px 0 0">Agrupados por margen de error: dentro de un grupo no hay orden, se listan alfabéticamente.</p>
        <ol id="dgTop" class="grupos">${listaGrupos || '<li>Sin resultado: revisa los pesos.</li>'}</ol>
        <div class="nota" style="font-size:11.5px;color:var(--muted);margin-top:12px">Método: cada dimensión se ordena y se expresa como percentil (rango medio para empates). El puntaje es el promedio ponderado según la prioridad. Para el margen de error se simula 500 veces cada tasa y porcentaje dentro de su MOE del ACS (MOE/1,645 como desviación; semilla fija) y se recalcula el puesto: el intervalo cubre el 90 % de las simulaciones. PM2,5 no publica error y se toma como fijo. Es una herramienta para formular preguntas, no un juicio sobre el distrito.</div>
      </article>`;
    $('#dgA').onchange = e => { A = e.target.value; render(); window.MAPA && MAPA.seleccionar && MAPA.seleccionar(A, true); };
    $('#dgB').onchange = e => { B = e.target.value; render(); };
    $('#dgSwap').onclick = () => { [A, B] = [B, A]; render(); };
    document.querySelectorAll('#diagnostico .chip').forEach(c => c.onclick = () => { perfil = c.dataset.pf; render(); notificar(); });
    document.querySelectorAll('#diagnostico [data-ficha]').forEach(btn => btn.onclick = () => G.ficha(LG.provMetrica(btn.dataset.ficha), def(btn.dataset.ficha).etiqueta));
    document.querySelectorAll('[data-peso]').forEach(sl => sl.oninput = () => {
      pesos[sl.dataset.peso] = +sl.value;
      const total = Object.values(pesos).reduce((x, y) => x + y, 0) || 1;
      document.querySelectorAll('.pesos output').forEach(o => o.textContent = G.fmt.n(pesos[o.dataset.salida] / total * 100, 1) + ' %');
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { const foco = sl.dataset.peso; render(); notificar(); const nuevo = document.querySelector(`[data-peso="${foco}"]`); nuevo && nuevo.focus(); }, 180);
    });
    document.querySelectorAll('#dgTop a').forEach(x => x.onclick = e => { e.preventDefault(); A = x.dataset.p; render(); });
  }

  window.DIAGNOSTICO = {
    init(L) {
      D = LG.distritos().map(x => Object.assign({}, x));
      if (!D.length) { $('#diagnostico').innerHTML = '<div class="card">Falta lago/distritos.json</div>'; return; }
      percentiles();
      A = ranking('equilibrio')[0].puma; B = (D.find(x => x.puma === '4306') || D[1]).puma;
      render();
    },
    elegir(puma) { if (porId(puma)) { A = puma; render(); } },
    puntaje: (puma, pf = perfil) => { const d = porId(puma); return d ? puntaje(d, pf) : null; },
    rango: (puma, pf = perfil) => { const d = porId(puma); return d ? rango(d, pf) : null; },
    intervalo: (puma, pf = perfil) => rangos(pf)?.[puma] || null,
    grupos: (pf = perfil) => { const R = rangos(pf); return R ? ANALISIS.grupos(R) : []; },
    textoRango,
    personalizar(p) {
      if (Object.keys(p).some(k => !DIM[k] || !ANALISIS.valido(p[k]) || p[k] < 0)) return;
      pesos = Object.fromEntries(Object.keys(DIM).map(k => [k, p[k] || 0]));
      perfil = 'personalizado'; render(); notificar();
    },
    perfil: nombrePerfil,
    DIM,
  };
})();
