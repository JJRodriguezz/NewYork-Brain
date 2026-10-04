// Secciones temáticas. Todo sale del lago: si un archivo falta, su tarjeta no aparece (no hay cifras escritas a mano,
// salvo las DECLARADAS de la tabla de abajo, que vienen de comunicados oficiales y se marcan como tales).
(function () {
  const $ = s => document.querySelector(s);
  const { fmt, esc, BORO_COLOR } = G;
  const BOROS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

  // Cifras declaradas (no hay API): se citan con fuente, fecha y enlace. Ver hoja Fuentes (F29, F30).
  const DECLARADO = {
    visitantes: { v: 65e6, f: 'F29 · NYC Tourism + Conventions', vig: '2025 (publicado 24-mar-2026)', url: 'https://www.business.nyctourism.com/press-media/press-releases/NYC-Tourism-Annual-Report-March-2026' },
    nacionales: { v: 52.4e6 }, internacionales: { v: 12.5e6 }, gasto: { v: 55.6e9 }, impacto: { v: 84.7e9 }, impuestos: { v: 7.5e9 },
    presupuesto: { v: 125.8e9, f: 'F30 · NYC Council', vig: 'FY2027 (adoptado 30-jun-2026)', url: 'https://council.nyc.gov/press/2026/06/30/3166/' },
  };

  const fuente = (j, extra = '') => { const m = j && j._meta || {}; const url = (m.url_api || '').split(' ; ')[0]; return `Fuente: ${esc(m.id_fuente || '')} · ${esc(m.entidad || m.conjunto_de_datos || '')} · probado ${esc(m.fecha_prueba || '')}${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">API</a>` : ''}${extra}`; };
  const porBoro = (lista, k = 'borough') => Object.fromEntries((lista || []).map(x => [x[k], x]));
  const grid = id => $('#' + id);

  function panorama(L) {
    const t = $('#panoramaTiles'), d = L.datos;
    if (d.demografia) G.tile(t, { valor: fmt.n(d.demografia.poblacion_total_2020), etiqueta: 'habitantes (Censo 2020)', estado: 'transcrito', fuente: 'F09 · Census / DCP' });
    G.tile(t, { valor: '55', etiqueta: 'distritos comunitarios (PUMA) en el atlas', estado: 'observado', fuente: 'F19 · DCP' });
    if (d.calidad_de_vida_311) G.tile(t, { valor: fmt.k(d.calidad_de_vida_311.total_2025), etiqueta: 'solicitudes al 311 en 2025', estado: 'observado', fuente: 'F03 · NYC311' });
    if (d.seguridad_delitos) G.tile(t, { valor: fmt.k(d.seguridad_delitos.total_2025), etiqueta: 'delitos denunciados en 2025', estado: 'observado', fuente: 'F04 · NYPD' });
    if (d.seguridad_vial) { const tot = d.seguridad_vial.datos.reduce((a, x) => a + x.fallecidos, 0); G.tile(t, { valor: fmt.n(tot), etiqueta: 'muertes en el tránsito en 2025', estado: 'observado', fuente: 'F02 · NYPD' }); }
    if (d.movilidad) { const s = d.movilidad.serie_mensual.filter(x => x.subte); const u = s[s.length - 1]; G.tile(t, { valor: fmt.k(u.subte), etiqueta: `viajes diarios en subte (promedio ${u.mes})`, estado: 'observado', fuente: 'F17 · MTA' }); }
    G.tile(t, { valor: '65 M', etiqueta: 'visitantes en 2025', estado: 'declarado', fuente: DECLARADO.visitantes.f });
    if (d.catalogo) { const f = d.catalogo.fuentes; G.tile(t, { valor: `${f.filter(x => x.estado === 'Integrada al lago').length}/${f.length}`, etiqueta: 'fuentes integradas / rastreadas', estado: 'observado', fuente: 'catálogo del lago' }); }
  }

  function gente(L) {
    const d = L.datos.demografia; if (!d) return; const B = porBoro(d.datos);
    const mayor = [...d.datos].sort((a, b) => b.poblacion_2020 - a.poblacion_2020);
    $('#genteTitulo').textContent = `${fmt.n(d.poblacion_total_2020)} personas, cinco realidades`;
    $('#genteLead').innerHTML = `${mayor[0].borough} concentra el ${fmt.n(mayor[0].poblacion_2020 / d.poblacion_total_2020 * 100, 1)} % de la ciudad y Staten Island apenas el ${fmt.n(B['Staten Island'].poblacion_2020 / d.poblacion_total_2020 * 100, 1)} %. Más de un tercio de los neoyorquinos nació fuera de EE. UU. y ningún grupo étnico es mayoría en la ciudad.`;
    const t = $('#genteTiles');
    G.tile(t, { valor: fmt.n(B.Manhattan.densidad_hab_mi2), unidad: 'hab/mi²', etiqueta: 'densidad de Manhattan, la mayor del país', estado: 'derivado', fuente: 'F09 + F20' });
    const ext = d.datos.reduce((a, x) => a + x.pct_nacidos_extranjero * x.poblacion_acs, 0) / d.datos.reduce((a, x) => a + x.poblacion_acs, 0);
    G.tile(t, { valor: fmt.pct(ext), etiqueta: 'nacidos en el extranjero (ponderado)', estado: 'derivado', fuente: 'F10 · ACS 2020–2024' });
    G.tile(t, { valor: fmt.pct(B.Queens.pct_nacidos_extranjero), etiqueta: 'de Queens nació en otro país', estado: 'observado', fuente: 'F10 · ACS' });
    G.tile(t, { valor: fmt.n(Math.min(...d.datos.map(x => x.edad_mediana)), 1) + '–' + fmt.n(Math.max(...d.datos.map(x => x.edad_mediana)), 1), unidad: 'años', etiqueta: 'rango de edad mediana entre boroughs', estado: 'observado', fuente: 'F10 · ACS' });
    const g = grid('genteGrid');
    const c1 = G.card(g, 'Población por borough', 'Censo 2020 · personas');
    G.barras(c1.cuerpo, [...d.datos].sort((a, b) => b.poblacion_2020 - a.poblacion_2020).map(x => ({ etiqueta: x.borough, valor: x.poblacion_2020, color: BORO_COLOR[x.borough] })), { fmt: fmt.k });
    c1.fuente('Fuente: F09 · U.S. Census Bureau / NYC DCP, Censo 2020 (cifras transcritas) · <a href="https://www.nyc.gov/content/planning/pages/planning/nyc-population-2020-census" target="_blank" rel="noopener">DCP</a>');
    const c2 = G.card(g, 'Densidad poblacional', 'habitantes por milla² de tierra');
    G.barras(c2.cuerpo, [...d.datos].sort((a, b) => b.densidad_hab_mi2 - a.densidad_hab_mi2).map(x => ({ etiqueta: x.borough, valor: x.densidad_hab_mi2, color: BORO_COLOR[x.borough] })));
    c2.fuente('Derivado: población F09 ÷ superficie terrestre de los polígonos oficiales F20 (pies² → mi²).');
    const c3 = G.card(g, 'Composición étnica', '% de residentes · ACS 2020–2024', { ancha: true });
    G.apiladas(c3.cuerpo, BOROS.map(b => ({ etiqueta: b, ...B[b], otros: Math.max(0, 100 - B[b].pct_hispano - B[b].pct_blanco_nh - B[b].pct_negro_nh - B[b].pct_asiatico_nh) })),
      [{ k: 'pct_hispano', nombre: 'Hispano o latino' }, { k: 'pct_blanco_nh', nombre: 'Blanco no hispano' }, { k: 'pct_negro_nh', nombre: 'Negro no hispano' }, { k: 'pct_asiatico_nh', nombre: 'Asiático no hispano' }, { k: 'otros', nombre: 'Otro o dos o más', color: 'var(--muted)' }], { base100: true, fmt: v => fmt.n(v, 0) + '%' });
    c3.fuente(fuente(d, ' · tabla B03002'));
  }

  function economia(L) {
    const d = L.datos.demografia, v = L.datos.vivienda; if (!d) return; const B = porBoro(d.datos);
    const max = [...d.datos].sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler)[0];
    $('#economiaLead').innerHTML = `Manhattan tiene el ingreso mediano más alto (${fmt.usd(B.Manhattan.ingreso_mediano)}) y el Bronx el más bajo (${fmt.usd(B.Bronx.ingreso_mediano)}): más del doble de diferencia. Pero el alquiler no baja en la misma proporción, así que en el ${esc(max.borough)} el <b>${fmt.pct(max.pct_hogares_con_carga_alquiler)}</b> de los hogares inquilinos destina 30 % o más de su ingreso al alquiler. Esta es la pregunta que la primera versión del lago dejó sin responder: el ACS sí trae alquiler por borough.`;
    const t = $('#economiaTiles');
    G.tile(t, { valor: fmt.usd(B.Manhattan.ingreso_mediano), etiqueta: 'ingreso mediano, Manhattan', estado: 'observado', fuente: 'F10 · ACS', vigencia: '±' + fmt.n(B.Manhattan.ingreso_mediano_moe) });
    G.tile(t, { valor: fmt.usd(B.Bronx.ingreso_mediano), etiqueta: 'ingreso mediano, Bronx', estado: 'observado', fuente: 'F10 · ACS', vigencia: '±' + fmt.n(B.Bronx.ingreso_mediano_moe) });
    G.tile(t, { valor: fmt.pct(B.Bronx.alquiler_pct_ingreso), etiqueta: 'alquiler mediano como % del ingreso, Bronx', estado: 'observado', fuente: 'F10 · B25071' });
    G.tile(t, { valor: fmt.pct(max.pct_hogares_con_carga_alquiler), etiqueta: `hogares inquilinos con carga ≥30 %, ${max.borough}`, estado: 'derivado', fuente: 'F10 · B25070' });
    if (v) { G.tile(t, { valor: fmt.n(v.obra_nueva_2025.reduce((a, x) => a + x.viviendas_propuestas, 0)), etiqueta: 'viviendas propuestas en obras nuevas radicadas en 2025', estado: 'derivado', fuente: 'F05 · DOB NOW' }); G.tile(t, { valor: fmt.k(v.asequible_hpd.reduce((a, x) => a + x.viviendas_asequibles, 0)), etiqueta: 'viviendas asequibles financiadas por HPD desde 2014', estado: 'observado', fuente: 'F16 · HPD' }); }
    const g = grid('economiaGrid');
    const c1 = G.card(g, 'Ingreso mediano del hogar', 'US$ de 2024 · la línea es el margen de error al 90 %');
    G.barras(c1.cuerpo, [...d.datos].sort((a, b) => b.ingreso_mediano - a.ingreso_mediano).map(x => ({ etiqueta: x.borough, valor: x.ingreso_mediano, moe: x.ingreso_mediano_moe, color: BORO_COLOR[x.borough], tip: `<b>${x.borough}</b><br>${fmt.usd(x.ingreso_mediano)} ± ${fmt.n(x.ingreso_mediano_moe)}` })), { fmt: fmt.usd });
    c1.nota('El ACS es una encuesta: cada cifra es una estimación con margen de error. La versión anterior comparaba con “2019 ajustado”, pero esa serie no se pudo reproducir desde una API, así que se reemplazó por la estimación vigente con su incertidumbre.');
    c1.fuente(fuente(d, ' · tabla B19013'));
    const c2 = G.card(g, 'Carga del alquiler', '% de hogares inquilinos que pagan ≥30 % del ingreso');
    G.barras(c2.cuerpo, [...d.datos].sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler).map(x => ({ etiqueta: x.borough, valor: x.pct_hogares_con_carga_alquiler, color: BORO_COLOR[x.borough], tip: `<b>${x.borough}</b><br>alquiler mediano ${fmt.usd(x.alquiler_mediano)}/mes<br>${fmt.pct(x.alquiler_pct_ingreso)} del ingreso` })), { fmt: v => fmt.pct(v), max: 100, ref: 30, refEtiqueta: '' });
    c2.nota('Umbral federal de “carga de costo” (HUD): 30 % del ingreso. Se excluyen los hogares sin cálculo posible (sin ingreso o sin pago en efectivo).');
    c2.fuente(fuente(d, ' · tablas B25070, B25064, B25071'));
    if (v) {
      const c3 = G.card(g, 'Obra nueva radicada en 2025', 'viviendas propuestas por cada 1.000 habitantes');
      G.barras(c3.cuerpo, [...v.obra_nueva_2025].sort((a, b) => b.viviendas_por_1000_hab - a.viviendas_por_1000_hab).map(x => ({ etiqueta: x.borough, valor: x.viviendas_por_1000_hab, color: BORO_COLOR[x.borough], tip: `<b>${x.borough}</b><br>${fmt.n(x.solicitudes_obra_nueva)} obras nuevas · ${fmt.n(x.viviendas_propuestas)} viviendas` })), { fmt: v => fmt.n(v, 1) });
      c3.calidad(`Cada obra aparece varias veces en DOB NOW (radicación inicial y cada trámite posterior), repitiendo sus viviendas. Sin depurar, 2025 sumaba <b>${fmt.n(v.filas_sin_filtrar_2025.viviendas)}</b> viviendas en ${fmt.n(v.filas_sin_filtrar_2025.filas)} filas; contando solo la radicación inicial (-I1) quedan <b>${fmt.n(v.obra_nueva_2025.reduce((a, x) => a + x.viviendas_propuestas, 0))}</b>. Son viviendas <i>propuestas</i>, no terminadas.`);
      c3.fuente(fuente(v));
      const c4 = G.card(g, 'Vivienda asequible por nivel de ingreso', 'unidades HPD acumuladas desde 2014');
      G.apiladas(c4.cuerpo, BOROS.map(b => ({ etiqueta: b, ...porBoro(v.asequible_hpd)[b] })), [{ k: 'ingreso_extremadamente_bajo', nombre: 'Extremadamente bajo (≤30 % AMI)' }, { k: 'ingreso_muy_bajo', nombre: 'Muy bajo (31–50 %)' }, { k: 'ingreso_bajo', nombre: 'Bajo (51–80 %)' }, { k: 'ingreso_moderado', nombre: 'Moderado (81–120 %)' }, { k: 'ingreso_medio', nombre: 'Medio (121–165 %)' }], { fmt: fmt.k });
      c4.nota('AMI = ingreso mediano del área metropolitana definido por HUD. El largo de cada barra es la mezcla por nivel de ingreso, no el total.');
      c4.fuente('Fuente: F16 · NYC HPD, Affordable Housing Production by Building · <a href="https://data.cityofnewyork.us/resource/hg8x-zxpr.json" target="_blank" rel="noopener">API</a>');
      const c5 = G.card(g, 'Viviendas asequibles por año de inicio de obra', 'HPD · todas las categorías', { ancha: true });
      G.columnas(c5.cuerpo, v.asequible_por_anio_inicio.map(x => String(x.anio)), [{ nombre: 'viviendas', valores: v.asequible_por_anio_inicio.map(x => x.viviendas), color: 'var(--accent-2)' }], { H: 200 });
      c5.nota('El año en curso está incompleto. La caída de 2020 coincide con la pandemia.');
    }
  }

  function turismo(L) {
    const r = L.datos.economia_rodajes, D = DECLARADO;
    $('#turismoLead').innerHTML = `Según NYC Tourism + Conventions, la ciudad recibió <b>65 millones de visitantes en 2025</b> (+0,7 % frente a 2024), con menos visitantes internacionales. Ese dato es declarado: no hay API, se cita el comunicado. Lo que sí se mide con datos abiertos es la economía audiovisual: cada rodaje en la calle necesita un permiso de la Alcaldía.`;
    const t = $('#turismoTiles');
    G.tile(t, { valor: '65 M', etiqueta: 'visitantes en 2025', estado: 'declarado', fuente: D.visitantes.f, vigencia: '24-mar-2026' });
    G.tile(t, { valor: '52,4 M', etiqueta: 'visitantes nacionales (+1,7 %)', estado: 'declarado', fuente: 'F29' });
    G.tile(t, { valor: '12,5 M', etiqueta: 'visitantes internacionales (−3,2 %)', estado: 'declarado', fuente: 'F29' });
    G.tile(t, { valor: 'US$ 84,7 mil M', etiqueta: 'impacto económico total', estado: 'declarado', fuente: 'F29' });
    G.tile(t, { valor: 'US$ 55,6 mil M', etiqueta: 'gasto directo de visitantes', estado: 'declarado', fuente: 'F29' });
    if (r) G.tile(t, { valor: fmt.n(r.por_borough.reduce((a, x) => a + x.permisos, 0)), etiqueta: 'permisos de rodaje y eventos en 2025', estado: 'observado', fuente: 'F06 · MOME' });
    const g = grid('turismoGrid');
    if (r) {
      const c1 = G.card(g, 'Permisos de rodaje por borough', '2025');
      G.barras(c1.cuerpo, [...r.por_borough].sort((a, b) => b.permisos - a.permisos).map(x => ({ etiqueta: x.borough, valor: x.permisos, color: BORO_COLOR[x.borough] })));
      if (r.filas_descartadas_por_codificacion.length) c1.calidad(`${r.filas_descartadas_por_codificacion.reduce((a, x) => a + x.conteo, 0)} permisos traen en “borough” un valor que no es un borough (${r.filas_descartadas_por_codificacion.map(x => '“' + esc(x.valor_borough) + '”').join(', ')}). Se cuentan aparte, no se reparten.`);
      c1.fuente(fuente(r));
      const c2 = G.card(g, 'Qué se filma', 'permisos 2025 por categoría');
      G.barras(c2.cuerpo, r.por_categoria.slice(0, 8).map(x => ({ etiqueta: x.categoria, valor: x.permisos, color: 'var(--accent-2)' })), { izq: 130 });
      c2.fuente(fuente(r));
      const c3 = G.card(g, 'Estacionalidad de los rodajes', 'permisos por mes de inicio, 2025', { ancha: true });
      G.lineas(c3.cuerpo, [{ nombre: 'permisos', puntos: r.serie_mensual.map(x => [x.mes, x.permisos]) }], { H: 200 });
    }
    const c4 = G.card(g, 'Turismo 2025 en cifras declaradas', 'NYC Tourism + Conventions, informe anual', { ancha: true });
    G.columnas(c4.cuerpo, ['Nacionales', 'Internacionales'], [{ nombre: 'visitantes', valores: [52.4e6, 12.5e6], color: 'var(--c1)' }], { H: 180, fmt: fmt.k });
    c4.fuente(`Fuente: ${D.visitantes.f}, ${D.visitantes.vig} · <a href="${D.visitantes.url}" target="_blank" rel="noopener">comunicado</a> · estado: declarado (no verificable con microdatos).`);
  }

  function municipio(L) {
    const q = L.datos.calidad_de_vida_311; if (!q) return; const P = porBoro(q.por_borough);
    const peor = [...q.por_borough].filter(x => x.por_1000_hab).sort((a, b) => b.por_1000_hab - a.por_1000_hab)[0];
    $('#municipioLead').innerHTML = `Nueva York se gobierna con una alcaldía central, un Concejo de 51 miembros, 5 presidencias de borough y <b>59 juntas comunitarias</b> que opinan sobre su distrito. El 311 es el canal por el que la ciudadanía reporta problemas: en 2025 recibió <b>${fmt.n(q.total_2025)}</b> solicitudes. Por habitante, el <b>${esc(peor.borough)}</b> es el que más reporta (${fmt.n(peor.por_1000_hab)} por cada 1.000).`;
    const t = $('#municipioTiles');
    G.tile(t, { valor: 'US$ 125,8 mil M', etiqueta: 'presupuesto adoptado FY2027', estado: 'declarado', fuente: DECLARADO.presupuesto.f, vigencia: '30-jun-2026' });
    G.tile(t, { valor: '51', etiqueta: 'miembros del Concejo Municipal', estado: 'declarado', fuente: 'Carta de la Ciudad' });
    G.tile(t, { valor: '59', etiqueta: 'juntas comunitarias (55 PUMA)', estado: 'observado', fuente: 'F19 · DCP' });
    G.tile(t, { valor: fmt.k(q.total_2025), etiqueta: 'solicitudes 311 en 2025', estado: 'observado', fuente: 'F03' });
    G.tile(t, { valor: esc(q.top_tipos[0].tipo), etiqueta: `queja más frecuente (${fmt.k(q.top_tipos[0].solicitudes)})`, estado: 'observado', fuente: 'F03' });
    const g = grid('municipioGrid');
    const c1 = G.card(g, 'Solicitudes 311 por habitante', 'por cada 1.000 habitantes (Censo 2020) · 2025');
    G.barras(c1.cuerpo, BOROS.map(b => P[b]).sort((a, b) => b.por_1000_hab - a.por_1000_hab).map(x => ({ etiqueta: x.borough, valor: x.por_1000_hab, color: BORO_COLOR[x.borough], tip: `${fmt.n(x.solicitudes)} solicitudes` })));
    if (P['No especificado']) c1.nota(`${fmt.n(P['No especificado'].solicitudes)} solicitudes no traen borough y no se reparten.`);
    c1.fuente(fuente(q));
    const c2 = G.card(g, 'Las 12 quejas más frecuentes', 'toda la ciudad, 2025');
    G.barras(c2.cuerpo, q.top_tipos.slice(0, 12).map(x => ({ etiqueta: x.tipo.length > 22 ? x.tipo.slice(0, 21) + '…' : x.tipo, valor: x.solicitudes, color: 'var(--accent-2)', tip: esc(x.tipo) })), { izq: 150, fmt: fmt.k, alto: 22 });
    c2.fuente(fuente(q));
    const c3 = G.card(g, 'Qué pide cada borough', 'los 5 tipos más frecuentes por borough, 2025', { ancha: true });
    G.tabla(c3.cuerpo, [{ k: 'b', t: 'Borough' }, ...[0, 1, 2, 3, 4].map(i => ({ k: 't' + i, t: '#' + (i + 1), f: v => v || '—' }))], BOROS.map(b => { const o = { b }; (q.top_tipos_por_borough[b] || []).forEach((x, i) => o['t' + i] = `${esc(x.tipo)} <small style="color:var(--muted)">${fmt.k(x.solicitudes)}</small>`); return o; }), { orden: null });
    c3.nota('El ruido residencial encabeza el Bronx; el estacionamiento ilegal, Brooklyn, Queens y Staten Island; en Manhattan lo primero es la falta de calefacción o agua caliente. Un mismo problema puede generar muchas llamadas: el 311 mide demanda de servicio, no la gravedad del problema.');
    const c4 = G.card(g, 'Solicitudes por mes', '2025 · toda la ciudad', { ancha: true });
    G.lineas(c4.cuerpo, [{ nombre: 'solicitudes', puntos: q.serie_mensual.map(x => [x.mes, x.solicitudes]) }], { H: 190, cero: false });
    c4.fuente(fuente(q, ' · 12 consultas mensuales (la consulta anual agota el tiempo de la API)'));
  }

  function seguridad(L) {
    const s = L.datos.seguridad_delitos, v = L.datos.seguridad_vial; if (!s) return;
    const S = porBoro(s.datos), H = s.primer_semestre;
    const tot25 = H.datos.reduce((a, x) => a + x.denuncias_2025, 0), tot26 = H.datos.reduce((a, x) => a + x.denuncias_2026, 0);
    const cambio = (tot26 / tot25 - 1) * 100;
    $('#seguridadLead').innerHTML = `En 2025 el NYPD registró <b>${fmt.n(s.total_2025)}</b> denuncias. Entre enero y junio de 2026 hubo <b>${fmt.n(tot26)}</b>, un <b>${fmt.signo(cambio)}</b> frente al mismo semestre de 2025. Una denuncia no es una condena, y no todos los delitos se denuncian por igual: estas cifras miden lo reportado.${v ? ` En el tránsito murieron <b>${fmt.n(v.datos.reduce((a, x) => a + x.fallecidos, 0))}</b> personas en 2025, ${fmt.n(v.datos.reduce((a, x) => a + x.peatones_fallecidos, 0))} de ellas peatones.` : ''}`;
    const t = $('#seguridadTiles');
    G.tile(t, { valor: fmt.signo(cambio), etiqueta: `denuncias ene–jun 2026 vs 2025`, estado: 'derivado', fuente: 'F04 + F14', vigencia: 'hasta ' + H.disponible_hasta });
    const mx = [...s.datos].filter(x => x.graves_por_1000_hab).sort((a, b) => b.graves_por_1000_hab - a.graves_por_1000_hab)[0];
    G.tile(t, { valor: fmt.n(mx.graves_por_1000_hab, 1), unidad: '/1.000', etiqueta: `delitos graves en ${mx.borough}, la tasa más alta`, estado: 'derivado', fuente: 'F04' });
    if (v) { const P = porBoro(v.datos); const tp = v.datos.reduce((a, x) => a + x.peatones_fallecidos, 0), tf = v.datos.reduce((a, x) => a + x.fallecidos, 0); G.tile(t, { valor: fmt.pct(tp / tf * 100, 0), etiqueta: 'de los muertos en el tránsito eran peatones', estado: 'derivado', fuente: 'F02' }); G.tile(t, { valor: fmt.n(v.total_colisiones), etiqueta: 'choques reportados en 2025', estado: 'observado', fuente: 'F02' }); }
    const g = grid('seguridadGrid');
    const c1 = G.card(g, 'Denuncias por 1.000 habitantes y gravedad', '2025 · categoría legal del NYPD');
    G.apiladas(c1.cuerpo, BOROS.map(b => { const x = S[b], p = 1000 / (L.datos.demografia ? porBoro(L.datos.demografia.datos)[b].poblacion_2020 : 1); return { etiqueta: b, g: x.graves * p, m: x.menos_graves * p, i: x.infracciones * p }; }), [{ k: 'g', nombre: 'Graves (felony)', color: 'var(--c4)' }, { k: 'm', nombre: 'Menos graves (misdemeanor)', color: 'var(--c1)' }, { k: 'i', nombre: 'Infracciones (violation)', color: 'var(--c5)' }], { fmt: v => fmt.n(v, 1) });
    c1.fuente(fuente(s));
    const c2 = G.card(g, 'Primer semestre: 2026 frente a 2025', 'denuncias enero–junio por borough');
    G.columnas(c2.cuerpo, H.datos.map(x => x.borough === 'Staten Island' ? 'S. Island' : x.borough), [{ nombre: '2025', valores: H.datos.map(x => x.denuncias_2025), color: 'var(--muted)' }, { nombre: '2026', valores: H.datos.map(x => x.denuncias_2026), color: 'var(--c4)' }]);
    c2.nota(H.datos.map(x => `${x.borough}: ${fmt.signo(x.variacion_pct)}`).join(' · '));
    c2.calidad('El dataset del año en curso (F14) trae fechas de inicio del delito en el año 1016. Por eso se compara por fecha de reporte, igual que las estadísticas oficiales.');
    c2.fuente('Fuente: F04 (histórico) y F14 (año en curso) · NYPD · fecha de reporte');
    const c3 = G.card(g, 'Ofensa más denunciada por borough', '2025', { ancha: true });
    G.tabla(c3.cuerpo, [{ k: 'b', t: 'Borough' }, ...[0, 1, 2].map(i => ({ k: 'o' + i, t: '#' + (i + 1), f: v => esc(v || '—') }))], BOROS.map(b => { const o = { b }; (s.top_ofensas_por_borough[b] || []).slice(0, 3).forEach((x, i) => o['o' + i] = `${x.ofensa} (${fmt.n(x.denuncias)})`); return o; }), {});
    c3.nota('Hurto menor (petit larceny) y acoso (harassment 2) encabezan en casi todos los boroughs: delitos frecuentes, no necesariamente los más graves. La fuente trae edad, raza y sexo de víctima y sospechoso; nada de eso entra al lago.');
    if (v) {
      const c4 = G.card(g, 'Víctimas del tránsito por tipo', 'heridos por 100.000 habitantes · 2025');
      const pob = porBoro(L.datos.demografia.datos);
      G.apiladas(c4.cuerpo, BOROS.map(b => { const x = porBoro(v.datos)[b], k = 1e5 / pob[b].poblacion_2020; return { etiqueta: b, p: x.peatones_heridos * k, c: x.ciclistas_heridos * k, o: x.ocupantes_heridos * k }; }), [{ k: 'p', nombre: 'Peatones', color: 'var(--c4)' }, { k: 'c', nombre: 'Ciclistas', color: 'var(--c2)' }, { k: 'o', nombre: 'Ocupantes de vehículos', color: 'var(--c5)' }], { fmt: v => fmt.n(v, 0) });
      c4.fuente(fuente(v));
      const c5 = G.card(g, 'Fallecidos en el tránsito', '2025 · personas');
      G.barras(c5.cuerpo, BOROS.map(b => porBoro(v.datos)[b]).sort((a, b) => b.fallecidos - a.fallecidos).map(x => ({ etiqueta: x.borough, valor: x.fallecidos, color: BORO_COLOR[x.borough], tip: `${x.peatones_fallecidos} peatones · ${x.ciclistas_fallecidos} ciclistas · ${x.ocupantes_fallecidos} ocupantes<br>${fmt.n(x.fallecidos_por_100k, 2)} por 100.000 hab.` })));
      const ne = porBoro(v.datos)['No especificado'];
      c5.calidad(`${fmt.n(v.recuperados_por_coordenadas)} choques venían sin borough (autopistas y puentes) y se ubicaron por sus coordenadas contra los polígonos oficiales. Quedan ${fmt.n(ne ? ne.colisiones : 0)} sin coordenadas válidas ni borough.`);
      c5.fuente(fuente(v));
      const c6 = G.card(g, 'Choques y heridos por mes', '2025', { ancha: true });
      G.lineas(c6.cuerpo, [{ nombre: 'colisiones', puntos: v.serie_mensual.map(x => [x.mes, x.colisiones]) }, { nombre: 'heridos', puntos: v.serie_mensual.map(x => [x.mes, x.heridos]), color: 'var(--c4)' }], { H: 200 });
    }
  }

  function movilidad(L) {
    const m = L.datos.movilidad, d = L.datos.demografia; if (!m) return;
    const S = m.serie_mensual, mes = k => S.find(x => x.mes === k) || {};
    const completos = S.filter(x => x.subte); const ult = completos[completos.length - 1];
    const base = mes(String(+ult.mes.slice(0, 4) - 1) + ult.mes.slice(4));
    const crz = S.filter(x => x.ingresos_zona_congestion);
    $('#movilidadLead').innerHTML = `El subte movió en promedio <b>${fmt.n(ult.subte)}</b> viajes diarios en ${ult.mes}. La recuperación se lee contra el mismo mes del año anterior, para no confundirla con la estacionalidad. Desde el 5 de enero de 2025 los vehículos que entran a Manhattan bajo la calle 60 pagan un peaje de congestión: la MTA publica cuántos ingresan cada día.`;
    const t = $('#movilidadTiles');
    G.tile(t, { valor: fmt.k(ult.subte), etiqueta: `viajes diarios en subte, ${ult.mes}`, estado: 'observado', fuente: 'F17 · MTA' });
    if (base.subte) G.tile(t, { valor: fmt.signo((ult.subte / base.subte - 1) * 100), etiqueta: `frente a ${base.mes}`, estado: 'derivado', fuente: 'F17' });
    if (crz.length) G.tile(t, { valor: fmt.k(crz[crz.length - 1].ingresos_zona_congestion), etiqueta: `vehículos diarios a la zona de congestión (${crz[crz.length - 1].mes})`, estado: 'observado', fuente: 'F17' });
    if (d) { const B = porBoro(d.datos); G.tile(t, { valor: fmt.pct(B.Manhattan.pct_hogares_sin_auto), etiqueta: 'de los hogares de Manhattan no tiene auto', estado: 'observado', fuente: 'F10 · B08201' }); G.tile(t, { valor: fmt.n(m.estaciones.filas_dataset), etiqueta: 'paradas de subte y SIR en el dataset MTA', estado: 'observado', fuente: 'F18' }); }
    const g = grid('movilidadGrid');
    const c1 = G.card(g, 'Viajes diarios promedio por mes', 'subte y bus · marzo 2020 en adelante', { ancha: true });
    G.lineas(c1.cuerpo, [{ nombre: 'Subte', puntos: S.filter(x => x.subte).map(x => [x.mes, x.subte]), color: 'var(--c1)' }, { nombre: 'Bus', puntos: S.filter(x => x.bus).map(x => [x.mes, x.bus]), color: 'var(--c2)' }], { H: 240, marcas: [{ x: '2025-01', texto: 'peaje de congestión' }] });
    c1.nota('Promedio diario = suma del mes ÷ días con dato, para comparar meses de distinta duración. El último mes puede estar incompleto.');
    c1.fuente(fuente(m));
    if (crz.length) {
      const c2 = G.card(g, 'Ingresos a la zona de congestión', 'vehículos por día, promedio mensual');
      G.lineas(c2.cuerpo, [{ nombre: 'zona de cobro (CRZ)', puntos: crz.map(x => [x.mes, x.ingresos_zona_congestion]), color: 'var(--c4)' }].concat(S.some(x => x.ingresos_cbd) ? [{ nombre: 'distrito central (CBD)', puntos: S.filter(x => x.ingresos_cbd).map(x => [x.mes, x.ingresos_cbd]), color: 'var(--c5)', punteada: 1 }] : []), { H: 210, cero: false });
      c2.fuente(fuente(m));
    }
    if (d) {
      const c3 = G.card(g, 'Cómo se llega al trabajo', '% de trabajadores en transporte público · ACS');
      G.barras(c3.cuerpo, [...d.datos].sort((a, b) => b.pct_transporte_publico - a.pct_transporte_publico).map(x => ({ etiqueta: x.borough, valor: x.pct_transporte_publico, color: BORO_COLOR[x.borough], tip: `${fmt.pct(x.pct_teletrabajo)} trabaja desde casa<br>${fmt.pct(x.pct_hogares_sin_auto)} de hogares sin auto` })), { fmt: v => fmt.pct(v), max: 100 });
      c3.fuente(fuente(d, ' · tablas B08301, B08201'));
      const c4 = G.card(g, 'Estaciones de subte por borough', 'filas del dataset MTA (una por estación-línea)');
      G.barras(c4.cuerpo, BOROS.map(b => ({ etiqueta: b, valor: m.estaciones.por_borough[b] || 0, color: BORO_COLOR[b], tip: `${m.estaciones.complejos_por_borough[b] || 0} complejos` })));
      c4.nota('Staten Island no tiene subte: sus 21 paradas son del ferrocarril de Staten Island (SIR), que la MTA publica en el mismo dataset. La MTA comunica 472 estaciones de subte porque cuenta las estaciones de transbordo de otra forma.');
      c4.fuente('Fuente: F18 · MTA Subway Stations (data.ny.gov)');
    }
  }

  function ambiente(L) {
    const a = L.datos.ambiente; if (!a) return;
    const s = a.aire_serie, ciudad = s.filter(x => x.lugar === 'Ciudad').sort((x, y) => x.anio - y.anio);
    const ini = ciudad[0], fin = ciudad[ciudad.length - 1];
    $('#ambienteLead').innerHTML = `La concentración media de partículas finas (PM2,5) en la ciudad bajó de <b>${fmt.n(ini.pm25, 1)}</b> µg/m³ en ${ini.anio} a <b>${fmt.n(fin.pm25, 1)}</b> en ${fin.anio} (${fmt.signo((fin.pm25 / ini.pm25 - 1) * 100, 0)}), según la red de monitoreo comunitario del Departamento de Salud. Dentro de la ciudad, Manhattan sigue claramente arriba (más tráfico y edificios por km²). El arbolado de calle es de 2015: el censo 2025 aún no se publica como dato abierto.`;
    const t = $('#ambienteTiles');
    G.tile(t, { valor: fmt.n(fin.pm25, 2), unidad: 'µg/m³', etiqueta: `PM2,5 media anual en la ciudad (${fin.anio})`, estado: 'observado', fuente: 'F15 · NYCCAS' });
    G.tile(t, { valor: fmt.signo((fin.pm25 / ini.pm25 - 1) * 100, 0), etiqueta: `PM2,5 ${ini.anio}–${fin.anio}`, estado: 'derivado', fuente: 'F15' });
    G.tile(t, { valor: fmt.n(fin.no2, 1), unidad: 'ppb', etiqueta: `NO₂ media anual (${fin.anio})`, estado: 'observado', fuente: 'F15' });
    const arb = a.arboles_por_borough; G.tile(t, { valor: fmt.k(arb.reduce((x, y) => x + y.arboles, 0)), etiqueta: 'árboles de calle censados (2015)', estado: 'observado', fuente: 'F07 · NYC Parks' });
    const g = grid('ambienteGrid');
    const c1 = G.card(g, 'PM2,5 media anual por borough', 'µg/m³', { ancha: true });
    const lugares = ['Ciudad', ...BOROS];
    G.lineas(c1.cuerpo, lugares.map(l => ({ nombre: l, puntos: s.filter(x => x.lugar === l && x.pm25 != null).sort((p, q) => p.anio - q.anio).map(x => [String(x.anio), x.pm25]), color: l === 'Ciudad' ? 'var(--text)' : BORO_COLOR[l], grosor: l === 'Ciudad' ? 3 : 1.6, punteada: l === 'Ciudad' })), { H: 250, cero: false, fmtY: v => fmt.n(v, 1), fmtV: v => fmt.n(v, 2) + ' µg/m³' });
    c1.nota('Referencia: la OMS recomienda una media anual de 5 µg/m³ (2021) y la EPA fijó 9 µg/m³ como norma nacional (2024).');
    c1.calidad('La fuente trae para cada año tres filas por lugar (media anual, de verano y de invierno) con la misma etiqueta de periodo. Si no se filtra por “Annual mean”, las tres se mezclan.');
    c1.fuente(fuente(a));
    const c2 = G.card(g, 'Árboles de calle por km²', 'censo 2015 · estado de salud');
    G.apiladas(c2.cuerpo, BOROS.map(b => { const x = porBoro(arb)[b], k = x.arboles_por_km2 / x.arboles; return { etiqueta: b, buena: x.buena * k, regular: x.regular * k, mala: x.mala * k, sin: x.sin_registro * k }; }), [{ k: 'buena', nombre: 'Buena', color: 'var(--good)' }, { k: 'regular', nombre: 'Regular', color: 'var(--c1)' }, { k: 'mala', nombre: 'Mala', color: 'var(--c4)' }, { k: 'sin', nombre: 'Sin registro (tocón o muerto)', color: 'var(--muted)' }], { fmt: v => fmt.n(v, 0) });
    c2.fuente('Fuente: F07 · NYC Parks, 2015 Street Tree Census · superficie F20');
    const c3 = G.card(g, '¿Aire más sucio donde hay menos ingreso?', 'cada punto es un distrito · ver Correlaciones');
    const D = L.datos.distritos ? L.datos.distritos.datos.filter(p => p.pm25 && p.ingreso_mediano) : [];
    if (D.length) { G.dispersion(c3.cuerpo, D.map(p => ({ x: p.ingreso_mediano, y: p.pm25, nombre: p.nombre, color: BORO_COLOR[p.borough], tip: `<b>${esc(p.nombre)}</b><br>${fmt.usd(p.ingreso_mediano)} · ${fmt.n(p.pm25, 2)} µg/m³` })), { H: 300, ejeX: 'Ingreso mediano (US$)', ejeY: 'PM2,5 (µg/m³)', fmtX: fmt.k, fmtY: v => fmt.n(v, 1) }); const r = G.pearson(D.map(p => p.ingreso_mediano), D.map(p => p.pm25)); const rp = G.pearson(D.map(p => p.pct_pobreza), D.map(p => p.pm25)); c3.nota(`r ingreso–PM2,5 = ${fmt.n(r, 2)}; r pobreza–PM2,5 = ${fmt.n(rp, 2)}. Respuesta honesta a la pregunta: <b>con estos datos, no</b>. El PM2,5 más alto está en el centro de Manhattan, donde se concentran tráfico y edificios, y ahí viven hogares de altos ingresos. Esto no descarta otras desigualdades ambientales (asma, cercanía a autopistas e industria), que este lago no mide.`); }
  }

  function escucha(L) {
    const e = L.datos.escucha_interes; if (!e) return;
    const ny = e.series.find(s => s.articulo === 'en:New_York_City'), es = e.series.find(s => s.articulo === 'es:Nueva_York');
    const pico = [...ny.puntos].sort((a, b) => b.vistas - a.vistas)[0];
    const total12 = ny.puntos.slice(-12).reduce((a, x) => a + x.vistas, 0);
    $('#escuchaLead').innerHTML = `El Cerebro Lima escucha redes sociales con fuentes propias; aquí no inventamos menciones. Usamos un proxy abierto y verificable: cuántas personas leen los artículos de Wikipedia de la ciudad y de cada borough. Mide <b>interés</b>, no opinión. El mes de mayor atención fue <b>${pico.mes}</b> (${fmt.n(pico.vistas)} vistas del artículo en inglés).`;
    const t = $('#escuchaTiles');
    G.tile(t, { valor: fmt.k(total12), etiqueta: 'vistas de “New York City” en los últimos 12 meses', estado: 'observado', fuente: 'F08 · Wikimedia' });
    G.tile(t, { valor: pico.mes, etiqueta: 'mes de mayor interés', estado: 'derivado', fuente: 'F08' });
    if (es) G.tile(t, { valor: fmt.k(es.puntos.slice(-12).reduce((a, x) => a + x.vistas, 0)), etiqueta: 'vistas de “Nueva York” (Wikipedia en español), 12 meses', estado: 'observado', fuente: 'F08' });
    const g = grid('escuchaGrid');
    const c1 = G.card(g, 'Interés por la ciudad', 'vistas mensuales de personas (sin bots)', { ancha: true });
    G.lineas(c1.cuerpo, [{ nombre: 'New York City (inglés)', puntos: ny.puntos.map(x => [x.mes, x.vistas]), color: 'var(--c1)' }].concat(es ? [{ nombre: 'Nueva York (español)', puntos: es.puntos.map(x => [x.mes, x.vistas]), color: 'var(--c2)' }] : []), { H: 230 });
    c1.fuente(fuente(e));
    const c2 = G.card(g, 'Interés por borough', 'vistas mensuales del artículo de cada borough', { ancha: true });
    G.lineas(c2.cuerpo, e.series.filter(s => BOROS.includes(s.etiqueta)).map(s => ({ nombre: s.etiqueta, puntos: s.puntos.map(x => [x.mes, x.vistas]), color: BORO_COLOR[s.etiqueta] })), { H: 230 });
    c2.nota('Los picos suelen coincidir con noticias: elecciones municipales, eventos deportivos, clima extremo. Es un termómetro de atención externa, no un sondeo.');
    c2.fuente(fuente(e));
  }

  function fuentes(L) {
    const c = L.datos.catalogo; if (!c) return; const F = c.fuentes, cuenta = e => F.filter(f => f.estado === e).length;
    $('#fuentesLead').innerHTML = `El lago se reconstruye con un solo comando (<code>python scripts/construir_lago.py</code>) que consulta las APIs, agrega y escribe cada archivo con su bloque <code>_meta</code>: fuente, consulta exacta, licencia y fecha en que la API respondió. Las fuentes candidatas y descartadas también están aquí: explican las decisiones.`;
    const t = $('#fuentesTiles');
    [['Integrada al lago', 'integradas al lago', 'ok'], ['Candidata', 'candidatas', 'med'], ['Descartada', 'descartadas', 'mal']].forEach(([e, l]) => G.tile(t, { valor: String(cuenta(e)), etiqueta: 'fuentes ' + l, estado: 'observado', fuente: 'catálogo' }));
    G.tile(t, { valor: String(F.filter(f => f.licencia.startsWith('no declara')).length), etiqueta: 'fuentes que no declaran licencia en sus metadatos', estado: 'observado', fuente: '/api/views/{id}.json' });
    G.tile(t, { valor: String(F.filter(f => f.personas === 'Personas identificables').length), etiqueta: 'fuentes con personas identificables (solo se guardan agregados)', estado: 'observado', fuente: 'catálogo' });
    const g = grid('fuentesGrid');
    const c1 = G.card(g, 'Catálogo de fuentes', 'espejo de la hoja «1. Fuentes» del diccionario de datos', { ancha: true });
    const pill = e => `<span class="pill ${e === 'Integrada al lago' ? 'ok' : e === 'Candidata' ? 'med' : 'mal'}">${esc(e)}</span>`;
    G.tabla(c1.cuerpo, [{ k: 'id', t: 'ID' }, { k: 'nombre', t: 'Conjunto de datos', wrap: 1 }, { k: 'entidad', t: 'Publica', wrap: 1 }, { k: 'como_se_obtiene', t: 'Acceso' }, { k: 'personas', t: 'Personas' }, { k: 'frecuencia', t: 'Frecuencia' }, { k: 'estado', t: 'Estado', f: pill }, { k: 'url', t: 'Enlace', f: u => `<a href="${esc(u)}" target="_blank" rel="noopener">abrir</a>` }], F, { orden: 'id', dir: 1, alto: 520 });
    c1.fuente('Licencias, observaciones completas y la bitácora de IA: Diccionario_de_datos_TallerDatos_NuevaYork.xlsx. Ninguno de los datasets de NYC Open Data ni de data.ny.gov declara licencia en sus metadatos; el portal se rige por la Local Law 11 de 2012 y sus Términos de Uso.');
    const c2 = G.card(g, 'Principios de gobernanza', 'cómo se tomó cada decisión');
    c2.cuerpo.innerHTML = `<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.65">
      <li><b>Trazabilidad.</b> Toda cifra lleva un ID de fuente (F02…F32) que coincide con el diccionario, y cada tile dice si es <span class="estado observado">observado</span>, <span class="estado derivado">derivado</span>, <span class="estado transcrito">transcrito</span> o <span class="estado declarado">declarado</span>.</li>
      <li><b>Minimización.</b> De las fuentes con personas identificables (DOB, NYPD) solo se guardan conteos por borough o distrito. Las coordenadas de delitos se usan para asignar distrito y se descartan.</li>
      <li><b>Reproducibilidad.</b> Nada de llaves ni sesiones: todo sale de APIs abiertas con consultas documentadas en <code>_meta</code>.</li>
      <li><b>Honestidad sobre la calidad.</b> Los defectos de las fuentes se muestran junto al gráfico (recuadros morados), no se esconden.</li>
      <li><b>No suponer licencias.</b> Si la fuente no la declara, se escribe «no declara».</li></ul>`;
    const c3 = G.card(g, 'Hallazgos de calidad de datos', 'defectos encontrados al construir el lago');
    c3.cuerpo.innerHTML = `<ol style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.6">
      <li>DOB NOW repite las viviendas de una obra en cada trámite: sin depurar, ×13.</li>
      <li>El sistema legado del DOB guarda fechas como texto: un filtro de fecha devuelve 0 filas sin error.</li>
      <li>La “población 2020” de NYC Open Data (F25) es una proyección de 2013, 253 mil personas por debajo del Censo.</li>
      <li>NYPD año en curso trae delitos “iniciados” en el año 1016.</li>
      <li>Aire: tres mediciones por año con la misma etiqueta de periodo.</li>
      <li>Film Permits trae, en su histórico, tipos de evento en el campo “borough”.</li>
      <li>El campo de distrito de DOB NOW se llama <code>commmunity_board</code> (triple m).</li>
      <li>La API del Censo hoy exige llave; la población 2020 por borough del DCP solo está en una página dinámica.</li></ol>`;
    const c4 = G.card(g, 'Reconstruir el lago', 'de la API al tablero en un comando', { ancha: true });
    c4.cuerpo.innerHTML = `<pre style="margin:0;font-size:12px;background:var(--surface-2);padding:12px;border-radius:8px;overflow-x:auto">python scripts/construir_lago.py        # consulta las APIs y reescribe lago/*.json y lago/lago.js
python scripts/generar_entregables.py   # regenera el diccionario de datos (Excel) desde el mismo catálogo
python scripts/verificar_lago.py        # comprueba que cada campo del lago esté en el diccionario</pre>`;
  }

  window.SECCIONES = {
    render(L) { [panorama, gente, economia, turismo, municipio, seguridad, movilidad, ambiente, escucha, fuentes].forEach(f => { try { f(L); } catch (e) { console.error(f.name, e); } }); }
  };
})();
