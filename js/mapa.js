// Gemelo territorial 3D: MapLibre + teselas OpenFreeMap (OSM) + límites oficiales del DCP + indicadores del lago.
(function () {
  const $ = s => document.querySelector(s);
  const LENTES = {
    atencion: { nombre: '◎ Atención', titulo: 'Índice de atención (prioridad equilibrio)', unidad: '/100', d: 0, fuente: 'derivado de F02, F03, F04, F10, F15' },
    ingreso_mediano: { nombre: '$ Ingreso', titulo: 'Ingreso mediano del hogar', unidad: 'US$', d: 0, fuente: 'F10 · ACS 2020–2024', usd: true },
    pct_hogares_con_carga_alquiler: { nombre: '⌂ Alquiler', titulo: 'Hogares que pagan ≥30 % de su ingreso en alquiler', unidad: '%', d: 1, fuente: 'F10 · ACS 2020–2024' },
    solicitudes_311_por_1000: { nombre: '☎ 311', titulo: 'Solicitudes 311 por 1.000 habitantes (2025)', unidad: '/1.000', d: 0, fuente: 'F03 · NYC311' },
    delitos_graves_por_1000: { nombre: '⚠ Delitos', titulo: 'Delitos graves por 1.000 habitantes (2025)', unidad: '/1.000', d: 1, fuente: 'F04 · NYPD' },
    heridos_transito_por_10000: { nombre: '✚ Tránsito', titulo: 'Heridos de tránsito por 10.000 habitantes (2025)', unidad: '/10.000', d: 1, fuente: 'F02 · NYPD' },
    pm25: { nombre: '☁ Aire', titulo: 'PM2,5 media anual', unidad: 'µg/m³', d: 2, fuente: 'F15 · NYCCAS' },
    pct_transporte_publico: { nombre: '≋ Transporte', titulo: 'Trabajadores que van en transporte público', unidad: '%', d: 1, fuente: 'F10 · ACS 2020–2024' },
  };
  const RAMPA = ['#fbf0d9', '#f2c879', '#e0913a', '#b45a1c', '#6e2c0e'];
  const ESTILO = { claro: 'https://tiles.openfreemap.org/styles/liberty', oscuro: 'https://tiles.openfreemap.org/styles/dark' };
  let map, L, lente = 'atencion', sel = null, capas = { edificios: true, extruir: false, estaciones: false, precintos: false, barrios: false, satelite: false }, D = {};

  const oscuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const valor = (p, k) => k === 'atencion' ? DIAGNOSTICO.puntaje(p.puma) : p[k];
  const fmtV = (v, k) => v == null ? '—' : LENTES[k].usd ? G.fmt.usd(v) : G.fmt.n(v, LENTES[k].d) + (LENTES[k].unidad === '%' ? ' %' : '');

  function cortes(k) { const v = Object.values(D).map(p => valor(p, k)).filter(x => x != null).sort((a, b) => a - b); return [0, .25, .5, .75, 1].map(q => v[Math.round(q * (v.length - 1))]); }

  function geojsonDistritos() {
    const g = JSON.parse(JSON.stringify(L.geo.distritos_puma));
    g.features.forEach(f => { const p = D[f.properties.puma]; f.properties.v = p ? valor(p, lente) : null; f.id = +f.properties.puma; });
    return g;
  }

  function colorExpr() {
    const c = cortes(lente); const e = ['interpolate', ['linear'], ['coalesce', ['get', 'v'], c[0]]];
    c.forEach((x, i) => { if (i && x <= c[i - 1]) x = c[i - 1] + 1e-6; c[i] = x; e.push(x, RAMPA[i]); });
    return e;
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
    const c = cortes(lente), l = LENTES[lente];
    $('#leyendaMapa').innerHTML = `<b style="color:var(--text)">${l.titulo}</b><div class="esc" style="background:linear-gradient(90deg,${RAMPA.join(',')})"></div><div class="ext"><span>${fmtV(c[0], lente)}</span><span>${fmtV(c[2], lente)}</span><span>${fmtV(c[4], lente)}</span></div><div style="margin-top:4px;font-size:10px">${l.fuente} · cortes por cuartil · 55 distritos</div>`;
  }

  function ficha(puma) {
    const p = D[puma]; if (!p) return;
    const rk = DIAGNOSTICO.rango(puma);
    const kv = (t, v, s) => `<div class="kv"><span>${t}${s ? ` <small>${s}</small>` : ''}</span><span>${v}</span></div>`;
    $('#ficha').innerHTML = `<div class="diag-tag">Distrito seleccionado · PUMA ${p.puma}</div><h3>${G.esc(p.nombre)}</h3><div class="sub" style="font-size:11.5px;color:var(--muted);font-family:'IBM Plex Mono'">${G.esc(p.etiqueta)}</div>
      <div class="veredicto" style="margin:10px 0"><span class="rk" style="font-size:22px">#${rk}</span> de 55 en atención (equilibrio)</div>
      ${kv('Población', G.fmt.n(p.poblacion_acs), 'ACS')}${kv('Densidad', G.fmt.n(p.densidad_hab_km2) + ' /km²')}
      ${kv('Ingreso mediano', G.fmt.usd(p.ingreso_mediano), '± ' + G.fmt.n(p.ingreso_mediano_moe))}${kv('Alquiler mediano', G.fmt.usd(p.alquiler_mediano) + '/mes')}
      ${kv('Hogares con carga de alquiler', G.fmt.pct(p.pct_hogares_con_carga_alquiler))}${kv('Pobreza', G.fmt.pct(p.pct_pobreza))}
      ${kv('Transporte público al trabajo', G.fmt.pct(p.pct_transporte_publico))}${kv('Nacidos en el extranjero', G.fmt.pct(p.pct_nacidos_extranjero))}
      ${kv('Quejas 311', G.fmt.n(p.solicitudes_311_por_1000), '/1.000')}${kv('Delitos graves', G.fmt.n(p.delitos_graves_por_1000, 1), '/1.000')}
      ${kv('Heridos de tránsito', G.fmt.n(p.heridos_transito_por_10000, 1), '/10.000')}${kv('Peatones heridos', G.fmt.n(p.peatones_heridos_por_10000, 1), '/10.000')}
      ${kv('PM2,5', G.fmt.n(p.pm25, 2) + ' µg/m³')}${kv('Árboles de calle', G.fmt.n(p.arboles_calle_por_km2) + ' /km²', '2015')}
      ${kv('Viviendas propuestas 2025', G.fmt.n(p.viviendas_obra_nueva_por_1000, 1), '/1.000')}${kv('Viviendas asequibles HPD', G.fmt.n(p.viviendas_asequibles_por_1000, 1), '/1.000')}
      <button class="chip" id="fichaDiag" style="margin-top:12px">Ver en el diagnóstico ↑</button>
      <div style="font-size:10.5px;color:var(--muted);margin-top:10px;font-family:'IBM Plex Mono'">Fuentes: F02, F03, F04, F05, F07, F10, F15, F16 · ver Fuentes y gobernanza</div>`;
    $('#fichaDiag').onclick = () => { DIAGNOSTICO.elegir(puma); document.getElementById('panorama').scrollIntoView({ behavior: 'smooth' }); };
  }

  function seleccionar(puma, volar) {
    sel = puma; ficha(puma);
    if (map && map.getLayer('dist-sel')) map.setFilter('dist-sel', ['==', ['get', 'puma'], puma]);
    if (volar && map) { const f = L.geo.distritos_puma.features.find(x => x.properties.puma === puma); if (f) { const b = new maplibregl.LngLatBounds(); f.geometry.coordinates.forEach(p => p[0].forEach(c => b.extend(c))); map.fitBounds(b, { padding: 60, maxZoom: 13.5, duration: 900 }); } }
  }

  function telemetria() { const c = map.getCenter(); $('#telemetria').innerHTML = `GEMELO / TELEMETRÍA<br>LAT <b>${c.lat.toFixed(4)}</b> LON <b>${c.lng.toFixed(4)}</b><br>ZOOM <b>${map.getZoom().toFixed(1)}</b> · INCL. <b>${map.getPitch().toFixed(0)}°</b> · RUMBO <b>${map.getBearing().toFixed(0)}°</b><br>LENTE <b>${LENTES[lente].nombre.slice(2)}</b>`; }

  function controles() {
    $('#lentes').innerHTML = Object.entries(LENTES).map(([k, l]) => `<button data-l="${k}" class="${k === lente ? 'on' : ''}" title="${l.titulo}">${l.nombre}</button>`).join('');
    $('#lentes').querySelectorAll('button').forEach(b => b.onclick = () => { lente = b.dataset.l; $('#lentes').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); refrescar(); telemetria(); });
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

  window.MAPA = {
    init(lago) {
      L = lago; (lago.datos.distritos ? lago.datos.distritos.datos : []).forEach(p => D[p.puma] = p);
      controles(); leyenda();
      if (!window.maplibregl || !L.geo.distritos_puma) { $('#mapa').innerHTML = '<div class="mapa-aviso">No se pudo cargar MapLibre o la geometría (¿sin conexión?). El resto del cerebro funciona igual.</div>'; return; }
      try {
        map = new maplibregl.Map({ container: 'mapa', style: oscuro() ? ESTILO.oscuro : ESTILO.claro, center: [-73.94, 40.70], zoom: 9.6, pitch: 0, attributionControl: { compact: true }, cooperativeGestures: matchMedia('(pointer:coarse)').matches });
      } catch (e) { $('#mapa').innerHTML = '<div class="mapa-aviso">Tu navegador no soporta WebGL: el mapa 3D no está disponible.</div>'; return; }
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.on('style.load', () => { agregarCapas(); telemetria(); });
      map.on('move', telemetria);
      let hov = null;
      map.on('mousemove', 'dist-fill', e => { map.getCanvas().style.cursor = 'pointer'; const f = e.features[0]; if (hov !== null) map.setFeatureState({ source: 'distritos', id: hov }, { hover: false }); hov = f.id; map.setFeatureState({ source: 'distritos', id: hov }, { hover: true }); });
      map.on('mouseleave', 'dist-fill', () => { map.getCanvas().style.cursor = ''; if (hov !== null) map.setFeatureState({ source: 'distritos', id: hov }, { hover: false }); hov = null; });
      const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      ['dist-fill', 'dist-ext'].forEach(id => map.on('click', id, e => { const p = e.features[0].properties; seleccionar(p.puma); pop.setLngLat(e.lngLat).setHTML(`<b>${G.esc(p.nombre)}</b><br>${LENTES[lente].titulo}: <b>${fmtV(D[p.puma] ? valor(D[p.puma], lente) : null, lente)}</b>`).addTo(map); }));
      map.on('click', 'estaciones', e => { const p = e.features[0].properties; new maplibregl.Popup({ offset: 8 }).setLngLat(e.lngLat).setHTML(`<b>${G.esc(p.nombre)}</b><br>Líneas ${G.esc(p.lineas)} · ${G.esc(p.borough || '')}${p.ada === '1' ? ' · accesible' : ''}`).addTo(map); });
      seleccionar(Object.keys(D).sort((a, b) => DIAGNOSTICO.rango(a) - DIAGNOSTICO.rango(b))[0]);
    },
    seleccionar,
    tema() { if (!map) return; map.setStyle(oscuro() ? ESTILO.oscuro : ESTILO.claro); },
    redimensionar() { map && map.resize(); },
    lugares() { return Object.values(D).map(p => ({ nombre: `${p.nombre} (${p.etiqueta})`, tipo: 'distrito', puma: p.puma })); },
    irA(l) { document.getElementById('gemelo').scrollIntoView({ behavior: 'smooth' }); seleccionar(l.puma, true); },
  };
})();
