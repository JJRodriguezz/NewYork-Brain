// Explorador de asociaciones entre los 55 distritos (Pearson, Spearman y valor p) + Atlas ordenable.
// Conserva los valores originales y evita lenguaje causal.
(function () {
  const $ = s => document.querySelector(s);
  const M = [
    ['ingreso_mediano', 'Ingreso mediano del hogar', 'US$', 'F10'], ['alquiler_mediano', 'Alquiler mediano', 'US$/mes', 'F10'],
    ['pct_hogares_con_carga_alquiler', 'Hogares con carga de alquiler', '%', 'F10'], ['pct_pobreza', 'Pobreza', '%', 'F10'],
    ['pct_inquilinos', 'Hogares inquilinos', '%', 'F10'], ['pct_transporte_publico', 'Van al trabajo en transporte público', '%', 'F10'],
    ['pct_hogares_sin_auto', 'Hogares sin auto', '%', 'F10'], ['pct_nacidos_extranjero', 'Nacidos en el extranjero', '%', 'F10'],
    ['pct_teletrabajo', 'Trabajan desde casa', '%', 'F10'], ['edad_mediana', 'Edad mediana', 'años', 'F10'],
    ['densidad_hab_km2', 'Densidad', 'hab/km²', 'F10, F19'], ['solicitudes_311_por_1000', 'Solicitudes 311', 'por 1.000 hab.', 'F03'],
    ['delitos_por_1000', 'Delitos denunciados', 'por 1.000 hab.', 'F04'], ['delitos_graves_por_1000', 'Delitos graves', 'por 1.000 hab.', 'F04'],
    ['heridos_transito_por_10000', 'Heridos de tránsito', 'por 10.000 hab.', 'F02'], ['peatones_heridos_por_10000', 'Peatones heridos', 'por 10.000 hab.', 'F02'],
    ['pm25', 'PM2,5', 'µg/m³', 'F15'], ['no2', 'NO₂', 'ppb', 'F15'], ['arboles_calle_por_km2', 'Árboles de calle (2015)', 'por km²', 'F07'],
    ['viviendas_obra_nueva_por_1000', 'Viviendas propuestas 2025', 'por 1.000 hab.', 'F05'], ['viviendas_asequibles_por_1000', 'Viviendas asequibles HPD', 'por 1.000 hab.', 'F16'],
  ];
  const PRESETS = [
    ['ingreso_mediano', 'pm25', 'Justicia ambiental: ¿respiran peor aire los distritos más pobres?'],
    ['pct_pobreza', 'delitos_graves_por_1000', 'Pobreza y delitos graves'],
    ['ingreso_mediano', 'arboles_calle_por_km2', 'Ingreso y arbolado'],
    ['pct_pobreza', 'viviendas_asequibles_por_1000', '¿Llega la vivienda asequible a los distritos más pobres?'],
    ['pct_hogares_con_carga_alquiler', 'viviendas_asequibles_por_1000', '¿…y a donde más pesa el alquiler?'],
    ['pct_transporte_publico', 'heridos_transito_por_10000', 'Transporte público y heridos de tránsito'],
    ['densidad_hab_km2', 'solicitudes_311_por_1000', 'Densidad y quejas 311'],
  ];
  const meta = Object.fromEntries(M.map(m => [m[0], { k: m[0], nombre: m[1], unidad: m[2], fuente: m[3] }]));
  const min = t => t.replace(/^\p{Lu}(?=\p{Ll})/u, c => c.toLowerCase());   // solo la inicial: conserva siglas (HPD, PM2,5)
  const fuerza = r => { const a = Math.abs(r); return a >= .8 ? 'muy fuerte' : a >= .6 ? 'fuerte' : a >= .4 ? 'moderada' : a >= .2 ? 'débil' : 'muy débil o nula'; };
  const fv = (v, k) => meta[k].unidad.startsWith('US$') ? G.fmt.usd(v) : G.fmt.n(v, Math.abs(v) >= 100 ? 0 : 1) + (meta[k].unidad === '%' ? ' %' : '');

  function render(L) {
    const d = L.datos.distritos; if (!d) return;
    const D = d.datos; let X = PRESETS[0][0], Y = PRESETS[0][1], sinMidtown = true, foco = null;
    $('#correlacionesLead').innerHTML = `Cruza <b>${M.length} variables reales</b> de los <b>${D.length} distritos comunitarios</b>: ingreso, vivienda, transporte, servicios, seguridad, tránsito y ambiente. Con n = 55 ya se puede estimar la fuerza de una asociación y su incertidumbre (la versión anterior, con solo 5 boroughs, no podía). <b>Correlación no implica causalidad</b>: úsala para formular preguntas, no para concluir.`;
    const g = $('#correlacionesGrid');
    const ex = G.card(g, 'Explorador de relaciones', 'elige dos variables · cada punto es un distrito · color = borough', { ancha: true });
    ex.cuerpo.innerHTML = `<div class="chips" id="corrPresets">${PRESETS.map((p, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-i="${i}">${p[2]}</button>`).join('')}</div>
      <div class="fila-ctrl" style="margin-top:12px"><label class="campo">Eje horizontal<select id="corrX">${M.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></label><button class="btn-ic" id="corrSwap" aria-label="Intercambiar ejes">⇄</button><label class="campo">Eje vertical<select id="corrY">${M.map(m => `<option value="${m[0]}">${m[1]}</option>`).join('')}</select></label>
      <label class="campo" style="flex:0 0 auto;flex-direction:row;align-items:center;gap:6px;text-transform:none;font-size:12px;letter-spacing:0"><input type="checkbox" id="corrMid" checked> excluir Midtown (población flotante)</label></div>
      <div class="tiles" id="corrStats" style="margin-top:14px"></div><div id="corrPlot" style="margin-top:8px"></div><div id="corrLectura" class="nota"></div>`;
    G.leyenda(ex.cuerpo, Object.entries(G.BORO_COLOR).map(([n, c]) => ({ nombre: n, color: c })));
    ex.fuente('Fuente: lago/distritos.json (atlas construido desde F02, F03, F04, F05, F07, F10, F15, F16, F19). Pearson mide relación lineal; Spearman, relación monótona por rangos (menos sensible a extremos). Valor p bilateral con t de Student, n−2 grados de libertad.');

    function pintar() {
      $('#corrX').value = X; $('#corrY').value = Y;
      const P = D.filter(p => p[X] != null && p[Y] != null && !(sinMidtown && p.puma === '4165'));
      const xs = P.map(p => p[X]), ys = P.map(p => p[Y]);
      const r = G.pearson(xs, ys), rs = G.spearman(xs, ys), pv = G.pValor(r, P.length);
      const st = $('#corrStats'); st.innerHTML = '';
      G.tile(st, { valor: G.fmt.n(r, 2), etiqueta: `Pearson · relación ${fuerza(r)}`, estado: 'derivado', fuente: 'cálculo propio' });
      G.tile(st, { valor: G.fmt.n(rs, 2), etiqueta: `Spearman · ${fuerza(rs)}`, estado: 'derivado', fuente: 'cálculo propio' });
      G.tile(st, { valor: pv < .001 ? '< 0,001' : G.fmt.n(pv, 3), etiqueta: pv < .05 ? 'valor p · significativa al 5 %' : 'valor p · no significativa al 5 %', estado: 'derivado', fuente: 'cálculo propio' });
      G.tile(st, { valor: G.fmt.n(P.length), etiqueta: 'distritos con dato en ambas variables', estado: 'observado', fuente: 'atlas' });
      const plot = $('#corrPlot'); plot.innerHTML = '';
      G.dispersion(plot, P.map(p => ({ x: p[X], y: p[Y], nombre: p.nombre, color: G.BORO_COLOR[p.borough], destacado: p.puma === foco,
        tip: `<b>${G.esc(p.nombre)}</b> · ${G.esc(p.borough)}<br>${meta[X].nombre}: ${fv(p[X], X)}<br>${meta[Y].nombre}: ${fv(p[Y], Y)}`, onclick: () => { foco = p.puma; pintar(); } })),
        { ejeX: `${meta[X].nombre} (${meta[X].unidad}) · ${meta[X].fuente}`, ejeY: `${meta[Y].nombre} (${meta[Y].unidad})`, fmtX: v => fv(v, X), fmtY: v => fv(v, Y) });
      const dir = r > 0 ? 'tienden a tener <b>más</b>' : 'tienden a tener <b>menos</b>';
      $('#corrLectura').innerHTML = Math.abs(r) < .2 ? `No se observa una relación lineal clara entre ${min(meta[X].nombre)} y ${min(meta[Y].nombre)}.` :
        `Los distritos con más ${min(meta[X].nombre)} ${dir} ${min(meta[Y].nombre)} (r = ${G.fmt.n(r, 2)}, relación ${fuerza(r)}). r² = ${G.fmt.n(r * r * 100, 0)} %: esa es la parte de la variación que acompaña a la otra variable, no la que “causa”.${Math.abs(r - rs) > .15 ? ' Pearson y Spearman difieren bastante: hay distritos extremos que pesan mucho; revisa los puntos aislados.' : ''}`;
    }
    $('#corrPresets').querySelectorAll('.chip').forEach(c => c.onclick = () => { const p = PRESETS[c.dataset.i]; X = p[0]; Y = p[1]; $('#corrPresets').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); pintar(); });
    $('#corrX').onchange = e => { X = e.target.value; pintar(); }; $('#corrY').onchange = e => { Y = e.target.value; pintar(); };
    $('#corrSwap').onclick = () => { [X, Y] = [Y, X]; pintar(); }; $('#corrMid').onchange = e => { sinMidtown = e.target.checked; pintar(); };
    pintar();

    // relaciones más fuertes entre todos los pares
    const P = D.filter(p => p.puma !== '4165'); const pares = [];
    for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) { const a = M[i][0], b = M[j][0]; const Q = P.filter(p => p[a] != null && p[b] != null); if (Q.length < 20) continue; const r = G.pearson(Q.map(p => p[a]), Q.map(p => p[b])); pares.push({ a, b, r, rs: G.spearman(Q.map(p => p[a]), Q.map(p => p[b])), n: Q.length }); }
    pares.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
    const top = G.card(g, 'Las 12 asociaciones más fuertes', `de ${pares.length} pares posibles · sin Midtown`, { ancha: true });
    G.tabla(top.cuerpo, [{ k: 'va', t: 'Variable A' }, { k: 'vb', t: 'Variable B' }, { k: 'r', t: 'Pearson', num: 1, d: 2 }, { k: 'rs', t: 'Spearman', num: 1, d: 2 }, { k: 'f', t: 'Lectura' }, { k: 'n', t: 'n', num: 1 }],
      pares.slice(0, 12).map(p => ({ va: meta[p.a].nombre, vb: meta[p.b].nombre, r: p.r, rs: p.rs, f: (p.r > 0 ? 'positiva ' : 'negativa ') + fuerza(p.r), n: p.n, a: p.a, b: p.b })),
      { orden: null, fila: f => `style="cursor:pointer" data-a="${f.a}" data-b="${f.b}"`, despues: t => t.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => { X = tr.dataset.a; Y = tr.dataset.b; pintar(); document.getElementById('correlaciones').scrollIntoView({ behavior: 'smooth' }); }) });
    top.nota('Varias asociaciones fuertes son casi por construcción (p. ej. transporte público y hogares sin auto miden cosas parecidas). Las interesantes para gobernanza son las que cruzan temas: la pobreza acompaña a los delitos graves (r ≈ 0,6) y a la vivienda asequible financiada por HPD (r ≈ 0,7), mientras que el aire y el arbolado casi no se relacionan con el ingreso (|r| < 0,35).');

    atlas(L);
  }

  function atlas(L) {
    const D = L.datos.distritos.datos, g = $('#atlasGrid');
    $('#atlasLead').innerHTML = `Cada fila es un distrito comunitario (PUMA 2020). Haz clic en un encabezado para ordenar, o en una fila para verla en el gemelo. Las tasas usan la población del ACS de cada distrito; 311, choques y delitos son de 2025, el ACS es el promedio 2020–2024, el aire es de ${L.datos.ambiente ? L.datos.ambiente.aire_ultimo_anio : 'el último año'} y los árboles de 2015.`;
    const c = G.card(g, 'Atlas de los 55 distritos comunitarios', 'ordenable · clic en una fila para ubicarla en el mapa', { ancha: true });
    const filas = D.map(p => Object.assign({ atencion: DIAGNOSTICO.puntaje(p.puma) }, p));
    G.tabla(c.cuerpo, [
      { k: 'nombre', t: 'Distrito', wrap: 1 }, { k: 'borough', t: 'Borough' }, { k: 'atencion', t: 'Atención', num: 1, barra: 1, ayuda: 'Índice del diagnóstico, prioridad equilibrio (0–100)' },
      { k: 'poblacion_acs', t: 'Población', num: 1 }, { k: 'ingreso_mediano', t: 'Ingreso', num: 1, f: v => G.fmt.usd(v) },
      { k: 'pct_hogares_con_carga_alquiler', t: 'Carga alq. %', num: 1, d: 1, barra: 1 }, { k: 'pct_pobreza', t: 'Pobreza %', num: 1, d: 1 },
      { k: 'solicitudes_311_por_1000', t: '311 /1k', num: 1, barra: 1 }, { k: 'delitos_graves_por_1000', t: 'Graves /1k', num: 1, d: 1 },
      { k: 'heridos_transito_por_10000', t: 'Heridos /10k', num: 1, d: 1 }, { k: 'pm25', t: 'PM2,5', num: 1, d: 2 },
      { k: 'pct_transporte_publico', t: 'Transp. púb. %', num: 1, d: 1 }, { k: 'viviendas_asequibles_por_1000', t: 'Aseq. /1k', num: 1, d: 1 },
    ], filas, { orden: 'atencion', dir: -1, alto: 560, fila: f => `style="cursor:pointer" data-p="${f.puma}"`, despues: t => t.querySelectorAll('tbody tr').forEach(tr => tr.onclick = () => window.MAPA && MAPA.irA({ puma: tr.dataset.p })) });
    c.fuente('Fuente: lago/distritos.json · ACS 2020–2024 vía Census Reporter (F10), 311 (F03), NYPD (F02, F04), NYCCAS (F15), HPD (F16). Población flotante: Midtown (MN 5&6) se lee con cautela.');

    const B = L.datos.demografia; if (!B) return;
    const c2 = G.card(g, 'Los cinco boroughs', 'Censo 2020 + ACS 2020–2024', { ancha: true });
    G.tabla(c2.cuerpo, [{ k: 'borough', t: 'Borough' }, { k: 'condado', t: 'Condado' }, { k: 'poblacion_2020', t: 'Población 2020', num: 1 }, { k: 'superficie_mi2', t: 'Superficie mi²', num: 1, d: 1 },
      { k: 'densidad_hab_mi2', t: 'Densidad /mi²', num: 1 }, { k: 'ingreso_mediano', t: 'Ingreso mediano', num: 1, f: (v, f) => G.fmt.usd(v) + ` <small style="color:var(--muted)">±${G.fmt.n(f.ingreso_mediano_moe)}</small>` },
      { k: 'alquiler_mediano', t: 'Alquiler', num: 1, f: v => G.fmt.usd(v) }, { k: 'pct_pobreza', t: 'Pobreza %', num: 1, d: 1 }, { k: 'estaciones_subte', t: 'Estaciones', num: 1 }], B.datos, { orden: 'poblacion_2020' });
    c2.fuente('Población: Censo 2020, NYC DCP (F09, transcrita). Superficie: polígonos oficiales DCP (F20). Ingreso, alquiler y pobreza: ACS 2020–2024 con margen de error al 90 % (F10). Estaciones: MTA (F18).');
  }

  window.CORRELACIONES = { render };
})();
