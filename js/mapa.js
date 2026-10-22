// Gemelo territorial 3D: MapLibre + teselas OpenFreeMap (OSM) + límites oficiales del DCP + indicadores del lago.
(function () {
  const $ = s => document.querySelector(s);
  // Solo el ícono y la clave: nombre, unidad, fuente, vigencia y margen de error salen de lago/distritos.json
  const LENTES = {
    atencion: { icono: '◎', nombre: 'Atención' }, ingreso_mediano: { icono: '$', usd: true, nombre: 'Ingreso' }, pct_hogares_con_carga_alquiler: { icono: '⌂', nombre: 'Alquiler' },
    solicitudes_311_por_1000: { icono: '☎', nombre: '311' }, delitos_graves_por_1000: { icono: '⚠', nombre: 'Delitos' }, heridos_transito_por_10000: { icono: '✚', nombre: 'Tránsito' },
    pm25: { icono: '☁', nombre: 'Aire' }, pct_transporte_publico: { icono: '≋', nombre: 'Transporte' },
  };
  const defL = k => k === 'atencion' ? { etiqueta: 'Índice de atención · ' + DIAGNOSTICO.perfil(), unidad: '/100', decimales: 0 } : (LG.metrica(k) || {});
  const provL = k => k === 'atencion' ? LG.unir('Índice de atención: promedio ponderado de los percentiles de seis dimensiones', ...Object.values(DIAGNOSTICO.DIM).map(d => LG.provMetrica(d.k))) : LG.provMetrica(k);
  const RAMPA = ['#fbf0d9', '#f2c879', '#e0913a', '#b45a1c', '#6e2c0e'];
  const ESTILO = { claro: 'https://tiles.openfreemap.org/styles/liberty', oscuro: 'https://tiles.openfreemap.org/styles/dark' };
  let map, L, lente = 'atencion', sel = null, capas = { edificios: true, extruir: false, estaciones: false, precintos: false, barrios: false, satelite: false }, D = {}, temporal = null, punto = null, radio = 1000;

  const oscuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const valor = (p, k) => temporal ? (temporal.valores[p.borough] ?? null) : k === 'atencion' ? DIAGNOSTICO.puntaje(p.puma) : p[k];
  const fmtV = (v, k) => v == null ? '—' : temporal ? G.fmt.n(v, 2) + ' ' + temporal.unidad : LENTES[k].usd ? G.fmt.usd(v) : G.fmt.n(v, defL(k).decimales ?? 1) + (defL(k).unidad === '%' ? ' %' : '');

  function cortes(k) { const v = Object.values(D).map(p => valor(p, k)).filter(x => x != null).sort((a, b) => a - b); if (!v.length) return [0, 0, 0, 0, 0]; return [0, .25, .5, .75, 1].map(q => v[Math.round(q * (v.length - 1))]); }

  function geojsonDistritos() {
    const g = JSON.parse(JSON.stringify(L.geo.distritos_puma));
    g.features.forEach(f => { const p = D[f.properties.puma]; f.properties.v = p ? valor(p, lente) : null; f.id = +f.properties.puma; });
    return g;
  }

  function colorExpr() {
    if (temporal && temporal.cambio) return ['case', ['==', ['get', 'v'], null], '#89909a', ['interpolate', ['linear'], ['get', 'v'], -temporal.max, '#287d68', 0, '#eeeeee', temporal.max, '#bd4839']];
    const c = cortes(lente); const e = ['interpolate', ['linear'], ['coalesce', ['get', 'v'], c[0]]];
    c.forEach((x, i) => { if (i && x <= c[i - 1]) x = c[i - 1] + 1e-6; c[i] = x; e.push(x, RAMPA[i]); });
    return ['case', ['==', ['get', 'v'], null], '#89909a', e];
  }

  // las capas propias van sobre calles y edificios del mapa base pero bajo las etiquetas
  function primeraCapaSimbolos() { const ls = map.getStyle().layers; let ult = -1; ls.forEach((l, i) => { if (l.type !== 'symbol') ult = i; }); const s = ls.slice(ult + 1).find(l => l.type === 'symbol'); return s && s.id; }

  function agregarCapas() {
    const antes = primeraCapaSimbolos();
    map.addSource('esri', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics' });
    map.addLayer({ id: 'satelite', type: 'raster', source: 'esri', layout: { visibility: capas.satelite ? 'visible' : 'none' } }, antes);
    map.addSource('distritos', { type: 'geojson', data: geojsonDistritos() });
    map.addSource('boroughs', { type: 'geojson', data: L.geo.boroughs });
    map.addLayer({ id: 'dist-fill', type: 'fill', source: 'distritos', paint: { 'fill-color': colorExpr(), 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], .85, .62] }, layout: { visibility: capas.extruir ? 'none' : 'visible' } }, antes);
    map.addLayer({ id: 'dist-ext', type: 'fill-extrusion', source: 'distritos', paint: { 'fill-extrusion-color': colorExpr(), 'fill-extrusion-opacity': .85, 'fill-extrusion-height': altura() }, layout: { visibility: capas.extruir ? 'visible' : 'none' } }, antes);
    map.addLayer({ id: 'dist-line', type: 'line', source: 'distritos', paint: { 'line-color': oscuro() ? '#0a0d12' : '#ffffff', 'line-width': .8 } }, antes);
    map.addLayer({ id: 'dist-sel', type: 'line', source: 'distritos', paint: { 'line-color': oscuro() ? '#ffffff' : '#111111', 'line-width': 3 }, filter: ['==', ['get', 'puma'], sel || ''] }, antes);
    map.addLayer({ id: 'boro-line', type: 'line', source: 'boroughs', paint: { 'line-color': oscuro() ? '#e8a33d' : '#6e2c0e', 'line-width': 1.6 } }, antes);
    if (L.geo.barrios_nta) { map.addSource('nta', { type: 'geojson', data: L.geo.barrios_nta }); map.addLayer({ id: 'nta', type: 'line', source: 'nta', paint: { 'line-color': '#1f7f7f', 'line-width': .7, 'line-dasharray': [2, 2] }, layout: { visibility: capas.barrios ? 'visible' : 'none' } }, antes); }
    if (L.geo.precintos) { map.addSource('prec', { type: 'geojson', data: L.geo.precintos }); map.addLayer({ id: 'precintos', type: 'line', source: 'prec', paint: { 'line-color': '#c2473b', 'line-width': 1 }, layout: { visibility: capas.precintos ? 'visible' : 'none' } }, antes); }
    // edificios 3D desde las teselas OSM (fuente 'openmaptiles' de OpenFreeMap)
    const src = Object.keys(map.getStyle().sources).find(s => map.getStyle().sources[s].type === 'vector');
    map.getStyle().layers.filter(l => l.type === 'fill-extrusion' && l.id !== 'dist-ext').forEach(l => map.removeLayer(l.id));
    if (src) map.addLayer({ id: 'edificios-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 13, paint: { 'fill-extrusion-color': oscuro() ? '#2a3441' : '#d9d2c5', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .85 }, layout: { visibility: capas.edificios ? 'visible' : 'none' } });
    if (L.geo.estaciones) { map.addSource('est', { type: 'geojson', data: L.geo.estaciones }); map.addLayer({ id: 'estaciones', type: 'circle', source: 'est', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 6], 'circle-color': oscuro() ? '#ffffff' : '#111111', 'circle-stroke-color': '#e8a33d', 'circle-stroke-width': 1 }, layout: { visibility: capas.estaciones ? 'visible' : 'none' } }); }
  }

  function altura() { const c = cortes(lente); return ['*', 6000, ['/', ['-', ['coalesce', ['get', 'v'], c[0]], c[0]], (c[4] - c[0]) || 1]]; }

  function refrescar() {
    if (!map || !map.getSource('distritos')) return;
    map.getSource('distritos').setData(geojsonDistritos());
    map.setPaintProperty('dist-fill', 'fill-color', colorExpr());
    map.setPaintProperty('dist-ext', 'fill-extrusion-color', colorExpr());
    map.setPaintProperty('dist-ext', 'fill-extrusion-height', altura());
    leyenda();
  }

  function leyenda() {
    const c = cortes(lente), l = defL(lente);
    if (temporal) { $('#leyendaMapa').innerHTML = `<b>${G.esc(temporal.titulo)}</b><p>${temporal.cambio ? 'Verde: disminuye · gris: sin cambio · rojo: aumenta' : 'Escala de menor a mayor'} · ${G.esc(temporal.unidad)}</p><small>${G.esc(temporal.fuente)} · datos por borough, repetidos en sus PUMA. Gris oscuro: sin dato.</small>`; return; }
    const p = provL(lente);
    $('#leyendaMapa').innerHTML = `<b style="color:var(--text)">${G.esc(l.etiqueta)}</b> <span style="font-size:10px">${G.esc(l.unidad || '')}</span><div class="esc" style="background:linear-gradient(90deg,${RAMPA.join(',')})"></div><div class="ext"><span>${fmtV(c[0], lente)}</span><span>${fmtV(c[2], lente)}</span><span>${fmtV(c[4], lente)}</span></div><button type="button" class="leyenda-fuente">${G.chipTipo(p.tipo)} ${G.lineaProv(p)} · ⓘ</button><div style="margin-top:3px;font-size:10px">Cortes por cuartil. Un distrito cerca de un corte puede caer en el color vecino dentro de su margen de error: el valor con ± está en la ficha.</div>`;
    $('#leyendaMapa .leyenda-fuente').onclick = () => G.ficha(p, l.etiqueta);
  }

  const FICHA = ['poblacion_acs', 'densidad_hab_km2', 'ingreso_mediano', 'alquiler_mediano', 'pct_hogares_con_carga_alquiler', 'pct_pobreza', 'pct_transporte_publico',
    'pct_nacidos_extranjero', 'solicitudes_311_por_1000', 'delitos_graves_por_1000', 'heridos_transito_por_10000', 'peatones_heridos_por_10000', 'pm25',
    'arboles_calle_por_km2', 'viviendas_obra_nueva_por_1000', 'viviendas_asequibles_por_1000'];
  function ficha(puma) {
    const p = D[puma]; if (!p) return;
    const r = DIAGNOSTICO.intervalo(puma);
    const fila = k => {
      const d = LG.metrica(k); if (!d) return '';
      const v = p[k], m = LG.moe(p, k), dec = d.decimales ?? 0;
      const txt = d.unidad.startsWith('US$') ? G.fmt.usd(v) : G.fmt.n(v, dec) + (d.unidad === '%' ? ' %' : '');
      return `<button type="button" class="kv" data-ficha="${k}"><span>${G.esc(d.etiqueta)} <small>${G.esc(d.unidad === '%' ? '' : d.unidad)} · ${G.esc(LG.ids(d.fuente).join('+'))}</small></span><span>${txt}${m != null ? `<small class="moe"> ±${G.fmt.n(m, dec || 1)}</small>` : ''}</span></button>`;
    };
    $('#ficha').innerHTML = `<div class="diag-tag">Distrito seleccionado · PUMA ${p.puma}</div><h3>${G.esc(p.nombre)}</h3><div class="sub" style="font-size:11.5px;color:var(--muted);font-family:'IBM Plex Mono'">${G.esc(p.etiqueta)}</div>
      <div class="veredicto" style="margin:10px 0"><span class="rk" style="font-size:22px">${r ? DIAGNOSTICO.textoRango(r) : '—'}</span> de 55 en atención (${DIAGNOSTICO.perfil()})<div class="sub">intervalo del puesto con el margen de error del ACS</div></div>
      ${FICHA.map(fila).join('')}
      <button class="chip" id="fichaDiag" style="margin-top:12px">Ver en el diagnóstico ↑</button>
      <div style="font-size:10.5px;color:var(--muted);margin-top:10px">Toca cualquier fila para ver su fuente, vigencia, fecha de prueba y cómo se calculó. ± es el margen de error al 90 % del ACS.</div>`;
    $('#ficha').querySelectorAll('[data-ficha]').forEach(b => b.onclick = () => G.ficha(LG.provMetrica(b.dataset.ficha, { moe: LG.moe(p, b.dataset.ficha) }), `${LG.metrica(b.dataset.ficha).etiqueta} · ${p.nombre}`));
    $('#fichaDiag').onclick = () => { DIAGNOSTICO.elegir(puma); document.getElementById('panorama').scrollIntoView({ behavior: 'smooth' }); };
  }

  function seleccionar(puma, volar) {
    sel = puma; ficha(puma);
    if (map && map.getLayer('dist-sel')) map.setFilter('dist-sel', ['==', ['get', 'puma'], puma]);
    if (volar && map) { const f = L.geo.distritos_puma.features.find(x => x.properties.puma === puma); if (f) { const b = new maplibregl.LngLatBounds(); f.geometry.coordinates.forEach(p => p[0].forEach(c => b.extend(c))); map.fitBounds(b, { padding: 60, maxZoom: 13.5, duration: 900 }); } }
  }

  function telemetria() { const c = map.getCenter(); $('#telemetria').innerHTML = `GEMELO / TELEMETRÍA<br>LAT <b>${c.lat.toFixed(4)}</b> LON <b>${c.lng.toFixed(4)}</b><br>ZOOM <b>${map.getZoom().toFixed(1)}</b> · INCL. <b>${map.getPitch().toFixed(0)}°</b> · RUMBO <b>${map.getBearing().toFixed(0)}°</b><br>LENTE <b>${G.esc(LENTES[lente].nombre)}</b>`; }

  function controles() {
    $('#lentes').innerHTML = Object.entries(LENTES).map(([k, l]) => `<button data-l="${k}" class="${k === lente ? 'on' : ''}" title="${G.esc(defL(k).etiqueta || '')}">${l.icono} ${G.esc(l.nombre)}</button>`).join('');
    $('#lentes').querySelectorAll('button').forEach(b => b.onclick = () => { temporal = null; lente = b.dataset.l; $('#lentes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); refrescar(); telemetria(); });
    const C = { edificios: '▥ edificios 3D', extruir: '▲ indicador en 3D', estaciones: '● estaciones subte', precintos: '▢ precintos NYPD', barrios: '⬚ barrios (NTA)', satelite: '◐ satélite' };
    $('#capas').innerHTML = Object.entries(C).map(([k, t]) => `<button data-c="${k}" class="${capas[k] ? 'on' : ''}" aria-pressed="${capas[k]}">${t}</button>`).join('') + '<button data-c="vista3d">⟳ vista 3D</button>';
    $('#capas').querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = b.dataset.c;
      if (k === 'vista3d') { const p = map.getPitch() > 10; map.easeTo({ pitch: p ? 0 : 58, bearing: p ? 0 : -28, zoom: p ? map.getZoom() : Math.max(map.getZoom(), 11.2), duration: 1000 }); return; }
      capas[k] = !capas[k]; b.classList.toggle('on', capas[k]); b.setAttribute('aria-pressed', capas[k]);
      const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      if (k === 'extruir') { vis('dist-ext', capas.extruir); vis('dist-fill', !capas.extruir); if (capas.extruir && map.getPitch() < 30) map.easeTo({ pitch: 55, bearing: -25, duration: 900 }); }
      else vis({ edificios: 'edificios-3d', estaciones: 'estaciones', precintos: 'precintos', barrios: 'nta', satelite: 'satelite' }[k], capas[k]);
    });
  }

  function dibujarRadio() {
    if (!map || !map.getSource('distritos') || !punto) return;
    const data = ANALISIS.circulo(punto, radio);
    if (map.getSource('radio-analisis')) { map.getSource('radio-analisis').setData(data); return; }
    map.addSource('radio-analisis', {type:'geojson', data});
    map.addLayer({id:'radio-fill',type:'fill',source:'radio-analisis',paint:{'fill-color':'#267c96','fill-opacity':0.12}});
    map.addLayer({id:'radio-line',type:'line',source:'radio-analisis',paint:{'line-color':'#267c96','line-width':2}});
  }
  window.MAPA = {
    init(lago) {
      L = lago; LG.distritos().forEach(p => D[p.puma] = p);
      controles(); leyenda();
      if (!window.maplibregl || !L.geo.distritos_puma) { $('#mapa').innerHTML = '<div class="mapa-aviso">No se pudo cargar MapLibre o la geometría (¿sin conexión?). El resto del cerebro funciona igual.</div>'; return; }
      try {
        map = new maplibregl.Map({ container: 'mapa', style: oscuro() ? ESTILO.oscuro : ESTILO.claro, center: [-73.94, 40.70], zoom: 9.6, pitch: 0, attributionControl: { compact: true }, cooperativeGestures: matchMedia('(pointer:coarse)').matches });
      } catch (e) { $('#mapa').innerHTML = '<div class="mapa-aviso">Tu navegador no soporta WebGL: el mapa 3D no está disponible.</div>'; return; }
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.on('style.load', () => { agregarCapas(); dibujarRadio(); telemetria(); });
      map.on('move', telemetria);
      map.on('click', e => window.LABORATORIO && LABORATORIO.punto([e.lngLat.lng, e.lngLat.lat]));
      let hov = null;
      map.on('mousemove', 'dist-fill', e => { map.getCanvas().style.cursor = 'pointer'; const f = e.features[0]; if (hov !== null) map.setFeatureState({ source: 'distritos', id: hov }, { hover: false }); hov = f.id; map.setFeatureState({ source: 'distritos', id: hov }, { hover: true }); });
      map.on('mouseleave', 'dist-fill', () => { map.getCanvas().style.cursor = ''; if (hov !== null) map.setFeatureState({ source: 'distritos', id: hov }, { hover: false }); hov = null; });
      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      ['dist-fill', 'dist-ext'].forEach(id => map.on('click', id, e => { const p = e.features[0].properties; seleccionar(p.puma); pop.setLngLat(e.lngLat).setHTML(`<b>${G.esc(p.nombre)}</b><br>${G.esc(defL(lente).etiqueta || '')}: <b>${fmtV(D[p.puma] ? valor(D[p.puma], lente) : null, lente)}</b>${lente !== 'atencion' && D[p.puma] && LG.moe(D[p.puma], lente) != null ? ` ±${G.fmt.n(LG.moe(D[p.puma], lente), 1)}` : ''}`).addTo(map); }));
      map.on('click', 'estaciones', e => { const p = e.features[0].properties; new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setHTML(`<b>${G.esc(p.nombre)}</b><br>Líneas ${G.esc(p.lineas)} · ${G.esc(p.borough || '')}${p.ada === '1' ? ' · accesible' : ''}`).addTo(map); });
      seleccionar(Object.keys(D).sort((a, b) => DIAGNOSTICO.rango(a) - DIAGNOSTICO.rango(b))[0]);
    },
    seleccionar,
    actualizarIndice() { if (lente === 'atencion' && !temporal) refrescar(); if (sel) ficha(sel); },
    indice() { temporal = null; lente = 'atencion'; controles(); refrescar(); },
    temporal(t) { temporal = t; refrescar(); },
    radio(p, metros) { punto = p; radio = metros; dibujarRadio(); },
    tema() { if (!map) return; map.setStyle(oscuro() ? ESTILO.oscuro : ESTILO.claro); },
    redimensionar() { map && map.resize(); },
    lugares() { return Object.values(D).map(p => ({ nombre: `${p.nombre} (${p.etiqueta})`, tipo: 'distrito', puma: p.puma })); },
    irA(l) { document.getElementById('gemelo').scrollIntoView({ behavior: 'smooth' }); seleccionar(l.puma, true); },
  };
})();
