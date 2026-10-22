// Secciones temáticas. Todo sale del lago con la forma del contrato: cada tile y cada gráfico llevan su procedencia
// (fuente con ID, vigencia, fecha de prueba, tipo) a un clic. Las cifras de la prosa se calculan; ninguna se teclea.
(function () {
  const $ = s => document.querySelector(s);
  const { fmt, esc, BORO_COLOR } = G;
  const BOROS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
  const por = (filas, k = 'borough') => Object.fromEntries(filas.map(x => [x[k], x]));
  const grid = id => $('#' + id);

  // formato según la unidad declarada en el lago
  function fmtU(v, u, dec) {
    if (v == null) return '—';
    if (typeof v !== 'number') return esc(v);
    if (u === 'US$') return Math.abs(v) >= 1e9 ? 'US$ ' + fmt.n(v / 1e9, 1) + ' mil M' : Math.abs(v) >= 1e6 ? 'US$ ' + fmt.n(v / 1e6, 1) + ' M' : fmt.usd(v);
    if (u && u.startsWith('US$')) return fmt.usd(v);
    if (u === '%') return fmt.n(v, dec ?? 1) + ' %';
    if (Math.abs(v) >= 1e6) return fmt.k(v);
    return fmt.n(v, dec ?? (Number.isInteger(v) ? 0 : 1));
  }
  // tile desde una cifra del lago
  function T(cont, tema, k, etiqueta, o = {}) {
    const c = LG.cifra(tema, k); if (!c) return null;
    return G.tile(cont, { valor: o.valor || fmtU(c.valor, c.unidad, c.decimales), unidad: o.unidad, etiqueta: etiqueta || esc(c.descripcion), prov: LG.provCifra(tema, k), moe: c.moe });
  }
  // tile con un número calculado aquí, a partir de una columna del lago (queda marcado como derivado y con su fórmula)
  function TD(cont, valor, etiqueta, base, formula, extra = {}) {
    return G.tile(cont, { valor, etiqueta, prov: Object.assign({}, base, { tipo: extra.tipo || (base && base.tipo === 'medido' ? 'derivado' : base && base.tipo), formula }), moe: extra.moe });
  }
  const colProv = (t, l, c) => LG.provCol(t, l, c);
  const listaProv = (t, l) => LG.provLista(t, l);

  // ------------------------------------------------------------------ panorama
  function panorama() {
    const t = $('#panoramaTiles');
    T(t, 'demografia', 'poblacion_2020', 'habitantes (Censo 2020)');
    const g = LG.L.geo.distritos_puma;
    const nPuma = (g?.features || []).length, nCD = (g?.features || []).reduce((a, f) => a + f.properties.distritos_comunitarios.length, 0);
    TD(t, String(nPuma), `distritos (PUMA) que agrupan los ${nCD} distritos comunitarios`, LG.prov(g?.columnas?.puma), 'Conteo de polígonos PUMA oficiales de NYC y de los distritos comunitarios que agrupa cada uno', { tipo: 'medido' });
    T(t, 'calidad_de_vida_311', 'solicitudes_2025', 'solicitudes al 311 en 2025');
    T(t, 'seguridad_delitos', 'denuncias_2025', 'delitos denunciados en 2025');
    T(t, 'seguridad_vial', 'fallecidos_2025', 'muertes en el tránsito en 2025');
    T(t, 'movilidad', 'subte_ultimo_mes', `viajes diarios en subte (${esc(LG.cifra('movilidad', 'subte_ultimo_mes')?.vigencia || '')})`);
    T(t, 'declarados', 'visitantes_2025', 'visitantes en 2025, según NYC Tourism + Conventions');
    const F = LG.fuentes();
    G.tile(t, { valor: `${F.filter(x => x.estado_catalogo === 'Integrada al lago').length}/${F.length}`, etiqueta: 'fuentes integradas / catalogadas', prov: { tipo: 'derivado', descripcion: 'Conteo del catálogo de fuentes', vigencia: 'catálogo vigente', fuentes: [], formula: 'Filas del catálogo con estado «Integrada al lago» sobre el total (ver Fuentes y gobernanza)' } });
  }

  // ------------------------------------------------------------------ gente
  function gente() {
    const B = por(LG.filas('demografia', 'boroughs')), tot = LG.valor('demografia', 'poblacion_2020'); if (!tot) return;
    const mayor = [...Object.values(B)].sort((a, b) => b.poblacion_2020 - a.poblacion_2020)[0];
    const pBoro = colProv('demografia', 'boroughs', 'poblacion_2020');
    $('#genteTitulo').textContent = `${fmt.n(tot)} personas, cinco realidades`;
    const ext = Object.values(B).reduce((a, x) => a + x.pct_nacidos_extranjero * x.poblacion_acs, 0) / Object.values(B).reduce((a, x) => a + x.poblacion_acs, 0);
    const maxGrupo = Math.max(...['pct_hispano', 'pct_blanco_nh', 'pct_negro_nh', 'pct_asiatico_nh'].map(k => Object.values(B).reduce((a, x) => a + x[k] * x.poblacion_acs, 0) / Object.values(B).reduce((a, x) => a + x.poblacion_acs, 0)));
    $('#genteLead').innerHTML = `${esc(mayor.borough)} concentra el ${fmt.n(mayor.poblacion_2020 / tot * 100, 1)} % de la ciudad y Staten Island apenas el ${fmt.n(B['Staten Island'].poblacion_2020 / tot * 100, 1)} %. El ${fmt.n(ext, 1)} % de los neoyorquinos nació fuera de EE. UU. y ningún grupo étnico pasa del ${fmt.n(Math.ceil(maxGrupo), 0)} %: ninguno es mayoría.`;
    const t = $('#genteTiles');
    TD(t, fmt.n(B.Manhattan.densidad_hab_mi2), 'hab/mi² en Manhattan, la mayor densidad de los cinco', colProv('demografia', 'boroughs', 'densidad_hab_mi2'), 'poblacion_2020 ÷ superficie terrestre (F09, F20)');
    TD(t, fmt.pct(ext), 'nacidos en el extranjero (promedio ponderado por población)', colProv('demografia', 'boroughs', 'pct_nacidos_extranjero'), 'Σ(% × población ACS) ÷ Σ población ACS de los 5 boroughs');
    G.tile(t, { valor: fmt.pct(B.Queens.pct_nacidos_extranjero), moe: fmt.n(B.Queens.pct_nacidos_extranjero_moe, 1), etiqueta: 'de Queens nació en otro país', prov: colProv('demografia', 'boroughs', 'pct_nacidos_extranjero') });
    const g = grid('genteGrid');
    const c1 = G.card(g, 'Población por borough', 'Censo 2020 · personas', { prov: pBoro });
    G.barras(c1.cuerpo, Object.values(B).sort((a, b) => b.poblacion_2020 - a.poblacion_2020).map(x => ({ etiqueta: x.borough, valor: x.poblacion_2020, color: BORO_COLOR[x.borough] })), { fmt: fmt.k });
    const c2 = G.card(g, 'Densidad poblacional', 'habitantes por milla² de tierra', { prov: colProv('demografia', 'boroughs', 'densidad_hab_mi2') });
    G.barras(c2.cuerpo, Object.values(B).sort((a, b) => b.densidad_hab_mi2 - a.densidad_hab_mi2).map(x => ({ etiqueta: x.borough, valor: x.densidad_hab_mi2, color: BORO_COLOR[x.borough] })));
    const c3 = G.card(g, 'Composición étnica', '% de residentes · ACS 2020–2024 · cada barra con su margen de error en la ficha', { ancha: true, prov: LG.unir('Composición étnica', ...['pct_hispano', 'pct_blanco_nh', 'pct_negro_nh', 'pct_asiatico_nh'].map(k => colProv('demografia', 'boroughs', k))) });
    G.apiladas(c3.cuerpo, BOROS.map(b => ({ etiqueta: b, ...B[b], otros: Math.max(0, 100 - B[b].pct_hispano - B[b].pct_blanco_nh - B[b].pct_negro_nh - B[b].pct_asiatico_nh) })),
      [{ k: 'pct_hispano', nombre: 'Hispano o latino' }, { k: 'pct_blanco_nh', nombre: 'Blanco no hispano' }, { k: 'pct_negro_nh', nombre: 'Negro no hispano' }, { k: 'pct_asiatico_nh', nombre: 'Asiático no hispano' }, { k: 'otros', nombre: 'Otro o dos o más', color: 'var(--muted)' }], { base100: true, fmt: v => fmt.n(v, 0) + '%' });
    c3.nota('Categorías autodeclaradas del Censo de EE. UU., agregadas por borough. Nunca se usan a nivel de persona.');
  }

  // ------------------------------------------------------------------ economía y vivienda
  function economia() {
    const B = por(LG.filas('demografia', 'boroughs')); if (!B.Manhattan) return;
    const max = Object.values(B).sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler)[0];
    const seg = Object.values(B).sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler)[1];
    const claro = LG.distinguibles(max.pct_hogares_con_carga_alquiler, max.pct_hogares_con_carga_alquiler_moe, seg.pct_hogares_con_carga_alquiler, seg.pct_hogares_con_carga_alquiler_moe);
    $('#economiaLead').innerHTML = `Manhattan tiene el ingreso mediano más alto (${fmt.usd(B.Manhattan.ingreso_mediano)} ± ${fmt.n(B.Manhattan.ingreso_mediano_moe)}) y el Bronx el más bajo (${fmt.usd(B.Bronx.ingreso_mediano)} ± ${fmt.n(B.Bronx.ingreso_mediano_moe)}). El alquiler no baja en la misma proporción: en el ${esc(max.borough)} el <b>${fmt.pct(max.pct_hogares_con_carga_alquiler)}</b> (± ${fmt.n(max.pct_hogares_con_carga_alquiler_moe, 1)}) de los hogares inquilinos destina 30 % o más de su ingreso al alquiler${claro ? `, por encima de ${esc(seg.borough)} incluso con el margen de error` : `, aunque la diferencia con ${esc(seg.borough)} cabe en el margen de error`}.`;
    const t = $('#economiaTiles'), pIng = colProv('demografia', 'boroughs', 'ingreso_mediano');
    G.tile(t, { valor: fmt.usd(B.Manhattan.ingreso_mediano), moe: fmt.n(B.Manhattan.ingreso_mediano_moe), etiqueta: 'ingreso mediano del hogar, Manhattan', prov: pIng });
    G.tile(t, { valor: fmt.usd(B.Bronx.ingreso_mediano), moe: fmt.n(B.Bronx.ingreso_mediano_moe), etiqueta: 'ingreso mediano del hogar, Bronx', prov: pIng });
    G.tile(t, { valor: fmt.pct(max.pct_hogares_con_carga_alquiler), moe: fmt.n(max.pct_hogares_con_carga_alquiler_moe, 1), etiqueta: `hogares inquilinos con carga ≥30 %, ${esc(max.borough)}`, prov: colProv('demografia', 'boroughs', 'pct_hogares_con_carga_alquiler') });
    T(t, 'vivienda', 'viviendas_propuestas_2025', 'viviendas propuestas en obra nueva radicada en 2025');
    T(t, 'vivienda', 'viviendas_asequibles_total', 'viviendas asequibles financiadas por HPD desde 2014');
    const g = grid('economiaGrid');
    const c1 = G.card(g, 'Ingreso mediano del hogar', 'US$ de 2024 · la línea es el margen de error al 90 %', { prov: pIng });
    G.barras(c1.cuerpo, Object.values(B).sort((a, b) => b.ingreso_mediano - a.ingreso_mediano).map(x => ({ etiqueta: x.borough, valor: x.ingreso_mediano, moe: x.ingreso_mediano_moe, color: BORO_COLOR[x.borough], tip: `<b>${x.borough}</b><br>${fmt.usd(x.ingreso_mediano)} ± ${fmt.n(x.ingreso_mediano_moe)}` })), { fmt: fmt.usd });
    c1.nota('El ACS es una encuesta: cada cifra es una estimación con margen de error. Si dos líneas se cruzan, la diferencia no es concluyente.');
    const c2 = G.card(g, 'Carga del alquiler', '% de hogares inquilinos que pagan ≥30 % del ingreso · ± margen de error', { prov: colProv('demografia', 'boroughs', 'pct_hogares_con_carga_alquiler') });
    G.barras(c2.cuerpo, Object.values(B).sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler).map(x => ({ etiqueta: x.borough, valor: x.pct_hogares_con_carga_alquiler, moe: x.pct_hogares_con_carga_alquiler_moe, color: BORO_COLOR[x.borough], tip: `<b>${x.borough}</b><br>${fmt.pct(x.pct_hogares_con_carga_alquiler)} ± ${fmt.n(x.pct_hogares_con_carga_alquiler_moe, 1)}<br>alquiler mediano ${fmt.usd(x.alquiler_mediano)}/mes` })), { fmt: v => fmt.pct(v), max: 100, ref: 30 });
    c2.nota('Umbral federal de «carga de costo» (HUD): 30 % del ingreso. Se excluyen los hogares sin cálculo posible.');
    const O = LG.filas('vivienda', 'obra_nueva');
    if (O.length) {
      const c3 = G.card(g, 'Obra nueva radicada en 2025', 'viviendas propuestas por cada 1.000 habitantes', { prov: colProv('vivienda', 'obra_nueva', 'viviendas_por_1000_hab') });
      G.barras(c3.cuerpo, [...O].sort((a, b) => b.viviendas_por_1000_hab - a.viviendas_por_1000_hab).map(x => ({ etiqueta: x.borough, valor: x.viviendas_por_1000_hab, color: BORO_COLOR[x.borough], tip: `${fmt.n(x.obras_nuevas)} obras · ${fmt.n(x.viviendas_propuestas)} viviendas` })), { fmt: v => fmt.n(v, 1) });
      c3.calidad(`Cada obra aparece varias veces en DOB NOW (radicación inicial y cada trámite), repitiendo sus viviendas. Sin depurar, 2025 sumaba <b>${fmt.n(LG.valor('vivienda', 'viviendas_sin_depurar_2025'))}</b> viviendas en ${fmt.n(LG.valor('vivienda', 'filas_sin_depurar_2025'))} filas; contando solo la radicación inicial (-I1) quedan <b>${fmt.n(LG.valor('vivienda', 'viviendas_propuestas_2025'))}</b>. Son viviendas propuestas, no terminadas.`);
      const c4 = G.card(g, 'Vivienda asequible por nivel de ingreso', 'unidades HPD acumuladas desde 2014', { prov: listaProv('vivienda', 'asequible') });
      G.apiladas(c4.cuerpo, BOROS.map(b => ({ etiqueta: b, ...por(LG.filas('vivienda', 'asequible'))[b] })), [{ k: 'ingreso_extremadamente_bajo', nombre: 'Extremadamente bajo (≤30 % AMI)' }, { k: 'ingreso_muy_bajo', nombre: 'Muy bajo (31–50 %)' }, { k: 'ingreso_bajo', nombre: 'Bajo (51–80 %)' }, { k: 'ingreso_moderado', nombre: 'Moderado (81–120 %)' }, { k: 'ingreso_medio', nombre: 'Medio (121–165 %)' }], { fmt: fmt.k });
      c4.nota('AMI = ingreso mediano del área metropolitana definido por HUD. El largo de cada barra es la mezcla por nivel de ingreso, no el total.');
      const s = LG.puntos('vivienda', 'asequibles_por_anio');
      const c5 = G.card(g, 'Viviendas asequibles por año de inicio de obra', 'HPD · el año en curso está incompleto', { ancha: true, prov: LG.provSerie('vivienda', 'asequibles_por_anio') });
      G.columnas(c5.cuerpo, s.map(p => String(p[0])), [{ nombre: 'viviendas', valores: s.map(p => p[1]), color: 'var(--accent-2)' }], { H: 200 });
    }
  }

  // ------------------------------------------------------------------ turismo (declarado) y rodajes (medido)
  function turismo() {
    const v = k => LG.valor('declarados', k);
    if (v('visitantes_2025')) $('#turismoLead').innerHTML = `Según NYC Tourism + Conventions, la ciudad recibió <b>${fmtU(v('visitantes_2025'))} de visitantes en 2025</b>, con ${fmtU(v('visitantes_internacionales_2025'))} internacionales. <b>Esas cifras son declaradas</b>: no hay API ni microdatos para comprobarlas, así que van aparte y con otra etiqueta. Lo que sí se mide con datos abiertos es la economía audiovisual: cada rodaje en la calle necesita un permiso de la Alcaldía.`;
    const t = $('#turismoTiles');
    const banda = document.createElement('div'); banda.className = 'banda-declarado'; banda.innerHTML = `${G.chipTipo('declarado')} <b>Cifras declaradas</b> por un comunicado oficial (F29). No vienen de una API y no se pueden verificar con microdatos; el script solo comprueba que el comunicado sigue diciendo lo mismo.`;
    t.before(banda);
    T(t, 'declarados', 'visitantes_2025', 'visitantes en 2025');
    T(t, 'declarados', 'visitantes_nacionales_2025', 'visitantes nacionales');
    T(t, 'declarados', 'visitantes_internacionales_2025', 'visitantes internacionales');
    T(t, 'declarados', 'impacto_economico_2025', 'impacto económico total');
    T(t, 'declarados', 'gasto_directo_2025', 'gasto directo de visitantes');
    const tm = document.createElement('div'); tm.className = 'tiles'; t.after(tm);
    const banda2 = document.createElement('div'); banda2.className = 'banda-medido'; banda2.innerHTML = `${G.chipTipo('medido')} <b>Cifras medidas</b> con la API de permisos de rodaje (F06).`; tm.before(banda2);
    T(tm, 'economia_rodajes', 'permisos_2025', 'permisos de rodaje y eventos en 2025');
    const g = grid('turismoGrid');
    const R = LG.filas('economia_rodajes', 'boroughs');
    if (R.length) {
      const c1 = G.card(g, 'Permisos de rodaje por borough', '2025', { prov: listaProv('economia_rodajes', 'boroughs') });
      G.barras(c1.cuerpo, [...R].sort((a, b) => b.permisos - a.permisos).map(x => ({ etiqueta: x.borough, valor: x.permisos, color: BORO_COLOR[x.borough] })));
      (LG.tema('economia_rodajes').calidad || []).forEach(q => c1.calidad(esc(q)));
      const c2 = G.card(g, 'Qué se filma', 'permisos 2025 por categoría', { prov: listaProv('economia_rodajes', 'categorias') });
      G.barras(c2.cuerpo, LG.filas('economia_rodajes', 'categorias').slice(0, 8).map(x => ({ etiqueta: x.categoria, valor: x.permisos, color: 'var(--accent-2)' })), { izq: 130 });
      const c3 = G.card(g, 'Estacionalidad de los rodajes', 'permisos por mes de inicio, 2025', { ancha: true, prov: LG.provSerie('economia_rodajes', 'permisos_mensual') });
      G.lineas(c3.cuerpo, [{ nombre: 'permisos', puntos: LG.puntos('economia_rodajes', 'permisos_mensual') }], { H: 200 });
    }
    if (v('visitantes_nacionales_2025')) {
      const c4 = G.card(g, 'Turismo 2025 en cifras declaradas', 'NYC Tourism + Conventions, informe anual', { ancha: true, prov: LG.unir('Visitantes 2025 (declarado)', LG.provCifra('declarados', 'visitantes_nacionales_2025'), LG.provCifra('declarados', 'visitantes_internacionales_2025')) });
      G.columnas(c4.cuerpo, ['Nacionales', 'Internacionales'], [{ nombre: 'visitantes', valores: [v('visitantes_nacionales_2025'), v('visitantes_internacionales_2025')], color: 'var(--dec)' }], { H: 180, fmt: fmt.k });
    }
  }

  // ------------------------------------------------------------------ municipio y 311
  function municipio() {
    const P = por(LG.filas('calidad_de_vida_311', 'boroughs')), total = LG.valor('calidad_de_vida_311', 'solicitudes_2025'); if (!total) return;
    const ord = BOROS.map(b => P[b]).sort((a, b) => b.por_1000_hab - a.por_1000_hab);
    const juntas = (LG.L.geo.distritos_puma?.features || []).reduce((a, f) => a + f.properties.distritos_comunitarios.length, 0);
    $('#municipioLead').innerHTML = `Nueva York se gobierna con una alcaldía central, un Concejo Municipal, cinco presidencias de borough y <b>${juntas} juntas comunitarias</b> que opinan sobre su distrito. El 311 es el canal por el que la ciudadanía reporta problemas: en 2025 recibió <b>${fmt.n(total)}</b> solicitudes. Por habitante, el <b>${esc(ord[0].borough)}</b> es el que más reporta (${fmt.n(ord[0].por_1000_hab)} por cada 1.000).`;
    const t = $('#municipioTiles');
    T(t, 'declarados', 'presupuesto_fy2027', 'presupuesto municipal adoptado para el año fiscal 2027');
    TD(t, String(juntas), 'juntas comunitarias (distritos comunitarios del DCP)', LG.prov(LG.L.geo.distritos_puma?.columnas?.distritos_comunitarios), 'Suma de los distritos comunitarios que agrupa cada PUMA (F19)', { tipo: 'derivado' });
    T(t, 'calidad_de_vida_311', 'solicitudes_2025', 'solicitudes 311 en 2025');
    T(t, 'calidad_de_vida_311', 'tipo_mas_frecuente', 'queja más frecuente en 2025');
    const g = grid('municipioGrid');
    const c1 = G.card(g, 'Solicitudes 311 por habitante', 'por cada 1.000 habitantes (Censo 2020) · 2025', { prov: colProv('calidad_de_vida_311', 'boroughs', 'por_1000_hab') });
    G.barras(c1.cuerpo, ord.map(x => ({ etiqueta: x.borough, valor: x.por_1000_hab, color: BORO_COLOR[x.borough], tip: `${fmt.n(x.solicitudes)} solicitudes` })));
    if (P['No especificado']) c1.nota(`${fmt.n(P['No especificado'].solicitudes)} solicitudes no traen borough y no se reparten.`);
    const c2 = G.card(g, 'Las 12 quejas más frecuentes', 'toda la ciudad, 2025', { prov: listaProv('calidad_de_vida_311', 'tipos') });
    G.barras(c2.cuerpo, LG.filas('calidad_de_vida_311', 'tipos').slice(0, 12).map(x => ({ etiqueta: x.tipo.length > 22 ? x.tipo.slice(0, 21) + '…' : x.tipo, valor: x.solicitudes, color: 'var(--accent-2)', tip: esc(x.tipo) })), { izq: 150, fmt: fmt.k, alto: 22 });
    const TB = LG.filas('calidad_de_vida_311', 'tipos_por_borough');
    const c3 = G.card(g, 'Qué pide cada borough', 'los 5 tipos más frecuentes por borough, 2025', { ancha: true, prov: listaProv('calidad_de_vida_311', 'tipos_por_borough') });
    G.tabla(c3.cuerpo, [{ k: 'b', t: 'Borough' }, ...[1, 2, 3, 4, 5].map(i => ({ k: 't' + i, t: '#' + i, f: v => v || '—' }))], BOROS.map(b => { const o = { b }; TB.filter(x => x.borough === b).forEach(x => o['t' + x.puesto] = `${esc(x.tipo)} <small style="color:var(--muted)">${fmt.k(x.solicitudes)}</small>`); return o; }), {});
    const lider = b => TB.find(x => x.borough === b && x.puesto === 1)?.tipo;
    const grupos = {}; BOROS.forEach(b => (grupos[lider(b)] = grupos[lider(b)] || []).push(b));
    c3.nota(Object.entries(grupos).map(([tipo, bs]) => `«${esc(tipo)}» encabeza en ${bs.join(', ')}`).join('; ') + '. El 311 mide demanda de servicio, no la gravedad del problema.');
    const c4 = G.card(g, 'Solicitudes por mes', '2025 · toda la ciudad', { ancha: true, prov: LG.provSerie('calidad_de_vida_311', 'solicitudes_mensual') });
    G.lineas(c4.cuerpo, [{ nombre: 'solicitudes', puntos: LG.puntos('calidad_de_vida_311', 'solicitudes_mensual') }], { H: 190, cero: false });
  }

  // ------------------------------------------------------------------ seguridad
  function seguridad() {
    const S = por(LG.filas('seguridad_delitos', 'boroughs')); if (!S.Manhattan) return;
    const c = k => LG.valor('seguridad_delitos', k), V = por(LG.filas('seguridad_vial', 'boroughs'));
    $('#seguridadLead').innerHTML = `En 2025 el NYPD registró <b>${fmt.n(c('denuncias_2025'))}</b> denuncias. Entre enero y junio de 2026 hubo <b>${fmt.n(c('denuncias_ene_jun_2026'))}</b>, un <b>${fmt.signo(c('variacion_ene_jun'))}</b> frente al mismo semestre de 2025. Una denuncia no es una condena, y no todos los delitos se denuncian por igual: estas cifras miden lo reportado. En el tránsito murieron <b>${fmt.n(LG.valor('seguridad_vial', 'fallecidos_2025'))}</b> personas en 2025, ${fmt.n(LG.valor('seguridad_vial', 'peatones_fallecidos_2025'))} de ellas peatones.`;
    const t = $('#seguridadTiles');
    T(t, 'seguridad_delitos', 'variacion_ene_jun', 'denuncias de enero a junio, 2026 frente a 2025', { valor: fmt.signo(c('variacion_ene_jun')) });
    const mx = BOROS.map(b => S[b]).sort((a, b) => b.graves_por_1000_hab - a.graves_por_1000_hab)[0];
    G.tile(t, { valor: fmt.n(mx.graves_por_1000_hab, 1), unidad: '/1.000', etiqueta: `delitos graves por 1.000 habitantes en ${esc(mx.borough)}, la tasa más alta`, prov: colProv('seguridad_delitos', 'boroughs', 'graves_por_1000_hab') });
    T(t, 'seguridad_vial', 'pct_fallecidos_peatones', 'de los muertos en el tránsito eran peatones');
    T(t, 'seguridad_vial', 'colisiones_2025', 'choques reportados en 2025');
    const g = grid('seguridadGrid');
    const c1 = G.card(g, 'Denuncias por 1.000 habitantes y gravedad', '2025 · categoría legal del NYPD', { prov: LG.unir('Denuncias por 1.000 habitantes', ...['graves_por_1000_hab', 'menos_graves_por_1000_hab', 'infracciones_por_1000_hab'].map(k => colProv('seguridad_delitos', 'boroughs', k))) });
    G.apiladas(c1.cuerpo, BOROS.map(b => ({ etiqueta: b, g: S[b].graves_por_1000_hab, m: S[b].menos_graves_por_1000_hab, i: S[b].infracciones_por_1000_hab })), [{ k: 'g', nombre: 'Graves (felony)', color: 'var(--c4)' }, { k: 'm', nombre: 'Menos graves (misdemeanor)', color: 'var(--c1)' }, { k: 'i', nombre: 'Infracciones (violation)', color: 'var(--c5)' }], { fmt: v => fmt.n(v, 1) });
    const H = LG.filas('seguridad_delitos', 'primer_semestre');
    const c2 = G.card(g, 'Primer semestre: 2026 frente a 2025', 'denuncias enero–junio por borough', { prov: listaProv('seguridad_delitos', 'primer_semestre') });
    G.columnas(c2.cuerpo, H.map(x => x.borough === 'Staten Island' ? 'S. Island' : x.borough), [{ nombre: '2025', valores: H.map(x => x.denuncias_2025), color: 'var(--muted)' }, { nombre: '2026', valores: H.map(x => x.denuncias_2026), color: 'var(--c4)' }]);
    c2.nota(H.map(x => `${x.borough}: ${fmt.signo(x.variacion_pct)}`).join(' · '));
    (LG.tema('seguridad_delitos').calidad || []).forEach(q => c2.calidad(esc(q)));
    const O = LG.filas('seguridad_delitos', 'ofensas');
    const c3 = G.card(g, 'Ofensas más denunciadas por borough', '2025', { ancha: true, prov: listaProv('seguridad_delitos', 'ofensas') });
    G.tabla(c3.cuerpo, [{ k: 'b', t: 'Borough' }, ...[1, 2, 3].map(i => ({ k: 'o' + i, t: '#' + i, f: v => esc(v || '—') }))], BOROS.map(b => { const o = { b }; O.filter(x => x.borough === b && x.puesto <= 3).forEach(x => o['o' + x.puesto] = `${x.ofensa} (${fmt.n(x.denuncias)})`); return o; }), {});
    c3.nota('La fuente trae edad, raza y sexo de víctima y sospechoso: nada de eso entra al lago (ver «Lo que decidimos no publicar»).');
    const c4 = G.card(g, 'Víctimas del tránsito por tipo', 'heridos por 100.000 habitantes · 2025', { prov: LG.unir('Heridos por tipo de víctima', ...['peatones_heridos', 'ciclistas_heridos', 'ocupantes_heridos'].map(k => colProv('seguridad_vial', 'boroughs', k)), colProv('demografia', 'boroughs', 'poblacion_2020')) });
    const D0 = por(LG.filas('demografia', 'boroughs'));
    G.apiladas(c4.cuerpo, BOROS.map(b => { const x = V[b], k = 1e5 / D0[b].poblacion_2020; return { etiqueta: b, p: x.peatones_heridos * k, c: x.ciclistas_heridos * k, o: x.ocupantes_heridos * k }; }), [{ k: 'p', nombre: 'Peatones', color: 'var(--c4)' }, { k: 'c', nombre: 'Ciclistas', color: 'var(--c2)' }, { k: 'o', nombre: 'Ocupantes de vehículos', color: 'var(--c5)' }], { fmt: v => fmt.n(v, 0) });
    c4.nota('Cálculo en la vista: heridos de cada tipo ÷ población del Censo 2020 × 100.000.');
    const c5 = G.card(g, 'Fallecidos en el tránsito', '2025 · personas', { prov: colProv('seguridad_vial', 'boroughs', 'fallecidos') });
    G.barras(c5.cuerpo, BOROS.map(b => V[b]).sort((a, b) => b.fallecidos - a.fallecidos).map(x => ({ etiqueta: x.borough, valor: x.fallecidos, color: BORO_COLOR[x.borough], tip: `${x.peatones_fallecidos} peatones · ${x.ciclistas_fallecidos} ciclistas · ${x.ocupantes_fallecidos} ocupantes<br>${fmt.n(x.fallecidos_por_100k, 2)} por 100.000 hab.` })));
    c5.calidad(`${fmt.n(LG.valor('seguridad_vial', 'recuperados_por_coordenadas'))} choques venían sin borough (autopistas y puentes) y se ubicaron por sus coordenadas. Quedan ${fmt.n(LG.valor('seguridad_vial', 'sin_ubicar'))} sin coordenadas válidas ni borough.`);
    const c6 = G.card(g, 'Choques y heridos por mes', '2025', { ancha: true, prov: LG.unir('Choques y heridos por mes', LG.provSerie('seguridad_vial', 'colisiones_mensual'), LG.provSerie('seguridad_vial', 'heridos_mensual')) });
    G.lineas(c6.cuerpo, [{ nombre: 'colisiones', puntos: LG.puntos('seguridad_vial', 'colisiones_mensual') }, { nombre: 'heridos', puntos: LG.puntos('seguridad_vial', 'heridos_mensual'), color: 'var(--c4)' }], { H: 200 });
  }

  // ------------------------------------------------------------------ movilidad
  function movilidad() {
    const sub = LG.puntos('movilidad', 'subte'); if (!sub.length) return;
    const ult = LG.cifra('movilidad', 'subte_ultimo_mes'), crz = LG.puntos('movilidad', 'ingresos_zona_congestion');
    $('#movilidadLead').innerHTML = `El subte movió en promedio <b>${fmt.n(ult.valor)}</b> viajes diarios en ${esc(ult.vigencia)}${LG.valor('movilidad', 'subte_variacion_anual') != null ? `, un ${fmt.signo(LG.valor('movilidad', 'subte_variacion_anual'))} frente al mismo mes del año anterior` : ''}. Desde el 5 de enero de 2025 los vehículos que entran a Manhattan bajo la calle 60 pagan un peaje de congestión, y la MTA publica cuántos ingresan cada día.`;
    const t = $('#movilidadTiles');
    T(t, 'movilidad', 'subte_ultimo_mes', `viajes diarios en subte (${esc(ult.vigencia)})`);
    T(t, 'movilidad', 'subte_variacion_anual', 'frente al mismo mes del año anterior', { valor: fmt.signo(LG.valor('movilidad', 'subte_variacion_anual')) });
    T(t, 'movilidad', 'congestion_ultimo_mes', `vehículos diarios a la zona de congestión (${esc(LG.cifra('movilidad', 'congestion_ultimo_mes')?.vigencia || '')})`);
    const B = por(LG.filas('demografia', 'boroughs'));
    G.tile(t, { valor: fmt.pct(B.Manhattan.pct_hogares_sin_auto), moe: fmt.n(B.Manhattan.pct_hogares_sin_auto_moe, 1), etiqueta: 'de los hogares de Manhattan no tiene auto', prov: colProv('demografia', 'boroughs', 'pct_hogares_sin_auto') });
    T(t, 'movilidad', 'paradas_total', 'paradas de subte y SIR en el dataset MTA');
    const g = grid('movilidadGrid');
    const c1 = G.card(g, 'Viajes diarios promedio por mes', 'subte y bus · desde marzo de 2020', { ancha: true, prov: LG.unir('Viajes diarios por mes', LG.provSerie('movilidad', 'subte'), LG.provSerie('movilidad', 'bus')) });
    G.lineas(c1.cuerpo, [{ nombre: 'Subte', puntos: sub, color: 'var(--c1)' }, { nombre: 'Bus', puntos: LG.puntos('movilidad', 'bus'), color: 'var(--c2)' }], { H: 240, marcas: [{ x: '2025-01', texto: 'peaje de congestión' }] });
    c1.nota('Promedio diario = suma del mes ÷ días con dato. El mes en curso no se publica porque llega incompleto. Ver la serie no permite atribuir efectos causales al peaje.');
    if (crz.length) {
      const c2 = G.card(g, 'Ingresos a la zona de congestión', 'vehículos por día, promedio mensual', { prov: LG.provSerie('movilidad', 'ingresos_zona_congestion') });
      G.lineas(c2.cuerpo, [{ nombre: 'zona de cobro (CRZ)', puntos: crz, color: 'var(--c4)' }].concat(LG.puntos('movilidad', 'ingresos_cbd').length ? [{ nombre: 'distrito central (CBD)', puntos: LG.puntos('movilidad', 'ingresos_cbd'), color: 'var(--c5)', punteada: 1 }] : []), { H: 210, cero: false });
    }
    const c3 = G.card(g, 'Cómo se llega al trabajo', '% de trabajadores en transporte público · ± margen de error', { prov: colProv('demografia', 'boroughs', 'pct_transporte_publico') });
    G.barras(c3.cuerpo, Object.values(B).sort((a, b) => b.pct_transporte_publico - a.pct_transporte_publico).map(x => ({ etiqueta: x.borough, valor: x.pct_transporte_publico, moe: x.pct_transporte_publico_moe, color: BORO_COLOR[x.borough], tip: `${fmt.pct(x.pct_teletrabajo)} trabaja desde casa<br>${fmt.pct(x.pct_hogares_sin_auto)} de hogares sin auto` })), { fmt: v => fmt.pct(v), max: 100 });
    const E = LG.filas('movilidad', 'estaciones');
    const c4 = G.card(g, 'Paradas de subte por borough', 'filas del dataset MTA (una por estación-línea)', { prov: listaProv('movilidad', 'estaciones') });
    G.barras(c4.cuerpo, E.map(x => ({ etiqueta: x.borough, valor: x.paradas, color: BORO_COLOR[x.borough] })));
    (LG.tema('movilidad').notas || []).slice(1).forEach(n => c4.nota(esc(n)));
  }

  // ------------------------------------------------------------------ ambiente
  function ambiente() {
    const S = LG.filas('ambiente', 'aire_serie'); if (!S.length) return;
    const ciudad = S.filter(x => x.lugar === 'Ciudad').sort((a, b) => a.anio - b.anio), ini = ciudad[0], fin = ciudad[ciudad.length - 1];
    const D = LG.distritos().filter(p => p.pm25 && p.ingreso_mediano);
    const r = G.pearson(D.map(p => p.pct_pobreza), D.map(p => p.pm25)), ri = G.pearson(D.map(p => p.ingreso_mediano), D.map(p => p.pm25));
    $('#ambienteLead').innerHTML = `La concentración media de partículas finas (PM2,5) en la ciudad bajó de <b>${fmt.n(ini.pm25, 1)}</b> µg/m³ en ${ini.anio} a <b>${fmt.n(fin.pm25, 1)}</b> en ${fin.anio} (${fmt.signo(LG.valor('ambiente', 'pm25_cambio'), 0)}). La pregunta de justicia ambiental tiene una respuesta honesta y a la vez incómoda: con estos datos, <b>el aire no es peor en los distritos más pobres</b> (r pobreza–PM2,5 = ${fmt.n(r, 2)}); lo es en el centro de Manhattan, donde se concentran tráfico y edificios.`;
    const t = $('#ambienteTiles');
    T(t, 'ambiente', 'pm25_ciudad', `PM2,5 media anual en la ciudad (${esc(LG.cifra('ambiente', 'pm25_ciudad').vigencia)})`, { unidad: 'µg/m³', valor: fmt.n(LG.valor('ambiente', 'pm25_ciudad'), 2) });
    T(t, 'ambiente', 'pm25_cambio', `cambio del PM2,5 ${esc(LG.cifra('ambiente', 'pm25_cambio').vigencia)}`, { valor: fmt.signo(LG.valor('ambiente', 'pm25_cambio'), 0) });
    T(t, 'ambiente', 'no2_ciudad', `NO₂ media anual (${esc(LG.cifra('ambiente', 'no2_ciudad').vigencia)})`, { unidad: 'ppb', valor: fmt.n(LG.valor('ambiente', 'no2_ciudad'), 1) });
    T(t, 'ambiente', 'arboles_2015', 'árboles de calle censados (2015)');
    const g = grid('ambienteGrid');
    const c1 = G.card(g, 'PM2,5 media anual por borough', 'µg/m³', { ancha: true, prov: colProv('ambiente', 'aire_serie', 'pm25') });
    G.lineas(c1.cuerpo, ['Ciudad', ...BOROS].map(l => ({ nombre: l, puntos: S.filter(x => x.lugar === l && x.pm25 != null).map(x => [String(x.anio), x.pm25]), color: l === 'Ciudad' ? 'var(--text)' : BORO_COLOR[l], grosor: l === 'Ciudad' ? 3 : 1.6, punteada: l === 'Ciudad' })), { H: 250, cero: false, fmtY: v => fmt.n(v, 1), fmtV: v => fmt.n(v, 2) + ' µg/m³' });
    c1.nota('Referencia: la OMS recomienda una media anual de 5 µg/m³ (2021) y la EPA fijó 9 µg/m³ como norma nacional (2024).');
    (LG.tema('ambiente').calidad || []).forEach(q => c1.calidad(esc(q)));
    const A = por(LG.filas('ambiente', 'arboles'));
    const c2 = G.card(g, 'Árboles de calle por km²', 'censo 2015 · estado de salud', { prov: listaProv('ambiente', 'arboles') });
    G.apiladas(c2.cuerpo, BOROS.map(b => { const x = A[b], k = x.arboles_por_km2 / x.arboles; return { etiqueta: b, buena: x.buena * k, regular: x.regular * k, mala: x.mala * k, sin: x.sin_registro * k }; }), [{ k: 'buena', nombre: 'Buena', color: 'var(--good)' }, { k: 'regular', nombre: 'Regular', color: 'var(--c1)' }, { k: 'mala', nombre: 'Mala', color: 'var(--c4)' }, { k: 'sin', nombre: 'Sin registro (tocón o muerto)', color: 'var(--muted)' }], { fmt: v => fmt.n(v, 0) });
    const c3 = G.card(g, '¿Aire más sucio donde hay menos ingreso?', 'cada punto es un distrito · ver Correlaciones', { prov: LG.unir('Ingreso y PM2,5 por distrito', LG.provMetrica('ingreso_mediano'), LG.provMetrica('pm25')) });
    G.dispersion(c3.cuerpo, D.map(p => ({ x: p.ingreso_mediano, y: p.pm25, nombre: p.nombre, color: BORO_COLOR[p.borough], tip: `<b>${esc(p.nombre)}</b><br>${fmt.usd(p.ingreso_mediano)} ± ${fmt.n(p.ingreso_mediano_moe)} · ${fmt.n(p.pm25, 2)} µg/m³` })), { H: 300, ejeX: 'Ingreso mediano (US$)', ejeY: 'PM2,5 (µg/m³)', fmtX: fmt.k, fmtY: v => fmt.n(v, 1) });
    c3.nota(`r ingreso–PM2,5 = ${fmt.n(ri, 2)}; r pobreza–PM2,5 = ${fmt.n(r, 2)}. Con estos datos, no: el PM2,5 más alto está en el centro de Manhattan, donde viven hogares de altos ingresos. Esto no descarta otras desigualdades ambientales (asma, cercanía a autopistas o industria) que este lago no mide.`);
  }

  // ------------------------------------------------------------------ escucha (proxy)
  function escucha() {
    const ny = LG.serie('escucha_interes', 'vistas_en_new_york_city'), es = LG.serie('escucha_interes', 'vistas_es_nueva_york'); if (!ny) return;
    const pico = LG.cifra('escucha_interes', 'mes_pico');
    $('#escuchaLead').innerHTML = `El Cerebro Lima escucha redes sociales con fuentes propias; aquí no inventamos menciones. Usamos un <b>proxy</b> abierto y verificable: cuántas personas leen los artículos de Wikipedia de la ciudad y de cada borough. Mide atención, no opinión. El mes de mayor atención fue <b>${esc(pico.valor)}</b>.`;
    const t = $('#escuchaTiles');
    T(t, 'escucha_interes', 'vistas_12_meses', '«New York City» en Wikipedia, últimos 12 meses');
    T(t, 'escucha_interes', 'mes_pico', 'mes de mayor interés');
    if (es) G.tile(t, { valor: fmt.k(es.puntos.slice(-12).reduce((a, p) => a + p[1], 0)), etiqueta: '«Nueva York» en Wikipedia en español, 12 meses', prov: Object.assign(LG.provSerie('escucha_interes', 'vistas_es_nueva_york'), { formula: 'Suma de los últimos 12 meses de la serie' }) });
    const g = grid('escuchaGrid');
    const c1 = G.card(g, 'Interés por la ciudad', 'vistas mensuales de personas (sin bots)', { ancha: true, prov: LG.unir('Vistas de Wikipedia', LG.provSerie('escucha_interes', 'vistas_en_new_york_city'), es && LG.provSerie('escucha_interes', 'vistas_es_nueva_york')) });
    G.lineas(c1.cuerpo, [{ nombre: 'New York City (inglés)', puntos: ny.puntos, color: 'var(--c1)' }].concat(es ? [{ nombre: 'Nueva York (español)', puntos: es.puntos, color: 'var(--c2)' }] : []), { H: 230 });
    const bs = Object.entries(LG.tema('escucha_interes').series).filter(([, s]) => BOROS.includes(s.etiqueta));
    const c2 = G.card(g, 'Interés por borough', 'vistas mensuales del artículo de cada borough', { ancha: true, prov: LG.unir('Vistas por borough', ...bs.map(([k]) => LG.provSerie('escucha_interes', k))) });
    G.lineas(c2.cuerpo, bs.map(([, s]) => ({ nombre: s.etiqueta, puntos: s.puntos, color: BORO_COLOR[s.etiqueta] })), { H: 230 });
    c2.nota('Proxy de atención externa: los picos suelen coincidir con noticias (elecciones, eventos, clima). No es un sondeo.');
  }

  // ------------------------------------------------------------------ fuentes y gobernanza
  function fuentes() {
    const F = LG.fuentes(); if (!F.length) return;
    const cuenta = e => F.filter(f => f.estado_catalogo === e).length;
    $('#fuentesLead').innerHTML = `Cada tema del lago es un archivo con la misma forma (el <b>contrato</b>): fuentes, cifras, series y listas, y en cada una su unidad, vigencia, fuente y fecha de prueba. Lo construyen los scripts de <code>ingesta/</code>, uno por tema, y <code>verificacion/verificar.mjs</code> lo revisa antes de publicar: con un solo FAIL no se publica. Las fuentes descartadas también están aquí: explican las decisiones.`;
    const t = $('#fuentesTiles'), pc = { tipo: 'derivado', descripcion: 'Conteo del catálogo', vigencia: 'catálogo vigente', fuentes: [], formula: 'Filas de lago/catalogo.json' };
    [['Integrada al lago', 'integradas al lago'], ['Candidata', 'candidatas'], ['Descartada', 'descartadas']].forEach(([e, l]) => G.tile(t, { valor: String(cuenta(e)), etiqueta: 'fuentes ' + l, prov: pc }));
    G.tile(t, { valor: String(F.filter(f => String(f.licencia).startsWith('no declara')).length), etiqueta: 'fuentes que no declaran licencia: se escribe «no declara», no se supone', prov: pc });
    G.tile(t, { valor: String(F.filter(f => f.personas === 'Personas identificables').length), etiqueta: 'fuentes con personas identificables: solo se guardan agregados', prov: pc });
    G.tile(t, { valor: esc(LG.pruebaMasReciente() || '—'), etiqueta: 'última prueba de las fuentes (todas en la misma corrida)', prov: pc });
    const g = grid('fuentesGrid');
    const c1 = G.card(g, 'Catálogo de fuentes', 'una fila por fuente encontrada, entre o no al lago · fecha real de la prueba', { ancha: true });
    const pill = e => `<span class="pill ${e === 'Integrada al lago' ? 'ok' : e === 'Candidata' ? 'med' : 'mal'}">${esc(e)}</span>`;
    G.tabla(c1.cuerpo, [{ k: 'id', t: 'ID' }, { k: 'nombre', t: 'Conjunto de datos', wrap: 1 }, { k: 'entidad', t: 'Publica', wrap: 1 }, { k: 'licencia', t: 'Licencia, tal como aparece', wrap: 1, f: v => `«${esc(v)}»` }, { k: 'personas', t: 'Personas' }, { k: 'probado', t: 'Probada' }, { k: 'estado_catalogo', t: 'Estado', f: pill }, { k: 'url', t: 'Enlace', f: u => `<a href="${esc(u)}" target="_blank" rel="noopener">abrir</a>` }], F, { orden: 'id', dir: 1, alto: 520 });
    c1.fuente('Licencias, observaciones completas y la bitácora de IA: Diccionario_de_datos_TallerDatos_NuevaYork.xlsx. Ningún dataset de NYC Open Data ni de data.ny.gov declara licencia en sus metadatos; el portal se rige por la Local Law 11 de 2012 y sus Términos de Uso.');
    const c2 = G.card(g, 'Cómo leer cada cifra', 'la etiqueta de color dice de dónde viene');
    c2.cuerpo.innerHTML = `<ul class="lista-tipos">${Object.entries(LG.TIPO).map(([k, x]) => `<li>${G.chipTipo(k)} ${esc(x.d)}</li>`).join('')}</ul><p class="nota">Toca cualquier cifra o el botón ⓘ de un gráfico: se abre su ficha con la fuente (ID F##), la vigencia, la fecha de prueba, la licencia tal como aparece y cómo se calculó. ± es el margen de error al 90 % del ACS.</p>`;
    const c3 = G.card(g, 'Hallazgos de calidad de datos', 'defectos de las fuentes, escritos por la ingesta en cada tema');
    const Q = Object.entries(LG.L.datos).flatMap(([tema, d]) => (d.calidad || []).map(q => [tema, q]));
    c3.cuerpo.innerHTML = `<ol class="lista-calidad">${Q.map(([tema, q]) => `<li>${esc(q)} <small class="mono">${esc(tema)}</small></li>`).join('')}</ol>`;
    const c4 = G.card(g, 'Lo que decidimos no publicar', 'campos que existen en la fuente y no entran al lago', { ancha: true });
    const X = Object.entries(LG.L.datos).flatMap(([tema, d]) => (d.excluido || []).map(x => ({ ...x, tema })));
    G.tabla(c4.cuerpo, [{ k: 'fuente', t: 'Fuente' }, { k: 'campo', t: 'Campo en la fuente', wrap: 1 }, { k: 'razon', t: 'Por qué no se publica', wrap: 1 }], X, {});
    const minPob = Math.min(...LG.distritos().map(d => d.poblacion_acs));
    c4.nota(`Nivel de protección: <b>abierto, solo agregados</b>. Lo público son conteos y tasas por borough o por distrito (el más pequeño tiene ${fmt.n(minPob)} residentes, y la verificación rechaza cualquier conteo de personas entre 1 y 9 por distrito); los registros con personas nunca se descargan.`);
    const c5 = G.card(g, 'Reconstruir y verificar el lago', 'de la API al tablero, con un comando', { ancha: true });
    c5.cuerpo.innerHTML = `<pre class="cmd">python ingesta/construir.py             # corre ingesta/pull_*.py, verifica y solo si pasa escribe lago/lago.js
node verificacion/verificar.mjs          # contrato, datos personales, dominio, conteo mínimo y paquete
node verificacion/prueba_de_fallos.mjs   # rompe el lago a propósito: cada daño debe dar FAIL
node tests/analisis.test.cjs             # percentiles, rangos con margen de error, Benjamini-Hochberg, geometría</pre>`;
  }

  window.SECCIONES = { render() { [panorama, gente, economia, turismo, municipio, seguridad, movilidad, ambiente, escucha, fuentes].forEach(f => { try { f(); } catch (e) { console.error(f.name, e); } }); } };
})();
