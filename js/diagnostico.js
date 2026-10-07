// Diagnóstico territorial: convierte seis dimensiones observadas por distrito en un índice de atención
// comparable (percentiles 0–100) y muestra si la conclusión sobrevive al cambiar las prioridades.
(function () {
  const $ = s => document.querySelector(s);
  const DIM = {
    calidad: { k: 'solicitudes_311_por_1000', nombre: 'Quejas 311', unidad: 'por 1.000 hab.', fuente: 'F03 · 311', d: 0 },
    seguridad: { k: 'delitos_graves_por_1000', nombre: 'Delitos graves', unidad: 'por 1.000 hab.', fuente: 'F04 · NYPD', d: 1 },
    vial: { k: 'heridos_transito_por_10000', nombre: 'Heridos de tránsito', unidad: 'por 10.000 hab.', fuente: 'F02 · NYPD', d: 1 },
    vivienda: { k: 'pct_hogares_con_carga_alquiler', nombre: 'Carga de alquiler', unidad: '% hogares ≥30 % ingreso', fuente: 'F10 · ACS', d: 1 },
    pobreza: { k: 'pct_pobreza', nombre: 'Pobreza', unidad: '% personas', fuente: 'F10 · ACS', d: 1 },
    aire: { k: 'pm25', nombre: 'PM2,5', unidad: 'µg/m³ media anual', fuente: 'F15 · NYCCAS', d: 2 },
  };
  const PERFIL = {
    equilibrio: { nombre: 'Equilibrio', p: { calidad: 1, seguridad: 1, vial: 1, vivienda: 1, pobreza: 1, aire: 1 } },
    social: { nombre: 'Vivienda y pobreza', p: { calidad: .5, seguridad: .5, vial: .5, vivienda: 3, pobreza: 3, aire: .5 } },
    seguridad: { nombre: 'Seguridad', p: { calidad: 1, seguridad: 3, vial: 3, vivienda: .5, pobreza: .5, aire: .5 } },
    ambiente: { nombre: 'Ambiente', p: { calidad: 1, seguridad: .5, vial: .5, vivienda: .5, pobreza: 1, aire: 3 } },
  };
  let D = [], perfil = 'equilibrio', A, B;
  let pesos = Object.fromEntries(Object.keys(DIM).map(k => [k, 1]));
  const med = k => { const v = D.map(d => d[k]).filter(v => v != null).sort((a, b) => a - b); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const max = k => Math.max(...D.map(d => d[k] || 0));

  function percentiles() {
    Object.entries(DIM).forEach(([dk, dm]) => {
      const vals = D.map(d => d[dm.k]).filter(v => v != null).sort((a, b) => a - b);
      D.forEach(d => { const v = d[dm.k]; d['_p_' + dk] = ANALISIS.percentil(v, vals); });
    });
  }
  const puntaje = (d, pf) => ANALISIS.indice(d, pf === 'personalizado' ? pesos : PERFIL[pf].p);
  const ranking = pf => [...D].sort((a, b) => (puntaje(b, pf) ?? -1) - (puntaje(a, pf) ?? -1) || a.puma.localeCompare(b.puma));
  const rango = (d, pf) => puntaje(d, pf) == null ? null : ranking(pf).indexOf(d) + 1;
  const nombrePerfil = () => perfil === 'personalizado' ? 'Personalizado' : PERFIL[perfil].nombre;
  function notificar() { window.dispatchEvent(new CustomEvent('prioridad-cambiada')); }
  const porId = id => D.find(d => d.puma === id);

  function render() {
    const a = porId(A), b = porId(B), rk = rango(a, perfil), n = D.length, top = Math.ceil(n / 5);
    const robust = Object.keys(PERFIL).map(pf => ({ pf, r: rango(a, pf) }));
    const enTop = robust.filter(x => x.r <= top).length;
    const lectura = enTop === 4 ? `aparece en el quintil de mayor atención con <b>todas</b> las prioridades: la conclusión es robusta.`
      : enTop === 0 ? `no entra al quintil de mayor atención con ninguna prioridad.`
        : `entra al quintil de mayor atención con ${enTop} de 4 prioridades: <b>la conclusión depende de qué se priorice</b>.`;
    const filas = Object.entries(DIM).map(([dk, dm]) => {
      const m = med(dm.k), mx = max(dm.k) || 1, va = a[dm.k], vb = b[dm.k];
      const barra = (v, color) => `<div class="mini"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${color}"></i><b style="left:${(m / mx * 100).toFixed(1)}%" title="mediana NYC"></b><span>${G.fmt.n(v, dm.d)}</span></div>`;
      return `<div class="dim-fila"><div class="nm">${dm.nombre}<small>${dm.unidad} · ${dm.fuente}</small></div>${barra(va, 'color-mix(in srgb,var(--accent) 70%,transparent)')}${barra(vb, 'color-mix(in srgb,var(--accent-2) 70%,transparent)')}</div>`;
    }).join('');
    const opciones = sel => D.slice().sort((x, y) => x.etiqueta.localeCompare(y.etiqueta)).map(d => `<option value="${d.puma}" ${d.puma === sel ? 'selected' : ''}>${G.esc(d.etiqueta)} · ${G.esc(d.nombre)}</option>`).join('');
    const masAlta = Object.entries(DIM).sort((x, y) => a['_p_' + y[0]] - a['_p_' + x[0]])[0];
    $('#diagnostico').innerHTML = `
      <article class="card">
        <div class="diag-tag">Diagnóstico territorial · ${n} distritos comunitarios</div>
        <h2>¿Qué ocurre en ${G.esc(a.nombre)}?</h2>
        <p class="lede" style="font-size:13px;margin:0">Seis dimensiones observadas, convertidas a percentil frente a los otros distritos. Cambia la prioridad y observa si la conclusión se sostiene.</p>
        <div class="fila-ctrl" style="margin-top:14px">
          <label class="campo">Distrito principal<select id="dgA">${opciones(A)}</select></label>
          <button class="btn-ic" id="dgSwap" title="Intercambiar" aria-label="Intercambiar distritos">⇄</button>
          <label class="campo">Comparar con<select id="dgB">${opciones(B)}</select></label>
        </div>
        <div class="chips" style="margin-top:12px" role="group" aria-label="Prioridad del diagnóstico">${[...Object.entries(PERFIL), ['personalizado', {nombre: 'Personalizado'}]].map(([k, p]) => `<button class="chip ${k === perfil ? 'on' : ''}" data-pf="${k}">${p.nombre}</button>`).join('')}</div>
        ${perfil === 'personalizado' ? `<div class="pesos">${Object.entries(DIM).map(([k, d]) => `<label>${d.nombre}<input type="range" data-peso="${k}" min="0" max="100" value="${pesos[k]}" aria-label="Peso de ${d.nombre}"><output data-salida="${k}">${G.fmt.n(pesos[k] / (Object.values(pesos).reduce((a,b)=>a+b,0) || 1) * 100, 1)} %</output></label>`).join('')}</div><p class="nota">Los pesos se normalizan a 100 %. Si todos son cero, el índice queda sin resultado.</p>` : ''}
        <div class="veredicto"><div style="display:flex;gap:14px;align-items:center"><div class="rk">${rk == null ? '—' : '#' + rk}</div><div>de ${n} en necesidad de atención con prioridad <b>${nombrePerfil()}</b> (puntaje ${G.fmt.n(puntaje(a, perfil), 0)}/100). Su dimensión más crítica es <b>${masAlta[1].nombre.toLowerCase()}</b> (percentil ${G.fmt.n(a['_p_' + masAlta[0]], 0)}).</div></div>
          <div style="margin-top:8px;font-size:12.5px">${G.esc(a.nombre)} ${lectura}</div>
          <div class="robustez">${robust.map(x => `<span class="${x.r <= top ? 'top' : ''}">${PERFIL[x.pf].nombre}: #${x.r}</span>`).join('')}</div></div>
        <div style="margin-top:14px"><div class="leyenda" style="margin:0 0 4px"><span><i style="background:var(--accent)"></i>${G.esc(a.nombre)}</span><span><i style="background:var(--accent-2)"></i>${G.esc(b.nombre)}</span><span><i style="background:var(--text);width:2px"></i>mediana de NYC</span></div>${filas}</div>
        ${a.puma === '4165' ? '<div class="calidad">Midtown tiene pocos residentes y millones de personas de paso: sus tasas por habitante se disparan. Léelo como carga de servicio, no como riesgo por residente.</div>' : ''}
      </article>
      <article class="card">
        <div class="diag-tag">Ranking · prioridad ${nombrePerfil()}</div>
        <h2 style="font-size:20px">Los 10 distritos que piden más atención</h2>
        <ol id="dgTop" style="margin:12px 0 0;padding-left:22px;font-size:13px;line-height:1.9">${ranking(perfil).filter(d => puntaje(d, perfil) != null).slice(0, 10).map(d => `<li><a href="#" data-p="${d.puma}" style="color:var(--text)">${G.esc(d.nombre)}</a> <span class="pill">${G.esc(d.borough)}</span> <span class="mono" style="color:var(--muted);font-size:11px">${G.fmt.n(puntaje(d, perfil), 0)}</span></li>`).join('')}</ol>
        <div class="nota" style="font-size:11.5px;color:var(--muted);margin-top:12px">Método: cada dimensión se ordena de menor a mayor y se expresa como percentil (rango medio para empates; 0–100). El puntaje es el promedio ponderado según la prioridad. Es una herramienta para formular preguntas, no un juicio sobre el distrito: se combinan tasas, porcentajes y concentración de aire con distintos periodos; falta de datos en una dimensión activa deja el índice sin resultado (ver Atlas).</div>
      </article>`;
    $('#dgA').onchange = e => { A = e.target.value; render(); window.MAPA && MAPA.seleccionar && MAPA.seleccionar(A, true); };
    $('#dgB').onchange = e => { B = e.target.value; render(); };
    $('#dgSwap').onclick = () => { [A, B] = [B, A]; render(); };
    document.querySelectorAll('#diagnostico .chip').forEach(c => c.onclick = () => { perfil = c.dataset.pf; render(); notificar(); });
    document.querySelectorAll('[data-peso]').forEach(sl => sl.oninput = () => {
      pesos[sl.dataset.peso] = +sl.value;
      const sliders = document.querySelector('.pesos');
      render(); notificar();
      document.querySelector('.pesos').replaceWith(sliders);
      const total = Object.values(pesos).reduce((a,b)=>a+b,0) || 1;
      sliders.querySelectorAll('output').forEach(o => o.textContent = G.fmt.n(pesos[o.dataset.salida] / total * 100,1) + ' %');
    });
    document.querySelectorAll('#dgTop a').forEach(x => x.onclick = e => { e.preventDefault(); A = x.dataset.p; render(); });
  }

  window.DIAGNOSTICO = {
    init(L) {
      const d = L.datos.distritos; if (!d) { $('#diagnostico').innerHTML = '<div class="card">Falta lago/distritos.json</div>'; return; }
      D = d.datos.map(x => Object.assign({}, x)); percentiles();
      A = ranking('equilibrio')[0].puma; B = (D.find(x => x.puma === '4306') || D[1]).puma;
      render();
    },
    elegir(puma) { if (porId(puma)) { A = puma; render(); } },
    puntaje: (puma, pf = perfil) => { const d = porId(puma); return d ? puntaje(d, pf) : null; },
    rango: (puma, pf = perfil) => { const d = porId(puma); return d ? rango(d, pf) : null; },
    personalizar(p) {
      if (Object.keys(p).some(k => !DIM[k] || !ANALISIS.valido(p[k]) || p[k] < 0)) return;
      pesos = Object.fromEntries(Object.keys(DIM).map(k => [k, p[k] || 0]));
      perfil = 'personalizado'; render(); notificar();
    },
    perfil: nombrePerfil,
    DIM,
  };
})();
