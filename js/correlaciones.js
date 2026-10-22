// Explorador de asociaciones entre los 55 distritos (Pearson, Spearman, valor p y corrección por comparaciones múltiples)
// y Atlas con margen de error. Métricas, unidades y fuentes salen de lago/distritos.json: se definen una sola vez.
(function () {
  const $ = s => document.querySelector(s);
  // Decisión de gobierno: la composición étnica no entra al explorador de correlaciones (ver README, «Qué decidimos no mostrar»)
  const FUERA = new Set(['poblacion_acs', 'pct_hispano', 'pct_blanco_nh', 'pct_negro_nh', 'pct_asiatico_nh']);
  const PRESETS = [
    ['pct_pobreza', 'pm25', 'Justicia ambiental: ¿respiran peor aire los distritos más pobres?'],
    ['pct_pobreza', 'delitos_graves_por_1000', 'Pobreza y delitos graves'],
    ['pct_pobreza', 'viviendas_asequibles_por_1000', '¿Llega la vivienda asequible a los distritos más pobres?'],
    ['pct_hogares_con_carga_alquiler', 'viviendas_asequibles_por_1000', '¿…y a donde más pesa el alquiler?'],
    ['ingreso_mediano', 'arboles_calle_por_km2', 'Ingreso y arbolado'],
    ['pct_transporte_publico', 'heridos_transito_por_10000', 'Transporte público y heridos de tránsito'],
  ];
  const fuerza = r => { const a = Math.abs(r); return a >= .8 ? 'muy fuerte' : a >= .6 ? 'fuerte' : a >= .4 ? 'moderada' : a >= .2 ? 'débil' : 'muy débil o nula'; };
  const min = t => t.replace(/^\p{Lu}(?=\p{Ll})/u, c => c.toLowerCase());   // solo la inicial: conserva siglas (HPD, PM2,5)

  function render() {
    const D = LG.distritos(); if (!D.length) return;
    const M = LG.metricas().filter(m => !FUERA.has(m.k));
    const meta = Object.fromEntries(M.map(m => [m.k, m]));
    const fv = (v, k) => meta[k].unidad.startsWith('US$') ? G.fmt.usd(v) : G.fmt.n(v, Math.abs(v) >= 100 ? 0 : (meta[k].decimales ?? 1)) + (meta[k].unidad === '%' ? ' %' : '');
    const SIN_MID = D.filter(p => p.puma !== '4165');
    // todos los pares, con valor p y q de Benjamini-Hochberg
    const pares = [];
    for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
      const a = M[i].k, b = M[j].k, Q = SIN_MID.filter(p => p[a] != null && p[b] != null); if (Q.length < 20) continue;
      const r = G.pearson(Q.map(p => p[a]), Q.map(p => p[b]));
      pares.push({ a, b, r, rs: G.spearman(Q.map(p => p[a]), Q.map(p => p[b])), n: Q.length, p: G.pValor(r, Q.length) });
    }
    const q = ANALISIS.benjaminiHochberg(pares.map(x => x.p)); pares.forEach((x, i) => x.q = q[i]);
    const sig = pares.filter(x => x.p < .05).length, sobreviven = pares.filter(x => x.q < .05).length;
    const qDe = (a, b) => (pares.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || {}).q;

    let X = PRESETS[0][0], Y = PRESETS[0][1], sinMidtown = true, foco = null;
    $('#correlacionesLead').innerHTML = `Cruza <b>${M.length} variables</b> de los <b>${D.length} distritos</b>: ${G.fmt.n(pares.length)} pares posibles. Con tantas comparaciones, el azar solo produce «hallazgos»: al 5 % se esperarían unos <b>${G.fmt.n(pares.length * .05)}</b> pares significativos aunque ninguna variable tuviera que ver con otra. Hay ${sig} con p < 0,05; tras corregir por comparaciones múltiples (Benjamini-Hochberg, q < 0,05) quedan <b>${sobreviven}</b>. <b>Correlación no implica causalidad</b>: úsala para formular preguntas.`;
    const g = $('#correlacionesGrid');
    const ex = G.card(g, 'Explorador de relaciones', 'elige dos variables · cada punto es un distrito · las líneas son el margen de error del ACS', { ancha: true, prov: LG.prov(LG.lista('distritos', 'distritos')) });
    ex.cuerpo.innerHTML = `<div class="chips" id="corrPresets">${PRESETS.map((p, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-i="${i}">${p[2]}</button>`).join('')}</div>
      <div class="fila-ctrl" style="margin-top:12px"><label class="campo">Eje horizontal<select id="corrX">${M.map(m => `<option value="${m.k}">${G.esc(m.etiqueta)}</option>`).join('')}</select></label><button class="btn-ic" id="corrSwap" aria-label="Intercambiar ejes">⇄</button><label class="campo">Eje vertical<select id="corrY">${M.map(m => `<option value="${m.k}">${G.esc(m.etiqueta)}</option>`).join('')}</select></label>
      <label class="campo" style="flex:0 0 auto;flex-direction:row;align-items:center;gap:6px;text-transform:none;font-size:12px;letter-spacing:0"><input type="checkbox" id="corrMid" checked> excluir Midtown (población flotante)</label></div>
      <div class="tiles" id="corrStats" style="margin-top:14px"></div><div id="corrPlot" style="margin-top:8px"></div><div id="corrLectura" class="nota"></div>`;
    G.leyenda(ex.cuerpo, Object.entries(G.BORO_COLOR).map(([n, c]) => ({ nombre: n, color: c })));
    ex.nota('Pearson mide relación lineal; Spearman, relación monótona por rangos (menos sensible a extremos). Valor p bilateral con t de Student y n−2 grados de libertad; q es el valor p corregido por todas las comparaciones del explorador.');

    function pintar() {
      $('#corrX').value = X; $('#corrY').value = Y;
      const P = D.filter(p => p[X] != null && p[Y] != null && !(sinMidtown && p.puma === '4165'));
      const xs = P.map(p => p[X]), ys = P.map(p => p[Y]);
      const r = G.pearson(xs, ys), rs = G.spearman(xs, ys), pv = G.pValor(r, P.length), qv = qDe(X, Y);
      const prov = LG.unir(`${meta[X].etiqueta} y ${meta[Y].etiqueta}`, LG.provMetrica(X), LG.provMetrica(Y));
      const pc = Object.assign({}, prov, { tipo: 'derivado', formula: 'Coeficientes calculados en el navegador con las 55 filas del atlas (o 54 sin Midtown)' });
      const st = $('#corrStats'); st.innerHTML = '';
      G.tile(st, { valor: G.fmt.n(r, 2), etiqueta: `Pearson · relación ${fuerza(r)}`, prov: pc });
      G.tile(st, { valor: G.fmt.n(rs, 2), etiqueta: `Spearman · ${fuerza(rs)}`, prov: pc });
      G.tile(st, { valor: pv < .001 ? '< 0,001' : G.fmt.n(pv, 3), etiqueta: pv < .05 ? 'valor p · significativa al 5 % (sin corregir)' : 'valor p · no significativa al 5 %', prov: pc });
      G.tile(st, { valor: qv == null ? '—' : qv < .001 ? '< 0,001' : G.fmt.n(qv, 3), etiqueta: qv != null && qv < .05 ? `q · sobrevive a ${G.fmt.n(pares.length)} comparaciones` : `q · no sobrevive a ${G.fmt.n(pares.length)} comparaciones`, prov: pc });
      const plot = $('#corrPlot'); plot.innerHTML = '';
      G.dispersion(plot, P.map(p => ({ x: p[X], y: p[Y], ex: LG.moe(p, X), ey: LG.moe(p, Y), nombre: p.nombre, color: G.BORO_COLOR[p.borough], destacado: p.puma === foco,
        tip: `<b>${G.esc(p.nombre)}</b> · ${G.esc(p.borough)}<br>${G.esc(meta[X].etiqueta)}: ${fv(p[X], X)}${LG.moe(p, X) != null ? ' ± ' + G.fmt.n(LG.moe(p, X), 1) : ''}<br>${G.esc(meta[Y].etiqueta)}: ${fv(p[Y], Y)}${LG.moe(p, Y) != null ? ' ± ' + G.fmt.n(LG.moe(p, Y), 1) : ''}`, onclick: () => { foco = p.puma; pintar(); } })),
        { ejeX: `${meta[X].etiqueta} (${meta[X].unidad}) · ${LG.ids(meta[X].fuente).join('+')}`, ejeY: `${meta[Y].etiqueta} (${meta[Y].unidad})`, fmtX: v => fv(v, X), fmtY: v => fv(v, Y) });
      const dir = r > 0 ? 'tienden a tener <b>más</b>' : 'tienden a tener <b>menos</b>';
      $('#corrLectura').innerHTML = Math.abs(r) < .2 ? `No se observa una relación lineal clara entre ${G.esc(min(meta[X].etiqueta))} y ${G.esc(min(meta[Y].etiqueta))}.` :
        `Los distritos con más ${G.esc(min(meta[X].etiqueta))} ${dir} ${G.esc(min(meta[Y].etiqueta))} (r = ${G.fmt.n(r, 2)}, relación ${fuerza(r)}). r² = ${G.fmt.n(r * r * 100, 0)} %: esa es la parte de la variación que acompaña a la otra variable, no la que «causa».${qv != null && qv >= .05 ? ' <b>Ojo: no sobrevive a la corrección por comparaciones múltiples</b>; podría ser azar.' : ''}${Math.abs(r - rs) > .15 ? ' Pearson y Spearman difieren bastante: hay distritos extremos que pesan mucho.' : ''}`;
    }
    $('#corrPresets').querySelectorAll('.chip').forEach(c => c.onclick = () => { const p = PRESETS[c.dataset.i]; X = p[0]; Y = p[1]; $('#corrPresets').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); pintar(); });
    $('#corrX').onchange = e => { X = e.target.value; pintar(); }; $('#corrY').onchange = e => { Y = e.target.value; pintar(); };
    $('#corrSwap').onclick = () => { [X, Y] = [Y, X]; pintar(); }; $('#corrMid').onchange = e => { sinMidtown = e.target.checked; pintar(); };
    pintar();

    pares.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    const top = G.card(g, 'Las asociaciones más fuertes', `de ${G.fmt.n(pares.length)} pares · sin Midtown · q corregido por Benjamini-Hochberg`, { ancha: true });
    G.tabla(top.cuerpo, [{ k: 'va', t: 'Variable A' }, { k: 'vb', t: 'Variable B' }, { k: 'r', t: 'Pearson', num: 1, d: 2 }, { k: 'rs', t: 'Spearman', num: 1, d: 2 }, { k: 'q', t: 'q', num: 1, f: v => v < .001 ? '< 0,001' : G.fmt.n(v, 3) }, { k: 'f', t: 'Lectura' }],
      pares.slice(0, 14).map(p => ({ va: meta[p.a].etiqueta, vb: meta[p.b].etiqueta, r: p.r, rs: p.rs, q: p.q, f: (p.r > 0 ? 'positiva ' : 'negativa ') + fuerza(p.r), a: p.a, b: p.b })),
      { orden: null, fila: f => `style="cursor:pointer" data-a="${f.a}" data-b="${f.b}"`, despues: t => t.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => { X = tr.dataset.a; Y = tr.dataset.b; pintar(); document.getElementById('correlaciones').scrollIntoView({ behavior: 'smooth' }); }) });
    top.nota('Varias asociaciones fuertes son casi por construcción (inquilinos y hogares sin auto miden cosas parecidas). Las que importan para decidir son las que cruzan temas, y aun así describen asociaciones entre distritos, no efectos sobre personas (falacia ecológica).');
    atlas();
  }

  function atlas() {
    const D = LG.distritos(), g = $('#atlasGrid');
    $('#atlasLead').innerHTML = `Cada fila es un distrito (PUMA 2020). Haz clic en un encabezado para ordenar, en ⓘ para ver de dónde sale la columna, o en una fila para ubicarla en el gemelo. El número pequeño es el margen de error al 90 %. <b>La columna «Grupo» reemplaza al puesto</b>: dentro de un grupo, el margen de error no permite decir quién va primero.`;
    const R = Object.fromEntries(DIAGNOSTICO.grupos().flatMap(gr => gr.miembros.map(m => [m, gr])));
    const filas = D.map(p => Object.assign({ atencion: DIAGNOSTICO.puntaje(p.puma), grupo: R[p.puma]?.grupo, intervalo: DIAGNOSTICO.intervalo(p.puma) }, p));
    const conMoe = (k, dec) => ({ k, t: LG.metrica(k).etiqueta, num: 1, prov: LG.provMetrica(k), f: (v, f) => v == null ? '—' : `${LG.metrica(k).unidad.startsWith('US$') ? G.fmt.usd(v) : G.fmt.n(v, dec)}${LG.moe(f, k) != null ? `<small class="moe"> ±${G.fmt.n(LG.moe(f, k), dec || 1)}</small>` : ''}` });
    const c = G.card(g, 'Atlas de los 55 distritos', 'ordenable · ± margen de error al 90 % · clic en una fila para ubicarla en el mapa', { ancha: true, prov: LG.prov(LG.lista('distritos', 'distritos')) });
    G.tabla(c.cuerpo, [
      { k: 'nombre', t: 'Distrito', wrap: 1 }, { k: 'borough', t: 'Borough' },
      { k: 'grupo', t: 'Grupo', num: 1, ayuda: 'Grupo de atención (prioridad actual del diagnóstico); dentro de un grupo no hay orden', f: (v, f) => v ? `${v} <small class="moe">${DIAGNOSTICO.textoRango(f.intervalo)}</small>` : '—' },
      conMoe('ingreso_mediano', 0), conMoe('pct_hogares_con_carga_alquiler', 1), conMoe('pct_pobreza', 1),
      conMoe('solicitudes_311_por_1000', 0), conMoe('delitos_graves_por_1000', 1), conMoe('heridos_transito_por_10000', 1),
      { k: 'pm25', t: 'PM2,5', num: 1, d: 2, prov: LG.provMetrica('pm25') }, conMoe('pct_transporte_publico', 1), conMoe('viviendas_asequibles_por_1000', 1),
    ], filas, { orden: 'grupo', dir: 1, alto: 560, fila: f => `style="cursor:pointer" data-p="${f.puma}"`, despues: t => t.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => window.MAPA && MAPA.irA({ puma: tr.dataset.p })) });
    c.nota('Ordenar por una columna es útil para explorar, pero dos filas vecinas cuya diferencia cabe en la suma de sus márgenes no se distinguen. PM2,5 no publica margen de error. Midtown (MN 5&6) tiene mucha población flotante: sus tasas por residente se leen con cautela.');

    const B = LG.filas('demografia', 'boroughs'); if (!B.length) return;
    const pb = k => LG.provCol('demografia', 'boroughs', k);
    const c2 = G.card(g, 'Los cinco boroughs', 'Censo 2020 + ACS 2020–2024', { ancha: true, prov: LG.prov(LG.lista('demografia', 'boroughs')) });
    const mb = (k, dec) => (v, f) => `${k === 'ingreso_mediano' || k === 'alquiler_mediano' ? G.fmt.usd(v) : G.fmt.n(v, dec)}<small class="moe"> ±${G.fmt.n(f[k + '_moe'], dec)}</small>`;
    G.tabla(c2.cuerpo, [{ k: 'borough', t: 'Borough' }, { k: 'poblacion_2020', t: 'Población 2020', num: 1, prov: pb('poblacion_2020') }, { k: 'superficie_mi2', t: 'Superficie mi²', num: 1, d: 1, prov: pb('superficie_mi2') },
      { k: 'densidad_hab_mi2', t: 'Densidad /mi²', num: 1, prov: pb('densidad_hab_mi2') }, { k: 'ingreso_mediano', t: 'Ingreso mediano', num: 1, f: mb('ingreso_mediano', 0), prov: pb('ingreso_mediano') },
      { k: 'alquiler_mediano', t: 'Alquiler', num: 1, f: mb('alquiler_mediano', 0), prov: pb('alquiler_mediano') }, { k: 'pct_pobreza', t: 'Pobreza %', num: 1, f: mb('pct_pobreza', 1), prov: pb('pct_pobreza') },
      { k: 'estaciones', t: 'Paradas', num: 1, prov: pb('estaciones') }], B, { orden: 'poblacion_2020' });
  }

  window.CORRELACIONES = { render };
})();
