// Gemelo 3D — MapLibre GL. Prácticas heredadas: estilo local mínimo (nunca colgar el arranque de un CDN),
// conEstilo() en vez de map.on('load'), las fuentes se AÑADEN una vez (nunca setStyle para cambiar de base),
// glyphs declarados desde el arranque, preserveDrawingBuffer para la sonda del lienzo.
(function () {
  const CENTRO = [-73.9712, 40.7831];
  const BBOX = [[-74.02, 40.70], [-73.90, 40.85]];
  let mapa, mapaB, LAGO, capasPropias = {}, lugares = [], base = 'esri', comparando = false, analizarActivo = true, tecnicoActivo = false, sensores = {}, S2 = null, ultimoPunto = null, toastReloj = null, actualizacionEnLote = false;
  const MEDICION = { activa: false, puntos: [], analizarAntes: true };
  const VUELO = { jugando: false, indice: -1, reloj: null };
  const $ = s => document.querySelector(s);

  const BASES = {
    esri: { n: 'Satélite ESRI', tipo: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri, Maxar, Earthstar Geographics', maxzoom: 19 },
    oscuro: { n: 'Oscuro', tipo: 'vector', attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap', maxzoom: 19 },
    osm: { n: 'OSM', tipo: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap', maxzoom: 19 },
    topo: { n: 'Topo', tipo: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], attribution: '© OpenTopoMap © OpenStreetMap', maxzoom: 16 },
    claro: { n: 'Claro', tipo: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri, HERE, Garmin, © OpenStreetMap', maxzoom: 16 },
  };
  // Capas GIBS: se rellenan con las fechas comprobadas por ingesta/pull_sensores.py (lago/sensores.json)
  const GIBS_DEF = [
    { id: 'hls', n: 'Sentinel/Landsat 30 m', capa: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance' },
    { id: 'viirs_tc', n: 'VIIRS color real', capa: 'VIIRS_SNPP_CorrectedReflectance_TrueColor' },
    { id: 'luces', n: 'Luces nocturnas', capa: 'VIIRS_SNPP_DayNightBand_At_Sensor_Radiance' },
    { id: 'ndvi', n: 'NDVI vegetación', capa: 'MODIS_Terra_NDVI_8Day' },
    { id: 'lst', n: 'Temp. superficie', capa: 'MODIS_Terra_Land_Surface_Temp_Day' },
  ];
  const CAPAS = [
    { id: 'limite', n: 'Límite de Miraflores', g: 'Territorio', color: '#ff8a5b', archivo: 'territorio:miraflores', on: true },
    { id: 'vecinas', n: 'Distritos de Lima', g: 'Territorio', color: '#6f7f96', archivo: 'territorio:distritos_lima', on: true },
    { id: 'atlas', n: 'Atlas distritos (índice / métrica)', g: 'Territorio', color: '#3987e5', on: false, virtual: true },
    { id: 'sectores', n: 'Subzonas catastrales (39)', g: 'Territorio', color: '#ffb08f', archivo: 'territorio:zonas_miraflores', on: false },
    { id: 'zonas14', n: 'Atlas zonas de Miraflores (14)', g: 'Territorio', color: '#ff8a5b', archivo: 'territorio:zonas_miraflores_14', on: false },
    { id: 'intensidad_urbana', n: 'Cruce energía + edificación + presión vial', g: 'Infraestructura', color: '#7fe0d2', archivo: 'geo:intensidad_urbana', on: false },
    { id: 'prc', n: 'Zonificación', g: 'Planificación', color: '#9085e9', archivo: 'geo:zonificacion', on: false },
    { id: 'patrimonio', n: 'Patrimonio y huacas', g: 'Planificación', color: '#c98500', archivo: 'geo:patrimonio', on: false },
    { id: 'tsunami', n: 'Inundación por tsunami (DHN)', g: 'Riesgo', color: '#e66767', archivo: 'geo:tsunami', on: false },
    { id: 'acantilado', n: 'Peligros del acantilado y espigones', g: 'Riesgo', color: '#c98500', archivo: 'geo:acantilado', on: false },
    { id: 'sismos', n: 'Sismos ≥4 (USGS)', g: 'Riesgo', color: '#e66767', archivo: 'geo:sismos', on: false },
    { id: 'verdes', n: 'Parques y áreas verdes', g: 'Ambiente', color: '#199e70', archivo: 'geo:areas_verdes', on: true },
    { id: 'electricidad', n: 'Subestaciones y demanda máxima (OSINERGMIN)', g: 'Infraestructura', color: '#f7c948', archivo: 'geo:electricidad', on: false },
    { id: 'edificios', n: 'Edificios 3D (OpenFreeMap)', g: 'Contexto', color: '#a6b4c6', on: true },
    { id: 'hitos', n: 'Hitos rotulados (Kennedy, Larcomar, Huaca…)', g: 'Contexto', color: '#ffd2bd', on: true, virtual: true },
    { id: 'edificios_nunoa', n: 'Edificios Miraflores (propios)', g: 'Contexto', color: '#ffb08f', on: false, perezosa: true, archivo: 'lago:edificios' },
    { id: 'metro', n: 'Metropolitano, corredores y Metro', g: 'Movilidad', color: '#3987e5', archivo: 'geo:transporte_red', on: true },
    { id: 'paraderos', n: 'Paraderos', g: 'Movilidad', color: '#c3c2b7', archivo: 'geo:paraderos', on: false },
    { id: 'vialidad', n: 'Ejes viales OSM', g: 'Movilidad', color: '#eef2f7', archivo: 'geo:vialidad', on: false },
    { id: 'trafico', n: 'Presión vial estructural (proxy 0–100)', g: 'Movilidad', color: '#ff6b56', archivo: 'geo:trafico_estructural', on: false },
    { id: 'sistema_vial', n: 'Sistema Vial Metropolitano (IMP)', g: 'Movilidad', color: '#9085e9', archivo: 'geo:sistema_vial', on: false },
    { id: 'ciclovias', n: 'Ciclovías', g: 'Movilidad', color: '#7fe0d2', archivo: 'geo:ciclovias', on: false },
    { id: 'cultura', n: 'Cultura, huacas y malecón', g: 'Servicios', color: '#d55181', archivo: 'geo:cultura', on: true },
    { id: 'comercio', n: 'Restaurantes, comercio y servicios', g: 'Servicios', color: '#c98500', archivo: 'geo:comercio', on: false },
    { id: 'hospedaje', n: 'Hoteles y hospedajes', g: 'Servicios', color: '#e2b93b', archivo: 'geo:hospedaje', on: false },
    { id: 'licencias', n: 'Licencias de funcionamiento 2017', g: 'Servicios', color: '#7fe0d2', archivo: 'geo:licencias_2017', on: false },
    { id: 'educacion', n: 'Educación', g: 'Servicios', color: '#3987e5', archivo: 'geo:educacion', on: false },
    { id: 'salud', n: 'Salud', g: 'Servicios', color: '#d95926', archivo: 'geo:salud', on: false },
    { id: 'centralidad', n: 'Intensidad de equipamientos (calor)', g: 'Servicios', color: '#ffb08f', on: false, virtual: true },
  ];


  let OSCURO = { fondo: [], etiquetas: [] };
  function estiloInicial() {
    const sources = {
      terrarium: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: 'Terrain: Mapzen/AWS' },
      terrarium_sombra: { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 15 },
      openfreemap: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    };
    for (const k in BASES) if (BASES[k].tiles) sources['base_' + k] = { type: 'raster', tiles: BASES[k].tiles, tileSize: 256, attribution: BASES[k].attribution, maxzoom: BASES[k].maxzoom };
    const layers = [{ id: 'fondo', type: 'background', paint: { 'background-color': '#080d11' } }];
    for (const k in BASES) if (BASES[k].tiles) layers.push({ id: 'base_' + k, type: 'raster', source: 'base_' + k, layout: { visibility: k === base ? 'visible' : 'none' }, paint: { 'raster-opacity': 1 } });
    // Fondo oscuro vectorial (OpenFreeMap «dark», sin llave) — reemplaza a CARTO, que ahora exige API key
    (OSCURO.fondo || []).forEach(l => { const c = JSON.parse(JSON.stringify(l)); c.layout = Object.assign({}, c.layout, { visibility: base === 'oscuro' ? 'visible' : 'none' }); layers.push(c); });
    layers.push({ id: 'sombra', type: 'hillshade', source: 'terrarium_sombra', paint: { 'hillshade-exaggeration': .35, 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#fff' }, layout: { visibility: 'visible' } });
    return { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', light: { anchor: 'viewport', color: '#ffffff', intensity: 0.45, position: [1.15, 210, 30] },
      // cielo navy Pacífico + niebla de horizonte: profundidad al inclinar la cámara (sin esto el 3D termina en un corte negro)
      sky: { 'sky-color': '#0b1523', 'horizon-color': '#2a445c', 'fog-color': '#0b1523', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 }, sources, layers };
  }

  function conEstilo(m, fn) {
    let hecho = false, reloj = null;
    const ya = () => { if (hecho) return; hecho = true; clearInterval(reloj); fn(); };
    const montado = () => { try { return !!(m.getStyle() && m.getStyle().layers && m.isStyleLoaded()); } catch (_) { return false; } };
    if (montado()) return ya();
    m.on('style.load', ya); m.on('load', ya);
    reloj = setInterval(() => { if (montado()) ya(); }, 250); // sin tope: en una pestaña en segundo plano el estilo puede tardar minutos
  }

  function crearMapa(id) {
    return new maplibregl.Map({ container: id, style: estiloInicial(), center: CENTRO, zoom: 13.4, pitch: 55, bearing: -17, maxPitch: 80, minZoom: 9, maxZoom: 19, attributionControl: { compact: true }, preserveDrawingBuffer: true, antialias: true, hash: false });
  }

  async function init(lago) {
    LAGO = lago; sensores = {}; const lg = lago.sensores && lago.sensores.listas && lago.sensores.listas.gibs; if (Array.isArray(lg)) lg.forEach(x => { if (x.estado === 'vivo' && x.fecha_valida && x.url_maplibre) sensores[x.id] = { fecha: x.fecha_valida, nivel: x.zoom_max, ext: x.ext, url_plantilla: x.url_maplibre }; }); S2 = (lago.sensores && lago.sensores.listas && lago.sensores.listas.s2_recortes) || null;
    try { tecnicoActivo = localStorage.getItem('lima_hud') === '1'; } catch (_) { }
    if (!window.maplibregl) { await new Promise(r => { const t = setInterval(() => { if (window.maplibregl) { clearInterval(t); r(); } }, 150); setTimeout(() => { clearInterval(t); r(); }, 15000); }); }
    if (!window.maplibregl) { $('#mapaAviso').textContent = 'MAPLIBRE NO CARGÓ (red)'; return; }
    try { OSCURO = await fetch('/estilo_oscuro.json', { cache: 'force-cache' }).then(r => r.json()); } catch (e) { console.warn('estilo oscuro', e.message); }
    mapa = crearMapa('mapa'); window.mapa = mapa;
    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    mapa.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    conEstilo(mapa, () => {
      try { mapa.setTerrain({ source: 'terrarium', exaggeration: 1.25 }); } catch (e) { console.warn('terreno', e); }
      edificios3D(mapa);
      etiquetas(mapa);
      montarGIBS(mapa);
      montarS2(mapa);
      montarAnalisis(mapa);
      cargarCapas(mapa);
      $('#mapaAviso').style.display = 'none';
      // Enlaces reproducibles: ?base=oscuro&capas=metro,salud&vista=lon,lat,zoom,pitch,rumbo
      const q = new URLSearchParams(location.search);
      if (q.get('base')) setTimeout(() => setBase(q.get('base')), 300);
      if (q.get('modo') && EDIF_MODOS[q.get('modo')]) EDIF.modo = q.get('modo');
      if (q.get('vista')) { const v = q.get('vista').split(',').map(Number); if (v.length === 5 && v.every(Number.isFinite)) mapa.jumpTo({ center: [v[0], v[1]], zoom: v[2], pitch: v[3], bearing: v[4] }); }
      else if (q.get('pitch') != null) mapa.setPitch(Number(q.get('pitch')));
      if (q.get('capas')) { const activas = new Set(q.get('capas').split(',')); setTimeout(async () => { for (const c of CAPAS) { if (c.id === 'edificios_nunoa') continue; if (c.id === 'atlas' && activas.has(c.id)) mostrarAtlas(q.get('atlas') || 'indice'); else if (c.id === 'zonas14' && activas.has(c.id)) mostrarZonas(q.get('zonas') || 'indice'); else setCapa(c.id, activas.has(c.id)); } if (activas.has('edificios_nunoa')) { const b = document.querySelector('#capas button[data-capa="edificios_nunoa"]'); b && await toggleEdificiosNunoa(b); } }, 2600); }
      else { const cuandoCapa = (id, fn, n) => { n = n || 0; if (capasPropias[id] && capasPropias[id].cargada && mapa.getLayer(id)) return fn(); if (n < 120) setTimeout(() => cuandoCapa(id, fn, n + 1), 500); }; if (q.get('atlas')) cuandoCapa('atlas', () => mostrarAtlas(q.get('atlas'))); if (q.get('zonas')) cuandoCapa('zonas14', () => mostrarZonas(q.get('zonas'))); }
      if (q.get('punto')) { const ll = q.get('punto').split(',').map(Number); if (ll.length === 2 && ll.every(Number.isFinite)) setTimeout(() => { analizarEntorno(ll); if (!q.get('vista')) mapa.flyTo({ center: ll, zoom: 16, pitch: 55, duration: 1200 }); }, 4000); }
      if (q.get('comparar')) setTimeout(() => { const b = document.querySelector('#acciones button[data-act=comparar]'); b && !comparando && accion('comparar', b); }, 3500);
    });
    mapa.on('error', e => { if (e && e.error && !/tile/i.test(e.error.message || '')) console.warn('maplibre', e.error.message); });
    mapa.on('click', e => { if (MEDICION.activa) { agregarMedicion([e.lngLat.lng, e.lngLat.lat]); return; } if (mapa.getLayer('zonas14') && CAPAS.find(x => x.id === 'zonas14').on) { const hz = mapa.queryRenderedFeatures(e.point, { layers: ['zonas14'] }); if (hz.length) { mostrarZonas(ZON.metrica, String(hz[0].properties.zona)); return; } } if (mapa.getLayer('atlas') && CAPAS.find(x => x.id === 'atlas').on) { const h = mapa.queryRenderedFeatures(e.point, { layers: ['atlas'] }); if (h.length && window.ATLAS && ATLAS.estado.resultado) { const f = ATLAS.estado.resultado.filas.find(x => x.uv === h[0].properties.ubigeo); if (f) { mostrarAtlas(ATL.metrica || 'indice', Object.assign({}, f, { centroide: null })); return; } } } if (!analizarActivo) return; const interactivas = CAPAS.map(c => c.id).filter(id => !['edificios', 'centralidad'].includes(id) && mapa.getLayer(id)); const hit = interactivas.length ? mapa.queryRenderedFeatures(e.point, { layers: interactivas }) : []; if (hit.length) return; analizarEntorno([e.lngLat.lng, e.lngLat.lat]); });
    ui();
    montarHUD();
    // Sonda del lienzo para QA: cuántos colores y píxeles opacos pintó el mapa
    const muestrear = (m) => { const c = document.createElement('canvas'); c.width = c.height = 120; const ctx = c.getContext('2d'); ctx.drawImage(m.getCanvas(), 0, 0, 120, 120); const d = ctx.getImageData(0, 0, 120, 120).data; const cols = new Set(); let op = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 8) { op++; cols.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3)); } } return { colores: cols.size, opacos: op }; };
    window.__sonda = () => { try { const a = muestrear(mapa); const r = { colores: a.colores, opacos: a.opacos, capas: Object.keys(capasPropias).filter(k => capasPropias[k].cargada), terreno: !!mapa.getTerrain(), estilo: mapa.isStyleLoaded(), base, comparando, extras: { sky: !!((mapa.getStyle() || {}).sky), hover: !!mapa.getLayer('hover_l'), glow: !!mapa.getLayer('limite_glow'), metro_glow: !!mapa.getLayer('metro_glow'), hitos: !!mapa.getLayer('hitos'), padding: mapa.getPadding().left, bases: Object.keys(BASES).length }, b: mapaB ? Object.assign(muestrear(mapaB), { capa: mapaB._capaB && mapaB._capaB.id, estilo: mapaB.isStyleLoaded() }) : null }; $('#sondaLienzo').textContent = JSON.stringify(r); return r; } catch (e) { return { error: e.message }; } };
    setInterval(() => { try { window.__sonda(); } catch (_) { } }, 4000);
    window.addEventListener('error', ev => { try { const n = $('#sondaLienzo'); n.textContent = JSON.stringify(Object.assign(JSON.parse(n.textContent || '{}'), { error: String(ev.message) })); } catch (_) { } });
  }

  function edificios3D(m) {
    if (m.getLayer('edificios')) return;
    m.addLayer({ id: 'edificios', type: 'fill-extrusion', source: 'openfreemap', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#3f545c', 12, '#5d7680', 30, '#8aa5ae', 60, '#c9dde2', 100, '#f1f6f8'], 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .86, 'fill-extrusion-vertical-gradient': true } });
  }
  function etiquetas(m) { (OSCURO.etiquetas || []).forEach(l => { if (!m.getLayer(l.id)) m.addLayer(JSON.parse(JSON.stringify(l))); }); }
  function capaEtiquetas(m) { const l = (OSCURO.etiquetas || [])[0]; return l && (m || mapa).getLayer(l.id) ? l.id : undefined; }

  function montarAnalisis(m) {
    if (!m.getSource('analisis-radio')) m.addSource('analisis-radio', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!m.getSource('analisis-punto')) m.addSource('analisis-punto', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!m.getSource('analisis-red')) m.addSource('analisis-red', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!m.getSource('medicion')) m.addSource('medicion', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!m.getLayer('analisis-radio-1k')) m.addLayer({ id: 'analisis-radio-1k', type: 'fill', source: 'analisis-radio', filter: ['==', ['get', 'radio_m'], 1000], paint: { 'fill-color': '#23b5a3', 'fill-opacity': .06, 'fill-outline-color': '#23b5a3' } });
    if (!m.getLayer('analisis-radio-500')) m.addLayer({ id: 'analisis-radio-500', type: 'fill', source: 'analisis-radio', filter: ['==', ['get', 'radio_m'], 500], paint: { 'fill-color': '#23b5a3', 'fill-opacity': .12, 'fill-outline-color': '#7fe0d2' } });
    if (!m.getLayer('analisis-punto')) m.addLayer({ id: 'analisis-punto', type: 'circle', source: 'analisis-punto', paint: { 'circle-radius': 7, 'circle-color': '#7fe0d2', 'circle-stroke-color': '#081013', 'circle-stroke-width': 3 } });
    if (!m.getLayer('analisis-red')) m.addLayer({ id: 'analisis-red', type: 'line', source: 'analisis-red', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-opacity': .82, 'line-dasharray': [2, 1] } });
    if (!m.getLayer('analisis-nodos')) m.addLayer({ id: 'analisis-nodos', type: 'circle', source: 'analisis-red', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#081013', 'circle-stroke-width': 2 } });
    if (!m.getLayer('analisis-etiquetas')) m.addLayer({ id: 'analisis-etiquetas', type: 'symbol', source: 'analisis-red', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['concat', ['get', 'tipo'], ' · ', ['get', 'distancia']], 'text-font': ['Noto Sans Regular'], 'text-size': 9.5, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#e6eef0', 'text-halo-color': '#080d11', 'text-halo-width': 1.2 } });
    if (!m.getLayer('medicion-linea')) m.addLayer({ id: 'medicion-linea', type: 'line', source: 'medicion', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#fab219', 'line-width': 3, 'line-opacity': .95 } });
    if (!m.getLayer('medicion-puntos')) m.addLayer({ id: 'medicion-puntos', type: 'circle', source: 'medicion', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fab219', 'circle-stroke-color': '#081013', 'circle-stroke-width': 2 } });
    if (!m.getSource('hover')) m.addSource('hover', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!m.getLayer('hover_l')) m.addLayer({ id: 'hover_l', type: 'line', source: 'hover', paint: { 'line-color': '#ffffff', 'line-width': 2.4, 'line-opacity': .95 } });
  }
  // Resaltado del polígono bajo el cursor: se busca la geometría original en el lago (la de queryRenderedFeatures viene cortada por tesela)
  const HOVER = { capas: { intensidad_urbana: 'intensidad_urbana', zonas14: 'zonas14', atlas: 'vecinas', prc: 'prc', sectores_f: 'sectores', tsunami: 'tsunami', patrimonio: 'patrimonio', acantilado: 'acantilado' }, clave: null };
  function montarHover(m) {
    const original = (capa, props) => { const c = capasPropias[capa]; if (!c || !c.gj) return null; const ks = ['zona', 'ubigeo', 'nombre', 'id', 'codigo', 'NOMBRE'].filter(k => props[k] != null); if (!ks.length) return null; return c.gj.features.find(f => ks.every(k => String((f.properties || {})[k]) === String(props[k]))) || null; };
    const limpiar = () => { if (HOVER.clave == null) return; HOVER.clave = null; const s = m.getSource('hover'); s && s.setData({ type: 'FeatureCollection', features: [] }); };
    m.on('mousemove', e => {
      if (MEDICION.activa) return limpiar();
      const capas = Object.keys(HOVER.capas).filter(id => m.getLayer(id) && m.getLayoutProperty(id, 'visibility') !== 'none');
      if (!capas.length) return limpiar();
      const f = m.queryRenderedFeatures(e.point, { layers: capas })[0];
      if (!f) return limpiar();
      const p = f.properties || {}; const clave = f.layer.id + ':' + (p.zona ?? p.ubigeo ?? p.nombre ?? p.id ?? f.id ?? '');
      if (clave === HOVER.clave) return; HOVER.clave = clave;
      const g = original(HOVER.capas[f.layer.id], p); m.getSource('hover').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: (g || f).geometry }] });
    });
    m.on('mouseout', limpiar); m.on('dragstart', limpiar);
  }
  // Hitos rotulados: los seis del vuelo territorial, resueltos contra las capas cargadas
  const NOMBRE_HITO = { 'Larcomar y el malecón': 'Larcomar', 'Av. Larco de punta a punta': 'Av. Larco', 'Costa Verde: acantilado y playas': 'Costa Verde' };
  function montarHitos(m) {
    if (m.getSource('src_hitos')) return;
    const feats = PARADAS.map(p => { let ll = p.ll; if (p.busca) { const l = lugares.find(x => p.busca.test(x.nombre)); if (l) ll = l.ll; } return { type: 'Feature', properties: { nombre: NOMBRE_HITO[p.n] || p.n }, geometry: { type: 'Point', coordinates: ll } }; });
    m.addSource('src_hitos', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
    const c = CAPAS.find(x => x.id === 'hitos'); const vis = c && c.on ? 'visible' : 'none';
    m.addLayer({ id: 'hitos_pt', type: 'circle', source: 'src_hitos', minzoom: 12.2, layout: { visibility: vis }, paint: { 'circle-radius': 3.2, 'circle-color': '#ff8a5b', 'circle-stroke-color': '#0b1523', 'circle-stroke-width': 1.5 } });
    m.addLayer({ id: 'hitos', type: 'symbol', source: 'src_hitos', minzoom: 12.2, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10.5, 16, 13.5], 'text-anchor': 'bottom', 'text-offset': [0, -0.7], 'text-letter-spacing': 0.06, 'text-transform': 'uppercase', visibility: vis }, paint: { 'text-color': '#ffd2bd', 'text-halo-color': '#0b1523', 'text-halo-width': 1.6 } });
    capasPropias.hitos = { gj: null, cargada: true, def: c };
  }

  function plantillaGIBS(def) {
    const s = sensores[def.capa] || sensores[def.id] || null; if (!s) return null;
    const fecha = s.fecha || s.fecha_valida || s.date; const nivel = s.nivel || s.level || s.matriz; const ext = s.ext || s.extension || 'png';
    if (!fecha || !nivel) return null;
    return { url: s.url_plantilla || `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${def.capa}/default/${fecha}/GoogleMapsCompatible_Level${nivel}/{z}/{y}/{x}.${ext}`, fecha, nivel: Number(String(nivel).replace(/\D/g, '')) };
  }
  function montarS2(m) {
    if (!S2) return; const defs = [['s2', S2.actual, 'Sentinel-2 10 m'], ['s2_2025', S2.hace_un_anio, 'Sentinel-2 hace un año']];
    defs.forEach(([id, r, n]) => { if (!r || !r.coordenadas || !r.archivo) return; if (m.getSource(id)) return; m.addSource(id, { type: 'image', url: '/' + r.archivo.replace(/^web\//, ''), coordinates: r.coordenadas }); m.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } }, 'sombra'); S2_DEF[id] = { n, fecha: r.fecha, nubes: r.nubes_ventana_pct }; });
  }
  const S2_DEF = {};
  function montarGIBS(m) {
    GIBS_DEF.forEach(def => { const p = plantillaGIBS(def); if (!p) return; const id = 'gibs_' + def.id; if (m.getSource(id)) return; m.addSource(id, { type: 'raster', tiles: [p.url], tileSize: 256, maxzoom: p.nivel, attribution: 'NASA GIBS ' + p.fecha }); m.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' } }, 'sombra'); def.fecha = p.fecha; def.ok = true; });
  }

  async function cargarCapas(m) {
    // Descarga en paralelo (18 capas); se añaden al mapa en el orden de CAPAS para que el z-order sea determinista
    const lista = CAPAS.filter(c => c.archivo && !c.perezosa && !c.virtual);
    const res = await Promise.all(lista.map(async c => { const [tipo, nombre] = c.archivo.split(':'); try { return { c, gj: await (tipo === 'territorio' ? window.cargarTerritorio(nombre) : window.cargarGeo(nombre)) }; } catch (e) { return { c, error: e.message }; } }));
    for (const r of res) {
      const c = r.c;
      if (r.gj) { try { capasPropias[c.id] = { gj: r.gj, cargada: true, def: c }; añadirCapa(m, c, r.gj); indexarLugares(c, r.gj); } catch (e) { console.warn('capa', c.id, e.message); } }
      else { capasPropias[c.id] = { cargada: false, error: r.error, def: c }; const b = document.querySelector(`#capas button[data-capa="${c.id}"]`); if (b) { b.disabled = true; b.title = 'capa no disponible'; } }
    }
    montarCentralidad(m); montarHitos(m); montarHover(m); actualizarLeyenda(); actualizarEstado();
    if (!location.search) { const b = document.querySelector('#mapaLentes button[data-lente="cruce"]'); b && setTimeout(() => b.click(), 120); }
  }

  // Superficie analítica derivada: densidad kernel de los cuatro inventarios de equipamientos.
  // No inventa observaciones; cada punto conserva su categoría y proviene de una capa trazable del lago.
  function montarCentralidad(m) {
    if (m.getSource('src_centralidad')) return;
    const ids = ['comercio', 'educacion', 'salud', 'cultura']; const features = [];
    ids.forEach(id => { const c = capasPropias[id]; if (!c || !c.gj) return; c.gj.features.forEach(f => { if (!f.geometry || f.geometry.type !== 'Point') return; features.push({ type: 'Feature', geometry: f.geometry, properties: { categoria: id, peso: id === 'salud' ? 1.35 : id === 'educacion' ? 1.2 : 1 } }); }); });
    const gj = { type: 'FeatureCollection', fuente: 'Derivado de OSM + MINEDU + MINSA', vigencia: 'según capa de origen', features };
    capasPropias.centralidad = { gj, cargada: true, def: CAPAS.find(x => x.id === 'centralidad') };
    m.addSource('src_centralidad', { type: 'geojson', data: gj });
    const antes = m.getLayer('edificios') ? 'edificios' : capaEtiquetas(m);
    const vis = CAPAS.find(x => x.id === 'centralidad').on ? 'visible' : 'none';
    m.addLayer({ id: 'centralidad', type: 'heatmap', source: 'src_centralidad', maxzoom: 17, layout: { visibility: vis }, paint: { 'heatmap-weight': ['get', 'peso'], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, .45, 16, 1.15], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 18, 16, 42], 'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, .55, 17, .82], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(13,54,107,0)', .18, '#184f95', .38, '#3987e5', .58, '#23b5a3', .78, '#fab219', 1, '#e66767'] } }, antes);
    m.addLayer({ id: 'centralidad_nucleo', type: 'circle', source: 'src_centralidad', minzoom: 15.5, layout: { visibility: vis }, paint: { 'circle-radius': 2.2, 'circle-color': ['match', ['get', 'categoria'], 'salud', '#d95926', 'educacion', '#3987e5', 'cultura', '#d55181', '#c98500'], 'circle-opacity': .68, 'circle-stroke-width': 0 } }, capaEtiquetas(m));
    const b = document.querySelector('#capas button[data-capa="centralidad"]'); if (b) b.querySelector('small').textContent = `derivado · ${features.length} puntos`;
  }

  function añadirCapa(m, c, gj) {
    const src = 'src_' + c.id; if (m.getSource(src)) return; m.addSource(src, { type: 'geojson', data: gj });
    const vis = c.on ? 'visible' : 'none'; const antes = capaEtiquetas(m);
    const tipos = new Set(gj.features.map(f => f.geometry && f.geometry.type));
    if (c.id === 'limite') {
      // máscara: atenúa todo lo que no es Miraflores
      const anillo = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]; const agujeros = gj.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map(p => p[0]));
      m.addSource('src_mascara', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [anillo, ...agujeros] } } });
      m.addLayer({ id: 'mascara', type: 'fill', source: 'src_mascara', paint: { 'fill-color': '#050a0d', 'fill-opacity': .4 }, layout: { visibility: vis } }, 'edificios');
      m.addLayer({ id: c.id + '_glow', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 14, 'line-blur': 12, 'line-opacity': .28 }, layout: { visibility: vis } }, antes);
      m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 3, 'line-opacity': .95 }, layout: { visibility: vis } }, antes);
      return;
    }
    if (c.id === 'vecinas') { m.addLayer({ id: 'atlas', type: 'fill', source: src, paint: { 'fill-color': '#2a3a42', 'fill-opacity': .62 }, layout: { visibility: 'none' } }, 'edificios'); m.addLayer({ id: 'atlas_txt', type: 'symbol', source: src, minzoom: 10, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, visibility: 'none' }, paint: { 'text-color': '#eef2f7', 'text-halo-color': '#080d11', 'text-halo-width': 1.4 } }); capasPropias.atlas = { cargada: true, def: CAPAS.find(x => x.id === 'atlas'), gj: null }; m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 1.2, 'line-dasharray': [3, 2], 'line-opacity': .8 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, layout: { 'text-field': ['coalesce', ['get', 'nombre'], ['get', 'NOMBRE'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'symbol-placement': 'point', visibility: vis }, paint: { 'text-color': '#9fb3b8', 'text-halo-color': '#080d11', 'text-halo-width': 1.5 } }); return; }
    if (c.id === 'electricidad') {
      m.addLayer({ id: c.id + '_nucleo', type: 'heatmap', source: src, maxzoom: 16.7, layout: { visibility: vis }, paint: { 'heatmap-weight': ['interpolate', ['linear'], ['to-number', ['get', 'demanda_total_kw'], 0], 0, .04, 100, .28, 500, .75, 1000, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, .7, 16, 1.55], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 16, 16, 33], 'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, .68, 16.7, .2], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(24,38,46,0)', .18, '#315b74', .42, '#23b5a3', .65, '#f7c948', .83, '#ff8152', 1, '#e43d48'] } }, 'edificios');
      m.addLayer({ id: c.id, type: 'circle', source: src, minzoom: 13, layout: { visibility: vis }, paint: { 'circle-radius': ['interpolate', ['linear'], ['to-number', ['get', 'demanda_total_kw'], 0], 0, 2, 100, 3.2, 500, 6.5, 1000, 10], 'circle-color': ['interpolate', ['linear'], ['to-number', ['get', 'demanda_total_kw'], 0], 0, '#315b74', 100, '#23b5a3', 500, '#f7c948', 1000, '#e43d48'], 'circle-opacity': .9, 'circle-stroke-color': '#fff5cf', 'circle-stroke-width': .65 } }, antes);
      clicable(m, c.id, c); return;
    }
    if (c.id === 'trafico') {
      m.addLayer({ id: c.id, type: 'line', source: src, layout: { visibility: vis, 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['interpolate', ['linear'], ['to-number', ['get', 'indice_presion'], 0], 0, '#315b74', 35, '#23b5a3', 60, '#f7c948', 80, '#ff8152', 100, '#e43d48'], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['interpolate', ['linear'], ['to-number', ['get', 'indice_presion'], 0], 0, .7, 100, 2.4], 16, ['interpolate', ['linear'], ['to-number', ['get', 'indice_presion'], 0], 0, 2, 100, 8]], 'line-opacity': .86 } }, antes);
      clicable(m, c.id, c); return;
    }
    if (c.id === 'verdes') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': c.color, 'fill-opacity': .38 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 1 }, layout: { visibility: vis } }, 'edificios'); clicable(m, c.id, c); return; }
    if (c.id === 'zonas14') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': '#2a3a42', 'fill-opacity': .6 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': '#ffb08f', 'line-width': 1.6 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, minzoom: 13, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, visibility: vis }, paint: { 'text-color': '#eef2f7', 'text-halo-color': '#080d11', 'text-halo-width': 1.4 } }); return; }
    if (c.id === 'intensidad_urbana') {
      m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': ['interpolate', ['linear'], ['to-number', ['get', 'indice_intensidad_urbana'], 0], 0, '#18364a', 25, '#315b74', 45, '#23b5a3', 65, '#f7c948', 82, '#ff8152', 100, '#e43d48'], 'fill-opacity': .62 }, layout: { visibility: vis } }, 'edificios');
      m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': '#d8fff9', 'line-width': 1.3, 'line-opacity': .68 }, layout: { visibility: vis } }, antes);
      m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, minzoom: 12.4, layout: { 'text-field': ['get', 'etiqueta'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-allow-overlap': false, visibility: vis }, paint: { 'text-color': '#f5ffff', 'text-halo-color': '#071215', 'text-halo-width': 1.6 } });
      clicable(m, c.id, c); return;
    }
    if (c.id === 'sectores') { m.addLayer({ id: c.id + '_f', type: 'fill', source: src, paint: { 'fill-color': ['match', ['get', 'zona'], '01', '#3987e5', '02', '#d95926', '03', '#199e70', '04', '#c98500', '05', '#d55181', '06', '#9085e9', '07', '#e66767', '08', '#23b5a3', '09', '#6da7ec', '10', '#ec835a', '11', '#5fbf9a', '12', '#fab219', '13', '#b07fd8', '#ffb08f'], 'fill-opacity': .18 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 1.2, 'line-opacity': .7 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, minzoom: 13.5, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, visibility: vis }, paint: { 'text-color': '#7fe0d2', 'text-halo-color': '#080d11', 'text-halo-width': 1.2 } }); clicable(m, c.id, c); return; }
    if (c.id === 'prc') { const zonas = [...new Set(gj.features.map(f => f.properties.zona))].sort(); const PALZ = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767', '#23b5a3', '#6da7ec', '#ec835a', '#5fbf9a', '#fab219']; const expr = ['match', ['get', 'zona']]; zonas.forEach((z, i) => { expr.push(z, PALZ[i % PALZ.length]); }); expr.push('#728a92'); m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': expr, 'fill-opacity': .38 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': '#e6eef0', 'line-width': .6, 'line-opacity': .5 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, minzoom: 14, layout: { 'text-field': ['get', 'zona'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, visibility: vis }, paint: { 'text-color': '#e6eef0', 'text-halo-color': '#080d11', 'text-halo-width': 1.2 } }); clicable(m, c.id, c); return; }
    if (c.id === 'patrimonio') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': c.color, 'fill-opacity': .55 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 2 }, layout: { visibility: vis } }, antes); m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, minzoom: 14.5, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-optional': true, visibility: vis }, paint: { 'text-color': '#fab219', 'text-halo-color': '#080d11', 'text-halo-width': 1.2 } }); clicable(m, c.id, c); return; }
    if (c.id === 'arbolado') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': ['interpolate', ['linear'], ['to-number', ['get', 'arboles_por_ha'], 0], 0, '#184f95', 20, '#256abf', 40, '#3987e5', 80, '#86b6ef', 160, '#cde2fb'], 'fill-opacity': .55 }, layout: { visibility: vis } }, 'edificios'); clicable(m, c.id, c); return; }
    if (c.id === 'acantilado') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': ['match', ['get', 'capa'], 'espigones', '#6f7f96', ['match', ['get', 'peligro'], 'Derrumbe', '#e66767', 'Deslizamiento', '#d95926', c.color]], 'fill-opacity': .55 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': .8 }, layout: { visibility: vis } }, 'edificios'); clicable(m, c.id, c); return; }
    if (c.id === 'sistema_vial') { m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': ['match', ['get', 'clasificacion'], 'Expresa Metropolitana', '#e66767', 'Expresa', '#e66767', 'Arterial', '#c98500', 'Colectora', '#9085e9', c.color], 'line-width': ['match', ['get', 'clasificacion'], 'Expresa Metropolitana', 4, 'Expresa', 4, 'Arterial', 3, 2] }, layout: { visibility: vis } }, antes); clicable(m, c.id, c); return; }
    if (c.id === 'licencias') { m.addLayer({ id: c.id, type: 'circle', source: src, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 6], 'circle-color': ['match', ['get', 'tipo'], 'Restaurant', '#d55181', 'Cafeteria', '#c98500', 'Hospedaje', '#e2b93b', 'Agencia de Viajes', '#3987e5', 'Salud', '#d95926', 'Educacion', '#199e70', '#7fe0d2'], 'circle-opacity': .85, 'circle-stroke-color': '#080d11', 'circle-stroke-width': .6 }, layout: { visibility: vis } }, antes); clicable(m, c.id, c); return; }
    if (c.id === 'tsunami') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': ['match', ['get', 'nivel'], 'Muy Alto', '#d03b3b', 'Alto', '#ec835a', c.color], 'fill-opacity': .38 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 1.5, 'line-dasharray': [3, 2] }, layout: { visibility: vis } }, 'edificios'); clicable(m, c.id, c); return; }
    if (c.id === 'verdes_ipt') { m.addLayer({ id: c.id, type: 'fill', source: src, paint: { 'fill-color': c.color, 'fill-opacity': .3 }, layout: { visibility: vis } }, 'edificios'); m.addLayer({ id: c.id + '_l', type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 1.2, 'line-dasharray': [2, 1] }, layout: { visibility: vis } }, 'edificios'); clicable(m, c.id, c); return; }
    if (c.id === 'ciclovias_minvu') { m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': 2.5, 'line-opacity': .9 }, layout: { visibility: vis } }, antes); clicable(m, c.id, c); return; }
    if (c.id === 'ciclovias') { m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 16, 3.5], 'line-dasharray': [2, 1.5] }, layout: { visibility: vis } }, antes); clicable(m, c.id, c); return; }
    if (c.id === 'vialidad') { m.addLayer({ id: c.id, type: 'line', source: src, paint: { 'line-color': c.color, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3], 'line-opacity': .55 }, layout: { visibility: vis } }, 'edificios'); return; }
    if (c.id === 'metro') {
      const colorLinea = ['match', ['to-string', ['coalesce', ['get', 'sistema'], ['get', 'linea'], ['get', 'line'], '']], 'Metropolitano', '#d2232a', 'metropolitano', '#d2232a', 'Corredor Azul', '#1f5fd6', 'Corredor', '#1f5fd6', 'corredor', '#1f5fd6', 'Metro', '#2aa84a', 'metro', '#2aa84a', 'Línea 1', '#2aa84a', 'Línea 2', '#e0b040', c.color];
      if (tipos.has('LineString') || tipos.has('MultiLineString')) m.addLayer({ id: c.id + '_glow', type: 'line', source: src, filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']], paint: { 'line-color': colorLinea, 'line-width': 11, 'line-blur': 9, 'line-opacity': .3 }, layout: { visibility: vis } }, antes);
      if (tipos.has('LineString') || tipos.has('MultiLineString')) m.addLayer({ id: c.id + '_tr', type: 'line', source: src, filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']], paint: { 'line-color': colorLinea, 'line-width': 4, 'line-opacity': .9 }, layout: { visibility: vis } }, antes);
      m.addLayer({ id: c.id, type: 'circle', source: src, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 9], 'circle-color': colorLinea, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }, layout: { visibility: vis } }, antes);
      m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, filter: ['==', ['geometry-type'], 'Point'], minzoom: 13, layout: { 'text-field': ['coalesce', ['get', 'nombre'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', visibility: vis }, paint: { 'text-color': '#e6eef0', 'text-halo-color': '#080d11', 'text-halo-width': 1.4 } });
      clicable(m, c.id, c); return;
    }
    if (c.id === 'sismos') { m.addLayer({ id: c.id, type: 'circle', source: src, paint: { 'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'mag'], ['get', 'magnitud'], 4], 4, 5, 7, 22], 'circle-color': c.color, 'circle-opacity': .55, 'circle-stroke-color': c.color, 'circle-stroke-width': 1.5 }, layout: { visibility: vis } }, antes); clicable(m, c.id, c); return; }
    // puntos genéricos (cultura, comercio, educación, salud, paraderos)
    const r = c.id === 'paraderos' ? ['interpolate', ['linear'], ['zoom'], 12, 1.5, 16, 4] : ['interpolate', ['linear'], ['zoom'], 12, 2, 14, 3.5, 16, 7];
    m.addLayer({ id: c.id, type: 'circle', source: src, filter: ['==', ['geometry-type'], 'Point'], minzoom: c.id === 'comercio' || c.id === 'licencias' ? 13.5 : 0, paint: { 'circle-radius': r, 'circle-color': c.color, 'circle-opacity': .9, 'circle-stroke-color': '#080d11', 'circle-stroke-width': 1 }, layout: { visibility: vis } }, antes);
    if (c.id !== 'paraderos') m.addLayer({ id: c.id + '_txt', type: 'symbol', source: src, filter: ['==', ['geometry-type'], 'Point'], minzoom: 15, layout: { 'text-field': ['coalesce', ['get', 'nombre'], ['get', 'name'], ''], 'text-font': ['Noto Sans Regular'], 'text-size': 10.5, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true, visibility: vis }, paint: { 'text-color': '#c3c2b7', 'text-halo-color': '#080d11', 'text-halo-width': 1.2 } });
    clicable(m, c.id, c);
  }

  function clicable(m, id, c) {
    m.on('mouseenter', id, () => m.getCanvas().style.cursor = 'pointer'); m.on('mouseleave', id, () => m.getCanvas().style.cursor = '');
    m.on('click', id, e => { if (MEDICION.activa) return; const f = e.features[0]; if (!f) return; const p = f.properties || {}; const nombre = p.nombre || p.name || p.NOMBRE || c.n; const filas = Object.entries(p).filter(([k, v]) => v != null && v !== '' && !['nombre', 'name', 'NOMBRE', 'osm_id', 'id'].includes(k)).slice(0, 9).map(([k, v]) => `<div><span style="color:#728a92">${k}</span> ${v}</div>`).join(''); new maplibregl.Popup({ closeButton: true, maxWidth: '300px' }).setLngLat(e.lngLat.wrap ? (f.geometry.type === 'Point' ? f.geometry.coordinates : e.lngLat) : e.lngLat).setHTML(`<b style="color:#7fe0d2">${nombre}</b><div style="font:11px monospace;color:#9fb3b8;margin-bottom:4px">${c.n}</div>${filas}`).addTo(m); });
  }

  function indexarLugares(c, gj) { if (!['metro', 'cultura', 'educacion', 'salud', 'verdes'].includes(c.id)) return; gj.features.forEach(f => { const n = f.properties && (f.properties.nombre || f.properties.name); if (!n) return; let ll; if (f.geometry.type === 'Point') ll = f.geometry.coordinates; else { const cs = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates; if (!cs || !cs.length) return; ll = [cs.reduce((a, p) => a + p[0], 0) / cs.length, cs.reduce((a, p) => a + p[1], 0) / cs.length]; } lugares.push({ nombre: n, tipo: c.n, ll, capa: c.id }); }); }

  const rad = x => x * Math.PI / 180;
  function distanciaKm(a, b) { const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]), la1 = rad(a[1]), la2 = rad(b[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
  function coordsPlanas(c, out = []) { if (!Array.isArray(c)) return out; if (typeof c[0] === 'number' && typeof c[1] === 'number') out.push(c); else c.forEach(x => coordsPlanas(x, out)); return out; }
  function puntoEnAnillo(p, ring) { let dentro = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if (((a[1] > p[1]) !== (b[1] > p[1])) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]) dentro = !dentro; } return dentro; }
  function puntoEnFeature(p, f) { const g = f && f.geometry; if (!g) return false; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return polys.some(poly => puntoEnAnillo(p, poly[0]) && !(poly.slice(1).some(h => puntoEnAnillo(p, h)))); }
  function distanciaFeature(ll, f) { const g = f && f.geometry; if (!g) return Infinity; if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && puntoEnFeature(ll, f)) return 0; const cs = coordsPlanas(g.coordinates); return cs.length ? Math.min(...cs.map(c => distanciaKm(ll, c))) : Infinity; }
  function cercanos(id, ll, radioKm) { const c = capasPropias[id]; if (!c || !c.gj) return []; return c.gj.features.map(f => ({ f, d: distanciaFeature(ll, f) })).filter(x => x.d <= radioKm).sort((a, b) => a.d - b.d); }
  function circulo(ll, radioM) { const pts = []; const rKm = radioM / 1000; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push([ll[0] + Math.cos(a) * rKm / (111.32 * Math.cos(rad(ll[1]))), ll[1] + Math.sin(a) * rKm / 110.57]); } return { type: 'Feature', properties: { radio_m: radioM }, geometry: { type: 'Polygon', coordinates: [pts] } }; }
  function fmtDist(km) { return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km'; }
  function nombreFeature(x, respaldo) { const p = (x && x.f && x.f.properties) || {}; return p.nombre || p.name || p.NOMBRE || respaldo; }
  function coordObjetivo(x, ll) { if (!x || !x.f || !x.f.geometry) return null; const g = x.f.geometry; if (g.type === 'Point') return g.coordinates; const cs = coordsPlanas(g.coordinates); return cs.reduce((mejor, c) => !mejor || distanciaKm(ll, c) < distanciaKm(ll, mejor) ? c : mejor, null); }
  function pintarRedProximidad(ll, destinos) {
    const fs = [];
    destinos.filter(d => d.x).forEach(d => { const c = coordObjetivo(d.x, ll); if (!c) return; const p = { tipo: d.tipo, distancia: fmtDist(d.x.d), color: d.color, nombre: nombreFeature(d.x, d.tipo) }; fs.push({ type: 'Feature', properties: p, geometry: { type: 'LineString', coordinates: [ll, c] } }, { type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: c } }); });
    mapa.getSource('analisis-red').setData({ type: 'FeatureCollection', features: fs });
    return fs.length / 2;
  }
  function analizarEntorno(ll, titulo) {
    if (!mapa || !mapa.getSource('analisis-radio')) return;
    ultimoPunto = ll;
    mapa.getSource('analisis-radio').setData({ type: 'FeatureCollection', features: [circulo(ll, 1000), circulo(ll, 500)] });
    mapa.getSource('analisis-punto').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ll } }] });
    const metro = cercanos('metro', ll, 8).filter(x => x.f.geometry.type === 'Point')[0];
    const paraderos = cercanos('paraderos', ll, .5);
    const educacion = cercanos('educacion', ll, 1);
    const salud = cercanos('salud', ll, 1);
    const verdes = cercanos('verdes', ll, 1);
    const cultura = cercanos('cultura', ll, 1); const hospedaje = cercanos('hospedaje', ll, .5);
    const electricidad = cercanos('electricidad', ll, .5); const viaPresion = cercanos('trafico', ll, .2)[0];
    const intensidadZona = ((capasPropias.intensidad_urbana && capasPropias.intensidad_urbana.gj && capasPropias.intensidad_urbana.gj.features) || []).find(f => puntoEnFeature(ll, f));
    const conexiones = pintarRedProximidad(ll, [{ tipo: 'Metro', x: metro, color: '#3987e5' }, { tipo: 'Educación', x: educacion[0], color: '#6da7ec' }, { tipo: 'Salud', x: salud[0], color: '#d95926' }, { tipo: 'Área verde', x: verdes[0], color: '#199e70' }, { tipo: 'Cultura', x: cultura[0], color: '#d55181' }, { tipo: 'SED', x: electricidad[0], color: '#f7c948' }]);
    const uv = ((capasPropias.sectores && capasPropias.sectores.gj && capasPropias.sectores.gj.features) || []).find(f => puntoEnFeature(ll, f));
    const zona = ((capasPropias.prc && capasPropias.prc.gj && capasPropias.prc.gj.features) || []).find(f => puntoEnFeature(ll, f));
    const edif = EDIF.cargada ? cercanos('edificios_nunoa', ll, .5) : null;
    let edifHtml = '';
    if (edif) { const P = edif.map(x => x.f.properties); const m2 = P.reduce((a, q) => a + (q.m2_construidos || 0), 0); const pisos = P.length ? P.reduce((a, q) => a + (q.pisos || 0), 0) / P.length : 0; const alto = P.reduce((a, q) => (q.pisos > (a ? a.pisos : 0) ? q : a), null); const elev = P.filter(q => q.elev_m != null); const em = elev.length ? elev.reduce((a, q) => a + q.elev_m, 0) / elev.length : null; edifHtml = `<div class="entorno-metrica"><strong>${P.length.toLocaleString('es-PE')}</strong><em>edificios a 500 m</em></div><div class="entorno-metrica"><strong>${(m2 / 1000).toLocaleString('es-PE', { maximumFractionDigits: 0 })} mil</strong><em>m² construidos a 500 m</em></div><div class="entorno-metrica"><strong>${pisos.toLocaleString('es-PE', { maximumFractionDigits: 1 })}</strong><em>pisos promedio${alto ? ' · máx ' + alto.pisos : ''}</em></div>${em != null ? `<div class="entorno-metrica"><strong>${Math.round(em)} m</strong><em>elevación del suelo</em></div>` : ''}`; }
    else edifHtml = `<div class="entorno-metrica entorno-pendiente"><strong>—</strong><em><button type="button" id="analisisCargarEdif" class="ghost" style="padding:2px 8px">cargar edificios 3D</button></em></div>`;
    const demanda500 = electricidad.reduce((a, x) => a + Number(x.f.properties.demanda_total_kw || 0), 0);
    const infraHtml = `<div class="entorno-metrica"><strong>${electricidad.length}</strong><em>SED OSINERGMIN a 500 m</em></div><div class="entorno-metrica"><strong>${demanda500.toLocaleString('es-PE', { maximumFractionDigits: 0 })} kW</strong><em>suma de máximas SED a 500 m</em></div>${viaPresion ? `<div class="entorno-metrica"><strong>${Number(viaPresion.f.properties.indice_presion).toLocaleString('es-PE', { maximumFractionDigits: 0 })}/100</strong><em>${nombreFeature(viaPresion, 'vía próxima')} · proxy vial</em></div>` : ''}${intensidadZona ? `<div class="entorno-metrica"><strong>${Number(intensidadZona.properties.indice_intensidad_urbana).toLocaleString('es-PE', { maximumFractionDigits: 0 })}/100</strong><em>${intensidadZona.properties.nombre} · intensidad urbana</em></div>` : ''}`;
    const ficha = $('#mapaFicha'); ficha.hidden = false;
    const fuentes = ['paraderos', 'educacion', 'salud', 'verdes', 'electricidad', 'trafico', 'intensidad_urbana'].map(id => { const x = capasPropias[id] && capasPropias[id].gj; return x ? `${CAPAS.find(c => c.id === id).n}: ${x.fuente || 'fuente declarada'}${x.vigencia ? ' · ' + x.vigencia : ''}` : null; }).filter(Boolean);
    ficha.innerHTML = `<button type="button" aria-label="Cerrar análisis">✕</button><b>${titulo || (uv ? (uv.properties.nombre || 'Zona ' + (uv.properties.zona || '')) : 'Punto analizado')}</b><span>${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}${uv && uv.properties.area_km2 ? ` · ${uv.properties.area_km2} km²` : ''} · ${conexiones} vectores</span><div class="entorno-grid"><div class="entorno-metrica"><strong>${metro ? fmtDist(metro.d) : '—'}</strong><em>${metro ? nombreFeature(metro, 'Estación') : 'Estación sin dato'}</em></div><div class="entorno-metrica"><strong>${paraderos.length}</strong><em>paraderos a 500 m</em></div><div class="entorno-metrica"><strong>${educacion.length}</strong><em>centros educativos a 1 km</em></div><div class="entorno-metrica"><strong>${salud.length}</strong><em>centros de salud a 1 km</em></div><div class="entorno-metrica"><strong>${verdes.length}</strong><em>áreas verdes a 1 km</em></div><div class="entorno-metrica"><strong>${cultura.length}</strong><em>cultura/deporte a 1 km</em></div><div class="entorno-metrica"><strong>${hospedaje.length}</strong><em>hospedajes a 500 m</em></div>${infraHtml}${edifHtml}</div>${zona ? `<div class="entorno-zona"><span style="color:#728a92">zonif.</span> ${zona.properties.zona || zona.properties.nombre || ''}${uv ? ` · <span style="color:#6b8087">zona</span> ${uv.properties.nombre || uv.properties.zona || ''}` : ''}</div>` : ''}<small class="entorno-fuente"><a href="?punto=${ll[0].toFixed(5)},${ll[1].toFixed(5)}#gemelo" style="color:#7fe0d2">enlace a este punto</a> · Demanda SED es suma no coincidente, no consumo en kWh. La presión vial es proxy, no tráfico en vivo. ${fuentes.join(' · ')}${edif ? ' · Edificios: OSM + estimación por tipología (pisos_fuente)' : ''}.</small>`;
    const bce = ficha.querySelector('#analisisCargarEdif'); if (bce) bce.onclick = async () => { const chip = document.querySelector('#capas button[data-capa="edificios_nunoa"]'); if (chip) { await toggleEdificiosNunoa(chip); analizarEntorno(ll, titulo); } };
    ficha.querySelector('button').onclick = () => { ficha.hidden = true; ['analisis-radio', 'analisis-punto', 'analisis-red'].forEach(id => mapa.getSource(id).setData({ type: 'FeatureCollection', features: [] })); };
  }

  function notificar(texto) { const t = $('#mapaToast'); if (!t) return; clearTimeout(toastReloj); t.textContent = texto; t.hidden = false; toastReloj = setTimeout(() => { t.hidden = true; }, 3200); }
  function limpiarMedicion() { MEDICION.puntos = []; const s = mapa && mapa.getSource('medicion'); if (s) s.setData({ type: 'FeatureCollection', features: [] }); const h = $('#medicionHud'); if (h) h.hidden = true; notificar('Medición borrada'); }
  function refrescarMedicion() {
    const pts = MEDICION.puntos; let total = 0; for (let i = 1; i < pts.length; i++) total += distanciaKm(pts[i - 1], pts[i]);
    const fs = pts.map((p, i) => ({ type: 'Feature', properties: { orden: i + 1 }, geometry: { type: 'Point', coordinates: p } }));
    if (pts.length > 1) fs.unshift({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } });
    mapa.getSource('medicion').setData({ type: 'FeatureCollection', features: fs });
    const h = $('#medicionHud'); h.hidden = false; h.innerHTML = `<span>${MEDICION.activa ? 'TRAZANDO' : 'MEDICIÓN'}</span><b>${fmtDist(total)}</b><span>${Math.max(0, pts.length - 1)} tramos</span><button type="button" aria-label="Borrar medición">✕</button>`; h.querySelector('button').onclick = limpiarMedicion;
  }
  function agregarMedicion(ll) { MEDICION.puntos.push(ll); refrescarMedicion(); }
  function alternarMedicion(b) {
    if (!MEDICION.activa && MEDICION.puntos.length) limpiarMedicion();
    if (!MEDICION.activa) MEDICION.analizarAntes = analizarActivo;
    MEDICION.activa = !MEDICION.activa; b.classList.toggle('on', MEDICION.activa); b.setAttribute('aria-pressed', String(MEDICION.activa)); b.textContent = MEDICION.activa ? '✓ Finalizar medición' : '⌁ Medir distancia';
    $('#mapaWrap').classList.toggle('midiendo', MEDICION.activa); mapa.getCanvas().style.cursor = MEDICION.activa ? 'crosshair' : '';
    const a = document.querySelector('#acciones button[data-act="analizar"]');
    if (MEDICION.activa) { analizarActivo = false; notificar('Medición activa · haz clic para agregar puntos'); }
    else { analizarActivo = MEDICION.analizarAntes; if (MEDICION.puntos.length) refrescarMedicion(); notificar(MEDICION.puntos.length ? 'Medición finalizada' : 'Medición cancelada'); }
    if (a) { a.classList.toggle('on', analizarActivo); a.setAttribute('aria-pressed', String(analizarActivo)); }
    actualizarEstado();
  }

  function pintarHUD() {
    if (!mapa) return; const c = mapa.getCenter(), z = mapa.getZoom();
    const escala = Math.round(156543.03392 * Math.cos(rad(c.lat)) / Math.pow(2, z) * 3779.527);
    const visibles = CAPAS.filter(x => x.on && capasPropias[x.id] && capasPropias[x.id].gj); const objetos = visibles.reduce((n, x) => n + capasPropias[x.id].gj.features.length, 0);
    $('#hudLat').textContent = c.lat.toFixed(5) + '°'; $('#hudLon').textContent = c.lng.toFixed(5) + '°'; $('#hudZoom').textContent = 'Z ' + z.toFixed(2); $('#hudBearing').textContent = ((mapa.getBearing() + 360) % 360).toFixed(0).padStart(3, '0') + '°'; $('#hudPitch').textContent = mapa.getPitch().toFixed(0) + '°'; $('#hudEscala').textContent = '1:' + escala.toLocaleString('es-PE'); $('#hudDatos').textContent = `${visibles.length} fuentes · ${objetos.toLocaleString('es-PE')} objetos`; $('#hudEstado').textContent = mapa.isMoving() ? 'CALCULANDO VISTA' : 'SISTEMA ESTABLE';
  }
  function montarHUD() {
    $('#mapaWrap').classList.toggle('tecnico', tecnicoActivo); $('#mapaHud').hidden = !tecnicoActivo; const b = document.querySelector('#acciones button[data-act="tecnico"]'); if (b) { b.classList.toggle('on', tecnicoActivo); b.setAttribute('aria-pressed', String(tecnicoActivo)); } let cuadros = 0, ultimo = performance.now();
    mapa.on('move', pintarHUD); mapa.on('moveend', pintarHUD); mapa.on('render', () => { cuadros++; }); mapa.on('dragstart', () => { if (VUELO.jugando) detenerVuelo(); });
    setInterval(() => { const ahora = performance.now(), fps = Math.round(cuadros * 1000 / Math.max(1, ahora - ultimo)); $('#hudRender').textContent = cuadros ? `RENDER ${fps} FPS` : 'RENDER ESTABLE'; cuadros = 0; ultimo = ahora; pintarHUD(); }, 1000);
    pintarHUD();
  }
  function actualizarEstado() { const activas = CAPAS.filter(c => c.on).length; const bn = (BASES[base] || S2_DEF[base] || GIBS_DEF.find(d => 'gibs_' + d.id === base) || { n: base }).n; const estado = $('#mapaContexto'); if (estado) estado.textContent = `${bn} · ${activas} capas activas${MEDICION.activa ? ' · trazando medición' : analizarActivo ? ' · clic para analizar' : ''}`; const ca = $('#capasActivas'); if (ca) ca.textContent = `${activas} activas · datos probados ${LAGO && LAGO.geo ? LAGO.geo.probado : ''}`; if ($('#hudLat')) pintarHUD(); }

  function pintarKpis(lente) {
    const root = $('#mapaKpis'); if (!root) return;
    const C = (tema, k) => LAGO && LAGO[tema] && LAGO[tema].cifras && LAGO[tema].cifras[k] ? LAGO[tema].cifras[k].valor : null;
    const n = (v, d) => typeof v === 'number' ? v.toLocaleString('es-PE', { maximumFractionDigits: d == null ? 1 : d }) : (v == null ? '—' : String(v));
    const energiaKw = C('infraestructura', 'demanda_maxima_privada_suma_kw');
    const m2 = C('edificios', 'm2_construidos');
    const ZZ = (LAGO && LAGO.infraestructura && LAGO.infraestructura.listas && LAGO.infraestructura.listas.zonas) || [];
    const maxZ = k => ZZ.length ? ZZ.reduce((a, b) => Number(b[k] || 0) > Number(a[k] || 0) ? b : a, ZZ[0]) : {};
    const zTop = ZZ[0] || {}, zEnergia = maxZ('demanda_kw_ha'), zEdif = maxZ('m2_construidos_ha'), zVial = maxZ('presion_vial_media');
    const vistas = {
      sistema: { titulo: 'MIRAFLORES / SISTEMA URBANO', nota: 'Tres lentes cuantificadas · selecciona una vista', items: [
        [n(C('infraestructura', 'subestaciones_miraflores'), 0), 'SED oficiales'],
        [m2 ? n(m2 / 1e6, 2) + ' M' : '—', 'm² construidos estimados'],
        [n(C('infraestructura', 'vias_analizadas_km'), 1), 'km de red vial analizada'],
        [n(C('infraestructura', 'congestion_lima_2025_pct'), 0) + ' %', 'congestión Lima 2025'],
      ] },
      cruce: { titulo: 'LENTE / CRUCE URBANO', nota: 'Índice relativo · energía + edificación + presión vial', items: [
        [zTop.nombre || '—', 'mayor intensidad combinada'],
        [zTop.indice_intensidad_urbana != null ? n(zTop.indice_intensidad_urbana, 1) + '/100' : '—', 'índice de la zona líder'],
        [zEnergia.nombre || '—', 'mayor demanda máxima por ha'],
        [zVial.nombre || zEdif.nombre || '—', 'mayor presión vial media'],
      ] },
      energia: { titulo: 'LENTE / ENERGÍA', nota: 'OSINERGMIN · indicadores 2024 · corte 13 feb 2026', items: [
        [n(C('infraestructura', 'subestaciones_miraflores'), 0), 'subestaciones dentro del distrito'],
        [energiaKw ? n(energiaKw / 1000, 1) + ' MW' : '—', 'suma de máximas particulares'],
        [n(C('infraestructura', 'demanda_maxima_alumbrado_suma_kw'), 1) + ' kW', 'suma máxima de alumbrado'],
        ['10 / 22,9 kV', 'tensiones primarias declaradas'],
      ] },
      densificacion: { titulo: 'LENTE / DENSIFICACIÓN', nota: 'OSM + pisos observados/estimados · lectura por 14 zonas', items: [
        [n(C('edificios', 'edificios_n'), 0), 'edificios modelados'],
        [m2 ? n(m2 / 1e6, 2) + ' M' : '—', 'm² construidos estimados'],
        [n(C('edificios', 'pisos_medio'), 1), 'pisos promedio'],
        [n(C('edificios', 'torres_10_pisos'), 0), 'torres de 10+ pisos en OSM'],
      ] },
      trafico: { titulo: 'LENTE / PRESIÓN VIAL', nota: 'Mapa = proxy estructural · cifras Lima = TomTom 2025', items: [
        [n(C('infraestructura', 'vias_analizadas_km'), 1) + ' km', 'red vial recortada'],
        [n(C('infraestructura', 'vias_presion_alta_km'), 1) + ' km', 'proxy alto o muy alto'],
        [n(C('infraestructura', 'congestion_lima_2025_pct'), 0) + ' %', 'congestión media de Lima'],
        [n(C('infraestructura', 'velocidad_punta_lima_2025_kmh'), 1) + ' km/h', 'velocidad en hora punta · Lima'],
      ] },
    };
    const v = vistas[lente] || vistas.sistema; root.dataset.lente = lente || 'sistema';
    root.innerHTML = `<header><span>${v.titulo}</span><small>${v.nota}</small></header><div>${v.items.map(([valor, etiqueta]) => `<article><strong>${valor}</strong><em>${etiqueta}</em></article>`).join('')}</div>`;
    const movil = $('#mapaResumenMovilContenido');
    if (movil) movil.innerHTML = `<span>${v.titulo.replace('LENTE / ', '')}</span><p>${v.items.map(([valor, etiqueta]) => `<b>${valor}</b> ${etiqueta}`).join(' · ')}</p><small>${v.nota}</small>`;
  }

  // ---- Edificios propios (práctica del Gemelo Quebradas): GeoJSON OSM enriquecido, partido por UV, carga perezosa ----
  const EDIF = { cargando: false, cargada: false, modo: 'pisos', n: 0 };
  const EDIF_MODOS = {
    pisos: { n: 'Pisos', expr: ['interpolate', ['linear'], ['get', 'pisos'], 1, '#184f95', 3, '#256abf', 5, '#3987e5', 10, '#6da7ec', 20, '#b7d3f6', 30, '#e8f1fb'], leyenda: [['1', '#184f95'], ['5', '#3987e5'], ['10', '#6da7ec'], ['20', '#b7d3f6'], ['30+', '#e8f1fb']] },
    tipo: { n: 'Tipo OSM', expr: ['match', ['get', 'tipo'], 'house', '#c98500', 'detached', '#c98500', 'residential', '#d95926', 'apartments', '#3987e5', 'commercial', '#d55181', 'retail', '#d55181', 'office', '#9085e9', 'industrial', '#728a92', 'warehouse', '#728a92', 'school', '#199e70', 'university', '#199e70', 'church', '#e66767', '#9fb3b8'], leyenda: [['casa', '#c98500'], ['residencial', '#d95926'], ['departamentos', '#3987e5'], ['comercio', '#d55181'], ['oficinas', '#9085e9'], ['educación', '#199e70'], ['industria', '#728a92'], ['otro/sin tipo', '#9fb3b8']] },
    metro: { n: 'Distancia a estación (Metropolitano/corredor)', expr: ['step', ['get', 'metro_m'], '#199e70', 500, '#c98500', 800, '#d95926', 1200, '#728a92'], leyenda: [['≤ 500 m', '#199e70'], ['≤ 800 m', '#c98500'], ['≤ 1.200 m', '#d95926'], ['más lejos', '#728a92']] },
    intensidad: { n: 'Intensidad construida (m²)', expr: ['interpolate', ['linear'], ['to-number', ['get', 'm2_construidos'], 0], 0, '#20343d', 500, '#315b74', 1500, '#23b5a3', 5000, '#f7c948', 15000, '#ff8152', 40000, '#e43d48'], leyenda: [['≤ 500 m²', '#315b74'], ['1.500', '#23b5a3'], ['5.000', '#f7c948'], ['15.000', '#ff8152'], ['40.000+ m²', '#e43d48']] },
    fuente: { n: 'Calidad del dato de pisos', expr: ['match', ['get', 'pisos_fuente'], 'osm', '#23b5a3', 'altura_osm', '#7fe0d2', '#3d4f55'], leyenda: [['pisos en OSM', '#23b5a3'], ['altura en OSM', '#7fe0d2'], ['estimado por tipología', '#3d4f55']] },
    elev: { n: 'Elevación del terreno', expr: ['interpolate', ['linear'], ['coalesce', ['get', 'elev_m'], 70], 1, '#104281', 35, '#3987e5', 70, '#23b5a3', 95, '#c98500', 118, '#e66767'], leyenda: [['1 m', '#104281'], ['35', '#3987e5'], ['70', '#23b5a3'], ['95', '#c98500'], ['118 m', '#e66767']] },
  };
  async function toggleEdificiosNunoa(b) {
    const c = CAPAS.find(x => x.id === 'edificios_nunoa');
    if (!EDIF.cargada) {
      if (EDIF.cargando) return; EDIF.cargando = true; b.classList.add('on');
      const aviso = $('#mapaAviso') || document.createElement('div'); aviso.style.display = 'flex'; aviso.textContent = 'CARGANDO EDIFICIOS…';
      try {
        const idx = (LAGO.edificios && LAGO.edificios.listas && LAGO.edificios.listas.archivos) || [];
        const feats = []; let hechos = 0;
        await Promise.all(idx.map(async a => { try { const gj = await window.cargarGeo(a.archivo.replace(/^geo\//, '').replace(/\.geojson$/, '')); feats.push(...gj.features); } catch (e) { console.warn('edificios', a.archivo, e.message); } hechos++; aviso.textContent = `CARGANDO EDIFICIOS… ${hechos}/${idx.length}`; }));
        const gj = { type: 'FeatureCollection', features: feats }; EDIF.n = feats.length;
        capasPropias.edificios_nunoa = { gj: { features: feats }, cargada: true, def: c };
        mapa.addSource('src_edificios_nunoa', { type: 'geojson', data: gj });
        mapa.addLayer({ id: 'edificios_nunoa', type: 'fill-extrusion', source: 'src_edificios_nunoa', minzoom: 12, paint: { 'fill-extrusion-color': (EDIF_MODOS[EDIF.modo] || EDIF_MODOS.pisos).expr, 'fill-extrusion-height': ['*', ['coalesce', ['get', 'pisos'], 1], 3.2], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': .9, 'fill-extrusion-vertical-gradient': true } }, capaEtiquetas());
        mapa.on('click', 'edificios_nunoa', e => { if (MEDICION.activa) return; const p = e.features[0].properties; new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(`<b style="color:#7fe0d2">${p.nombre || p.calle || 'Edificio OSM ' + p.id}</b><div style="font:11px monospace;color:#9fb3b8;margin-bottom:4px">${p.tipo}${p.uso ? ' · ' + p.uso : ''}</div><div><span style="color:#728a92">pisos</span> ${p.pisos} <span style="color:#728a92">(${p.pisos_fuente === 'osm' ? 'OSM' : p.pisos_fuente === 'altura_osm' ? 'altura OSM ' + (p.altura_osm_m || '') + ' m' : 'estimado por tipología'})</span></div><div><span style="color:#728a92">huella</span> ${Number(p.area_m2).toLocaleString('es-PE')} m² · <span style="color:#728a92">construidos</span> ${Number(p.m2_construidos).toLocaleString('es-PE')} m²</div><div><span style="color:#728a92">terreno</span> ${p.elev_m} m s. n. m.</div><div><span style="color:#728a92">Metro</span> ${p.metro_est} a ${p.metro_m} m</div><div><span style="color:#728a92">zona</span> ${p.uv || '—'} · <span style="color:#728a92">zonif.</span> ${p.zona_prc || '—'}</div>`).addTo(mapa); });
        mapa.on('mouseenter', 'edificios_nunoa', () => mapa.getCanvas().style.cursor = 'pointer'); mapa.on('mouseleave', 'edificios_nunoa', () => mapa.getCanvas().style.cursor = '');
        EDIF.cargada = true; c.on = true;
        // los edificios genéricos se apagan: no se pintan dos veces
        const cg = CAPAS.find(x => x.id === 'edificios'); if (cg && cg.on) { cg.on = false; mapa.setLayoutProperty('edificios', 'visibility', 'none'); const bg = document.querySelector('#capas button[data-capa="edificios"]'); bg && bg.classList.remove('on'); }
      } catch (e) { console.error('edificios', e); b.classList.remove('on'); }
      b.setAttribute('aria-pressed', String(EDIF.cargada && c.on)); EDIF.cargando = false; aviso.style.display = 'none'; actualizarLeyenda(); actualizarEstado(); return;
    }
    c.on = !c.on; mapa.setLayoutProperty('edificios_nunoa', 'visibility', c.on ? 'visible' : 'none'); b.classList.toggle('on', c.on); b.setAttribute('aria-pressed', String(c.on)); actualizarEstado();
    if (c.on) { const cg = CAPAS.find(x => x.id === 'edificios'); if (cg && cg.on) { cg.on = false; mapa.setLayoutProperty('edificios', 'visibility', 'none'); const bg = document.querySelector('#capas button[data-capa="edificios"]'); bg && bg.classList.remove('on'); } }
    actualizarLeyenda();
  }
  function setModoEdificios(modo) { EDIF.modo = modo; if (mapa.getLayer('edificios_nunoa')) mapa.setPaintProperty('edificios_nunoa', 'fill-extrusion-color', EDIF_MODOS[modo].expr); actualizarLeyenda(); }
  function leyendaEdificios() { if (!EDIF.cargada || !CAPAS.find(x => x.id === 'edificios_nunoa').on) return ''; const m = EDIF_MODOS[EDIF.modo]; return `<div style="color:#7fe0d2;margin-top:4px">Edificios Miraflores · ${EDIF.n.toLocaleString('es-PE')} · <select id="modoEdif" style="background:#0b1215;color:#e6eef0;border:1px solid #1e3239;border-radius:6px;font:10.5px monospace">${Object.entries(EDIF_MODOS).map(([k, v]) => `<option value="${k}" ${k === EDIF.modo ? 'selected' : ''}>${v.n}</option>`).join('')}</select></div>` + m.leyenda.map(([t, col]) => `<div><i style="--sw:${col}"></i>${t}</div>`).join(''); }

  // ---- Atlas UV: coropleta sobre las unidades vecinales, pintada desde ATLAS (índice o métrica cruda) ----
  const ATL = { metrica: null };
  function mostrarAtlas(metrica, uvFoco) {
    if (!window.ATLAS || !mapa.getLayer('atlas')) return;
    if (!ATLAS.estado.resultado) ATLAS.calcular(LAGO);
    const v = ATLAS.valoresPara(metrica || 'indice'); if (!v) return; ATL.metrica = metrica || 'indice';
    const expr = ['match', ['get', 'ubigeo']]; Object.entries(v.vals).forEach(([uv, val]) => { expr.push(uv, ATLAS.color(val, v.mn, v.mx)); }); expr.push('#2a3a42');
    mapa.setPaintProperty('atlas', 'fill-color', expr);
    const c = CAPAS.find(x => x.id === 'atlas'); if (!c.on) { setCapa('atlas', true); if (mapa.getLayer('mascara')) mapa.setLayoutProperty('mascara', 'visibility', 'none'); if (!uvFoco && mapa.getZoom() > 11.5) mapa.flyTo({ center: [-77.04, -12.03], zoom: 9.9, pitch: 15, bearing: 0, duration: 1800 }); } else actualizarLeyenda();
    if (uvFoco && uvFoco.centroide) { mapa.flyTo({ center: uvFoco.centroide, zoom: 13, pitch: 40, duration: 1500 }); const ficha = $('#mapaFicha'); ficha.hidden = false; ficha.innerHTML = `<button type="button" aria-label="Cerrar">✕</button><b>${uvFoco.nombre}</b><span>puesto ${uvFoco.puesto} de ${ATLAS.estado.resultado.filas.length} · índice ${uvFoco.indice}</span><div class="entorno-grid">${Object.entries(uvFoco.dims).map(([d, x]) => `<div class="entorno-metrica"><strong>${x == null ? '—' : x}</strong><em>${(LAGO.atlas_distritos.listas.dimensiones[d] || {}).n || d}</em></div>`).join('')}${['poblacion', 'densidad', 'pobreza_pct', 'idh', 'precio_m2_usd', 'denuncias_x1000'].filter(k => uvFoco[k] != null).map(k => `<div class="entorno-metrica"><strong>${Number(uvFoco[k]).toLocaleString('es-PE', { maximumFractionDigits: k === 'idh' ? 3 : 1 })}</strong><em>${(LAGO.atlas_distritos.listas.metricas || {})[k] || k}</em></div>`).join('')}</div><small class="entorno-fuente">Atlas de distritos: índice 0-100 con los pesos vigentes.</small>`; ficha.querySelector('button').onclick = () => { ficha.hidden = true; }; }
  }
  const ZON = { metrica: 'indice' };
  function normZonas(k) { const j = LAGO.atlas_zonas; if (!j) return null; const filas = j.listas.uv; const DIM = j.listas.dimensiones; const norm = (vals, inv) => { const v = vals.filter(x => x != null && isFinite(x)); const mn = Math.min(...v), mx = Math.max(...v); return x => x == null || !isFinite(x) || mx === mn ? null : Math.round((inv ? (mx - x) / (mx - mn) : (x - mn) / (mx - mn)) * 100); }; const vals = {}; if (k === 'indice' || k.startsWith('dim:')) { filas.forEach(f => { const dims = {}; Object.entries(DIM).forEach(([d, def]) => { const vs = def.metricas.map(([m, dir]) => norm(filas.map(x => x[m]), dir === 'inv')(f[m])).filter(x => x != null); dims[d] = vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null; }); const ds = Object.values(dims).filter(x => x != null); vals[f.uv] = k === 'indice' ? (ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null) : dims[k.slice(4)]; }); } else filas.forEach(f => { vals[f.uv] = f[k]; }); const vs = Object.values(vals).filter(x => x != null && isFinite(x)); return { vals, mn: vs.length ? Math.min(...vs) : 0, mx: vs.length ? Math.max(...vs) : 1 }; }
  function mostrarZonas(metrica, zonaFoco) {
    if (!window.ATLAS || !mapa.getLayer('zonas14') || !LAGO.atlas_zonas) return; ZON.metrica = metrica || ZON.metrica;
    const v = normZonas(ZON.metrica); if (!v) return; const expr = ['match', ['get', 'zona']]; Object.entries(v.vals).forEach(([z, val]) => { expr.push(z, ATLAS.color(val, v.mn, v.mx)); }); expr.push('#2a3a42');
    mapa.setPaintProperty('zonas14', 'fill-color', expr); const c = CAPAS.find(x => x.id === 'zonas14'); if (!c.on) setCapa('zonas14', true); else actualizarLeyenda();
    if (zonaFoco) { const f = LAGO.atlas_zonas.listas.uv.find(x => x.uv === zonaFoco); if (f) { if (f.centroide) mapa.flyTo({ center: f.centroide, zoom: 15.2, pitch: 45, duration: 1400 }); const M = LAGO.atlas_zonas.listas.metricas; const ficha = $('#mapaFicha'); ficha.hidden = false; ficha.innerHTML = `<button type="button" aria-label="Cerrar">✕</button><b>${f.nombre}</b><span>${f.poblacion_2017 ? f.poblacion_2017.toLocaleString('es-PE') + ' hab (2017) · ' : ''}${f.area_ha} ha</span><div class="entorno-grid">${['densidad_hab_ha', 'm2_construidos_hab', 'hospedajes_x1000', 'restaurantes_x1000', 'verde_m2_hab', 'estacion_m', 'tsunami_dist_m', 'acantilado_poligonos', 'torres_10_pisos'].filter(k => f[k] != null).map(k => `<div class="entorno-metrica"><strong>${Number(f[k]).toLocaleString('es-PE', { maximumFractionDigits: 1 })}</strong><em>${M[k] || k}</em></div>`).join('')}</div><div class="entorno-zona"><span style="color:#6f7f96">estación más cercana</span> ${f.estacion || '—'}</div><small class="entorno-fuente">Atlas por zona catastral: población INEI 2017 por zona; capas OSM/MINCETUR/ATU/DHN/IMP.</small>`; ficha.querySelector('button').onclick = () => { ficha.hidden = true; }; } }
  }
  function leyendaZonas() { const c = CAPAS.find(x => x.id === 'zonas14'); if (!c || !c.on || !LAGO.atlas_zonas || !window.ATLAS) return ''; const M = LAGO.atlas_zonas.listas.metricas || {}; const DIM = LAGO.atlas_zonas.listas.dimensiones || {}; const k = ZON.metrica; const v = normZonas(k); const ops = ['indice'].concat(Object.keys(DIM).map(d => 'dim:' + d)).concat(Object.keys(M)); return `<div style="color:#ffb08f;margin-top:4px">Zonas de Miraflores · <select id="metricaZonas" style="background:#0b1215;color:#eef2f7;border:1px solid #1f2f47;border-radius:6px;font:10.5px monospace;max-width:170px">${ops.map(o => `<option value="${o}" ${o === k ? 'selected' : ''}>${o === 'indice' ? 'Índice (pesos iguales)' : o.startsWith('dim:') ? 'Dim: ' + (DIM[o.slice(4)] || {}).n : (M[o] || o)}</option>`).join('')}</select></div><div style="color:#a6b4c6"><span style="background:linear-gradient(90deg,${ATLAS.RAMPA.join(',')});display:inline-block;width:70px;height:8px;border-radius:2px;vertical-align:middle"></span> ${v ? v.mn.toLocaleString('es-PE') + ' → ' + v.mx.toLocaleString('es-PE') : ''}</div>`; }
  function leyendaAtlas() { const c = CAPAS.find(x => x.id === 'atlas'); if (!c || !c.on || !window.ATLAS || !ATLAS.estado.resultado) return ''; const k = ATL.metrica || 'indice'; const M = (LAGO.atlas_distritos && LAGO.atlas_distritos.listas.metricas) || {}; const nombre = k === 'indice' ? 'Índice compuesto (pesos de la sección Atlas)' : k.startsWith('dim:') ? (LAGO.atlas_distritos.listas.dimensiones[k.slice(4)] || {}).n : (M[k] || k); const v = ATLAS.valoresPara(k); const ops = ['indice'].concat(Object.keys(LAGO.atlas_distritos.listas.dimensiones).map(d => 'dim:' + d)).concat(Object.keys(M)); return `<div style="color:#7fe0d2;margin-top:4px">Atlas distritos · <select id="metricaAtlas" style="background:#0b1215;color:#e6eef0;border:1px solid #1e3239;border-radius:6px;font:10.5px monospace;max-width:170px">${ops.map(o => `<option value="${o}" ${o === k ? 'selected' : ''}>${o === 'indice' ? 'Índice compuesto' : o.startsWith('dim:') ? 'Dim: ' + (LAGO.atlas_distritos.listas.dimensiones[o.slice(4)] || {}).n : (M[o] || o)}</option>`).join('')}</select></div><div style="color:#9fb3b8">${nombre}: <span style="background:linear-gradient(90deg,${ATLAS.RAMPA.join(',')});display:inline-block;width:70px;height:8px;border-radius:2px;vertical-align:middle"></span> ${v ? v.mn.toLocaleString('es-PE') + ' → ' + v.mx.toLocaleString('es-PE') : ''}</div>`; }
  function setBase(k) { base = k; for (const b in BASES) if (BASES[b].tiles && mapa.getLayer('base_' + b)) mapa.setLayoutProperty('base_' + b, 'visibility', b === k ? 'visible' : 'none'); (OSCURO.fondo || []).forEach(l => mapa.getLayer(l.id) && mapa.setLayoutProperty(l.id, 'visibility', k === 'oscuro' ? 'visible' : 'none')); GIBS_DEF.forEach(d => mapa.getLayer('gibs_' + d.id) && mapa.setLayoutProperty('gibs_' + d.id, 'visibility', ('gibs_' + d.id) === k ? 'visible' : 'none')); Object.keys(S2_DEF).forEach(id => mapa.getLayer(id) && mapa.setLayoutProperty(id, 'visibility', id === k ? 'visible' : 'none')); if (k.startsWith('gibs_') || k.startsWith('s2')) { mapa.setLayoutProperty('base_esri', 'visibility', 'visible'); for (const b in BASES) if (b !== 'esri') mapa.setLayoutProperty('base_' + b, 'visibility', 'none'); } document.querySelectorAll('#bases button').forEach(b => { const on = b.dataset.base === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); actualizarEstado(); }
  function setCapa(id, on) { const ids = [id, id + '_txt', id + '_l', id + '_tr', id + '_nucleo', id + '_glow', id + '_f', id + '_pt']; if (id === 'limite') ids.push('mascara'); ids.forEach(l => mapa.getLayer(l) && mapa.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')); const c = CAPAS.find(x => x.id === id); if (c) c.on = on; const b = document.querySelector(`#capas button[data-capa="${id}"]`); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } if (!actualizacionEnLote) { actualizarLeyenda(); actualizarEstado(); } }
  function actualizarLeyenda() {
    const l = $('#mapaLeyenda'); const arb = CAPAS.find(c => c.id === 'arbolado'), cen = CAPAS.find(c => c.id === 'centralidad'), ele = CAPAS.find(c => c.id === 'electricidad'), tra = CAPAS.find(c => c.id === 'trafico'), cru = CAPAS.find(c => c.id === 'intensidad_urbana');
    setTimeout(() => { const sel = document.getElementById('modoEdif'); if (sel) sel.onchange = () => setModoEdificios(sel.value); const sa = document.getElementById('metricaAtlas'); if (sa) sa.onchange = () => mostrarAtlas(sa.value); const sz = document.getElementById('metricaZonas'); if (sz) sz.onchange = () => mostrarZonas(sz.value); }, 0);
    const rampa = `<span style="background:linear-gradient(90deg,#315b74,#23b5a3,#f7c948,#ff8152,#e43d48);display:inline-block;width:76px;height:8px;border-radius:2px;vertical-align:middle"></span>`;
    l.innerHTML = leyendaEdificios() + leyendaAtlas() + leyendaZonas()
      + (ele && ele.on ? `<div style="color:#f7c948">Demanda máxima SED: ${rampa}</div><div style="color:#728a92">0 → 1.000+ kW · OSINERGMIN · no kWh</div>` : '')
      + (tra && tra.on ? `<div style="color:#ffb090">Presión vial estructural: ${rampa}</div><div style="color:#728a92">0 → 100 · proxy, no tráfico en vivo</div>` : '')
      + (cru && cru.on ? `<div style="color:#7fe0d2">Intensidad urbana por zona: ${rampa}</div><div style="color:#728a92">media simple de energía + edificación + vías</div>` : '')
      + (cen && cen.on ? `<div style="color:#7fe0d2">Intensidad derivada: <span style="background:linear-gradient(90deg,#184f95,#3987e5,#23b5a3,#fab219,#e66767);display:inline-block;width:70px;height:8px;border-radius:2px;vertical-align:middle"></span> baja → alta</div><div style="color:#728a92">puntos de OSM, licencias municipales y padrones oficiales</div>` : '')
      + (arb && arb.on ? `<div style="color:#9fb3b8">árboles/ha: <span style="background:linear-gradient(90deg,#184f95,#3987e5,#cde2fb);display:inline-block;width:70px;height:8px;border-radius:2px;vertical-align:middle"></span> 0 → 160+</div>` : '')
      + CAPAS.filter(c => c.on && !['edificios_nunoa', 'atlas', 'centralidad', 'electricidad', 'trafico', 'intensidad_urbana'].includes(c.id) && (c.id === 'edificios' || (capasPropias[c.id] && capasPropias[c.id].cargada))).map(c => `<div><i style="--sw:${c.color}"></i>${c.n}${capasPropias[c.id] && capasPropias[c.id].gj ? ` <span style="color:#728a92">${capasPropias[c.id].gj.features.length}</span>` : ''}</div>`).join('')
      + (base.startsWith('gibs_') ? `<div style="margin-top:4px;color:#7fe0d2">NASA GIBS · ${(GIBS_DEF.find(d => 'gibs_' + d.id === base) || {}).fecha || ''}</div>` : S2_DEF[base] ? `<div style="margin-top:4px;color:#7fe0d2">Sentinel-2 L2A · ${S2_DEF[base].fecha} · 10 m</div>` : '');
  }

  function toggleAyuda(forzar) { const p = $('#mapaAyuda'), on = forzar == null ? p.hidden : !!forzar; if (on) p._foco = document.activeElement; p.hidden = !on; if (on) { $('#mapaInicio').hidden = true; p.querySelector('.mapa-ayuda-cerrar').focus(); } else if (p._foco && p._foco.focus) p._foco.focus(); }
  async function copiarTexto(texto) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; } } catch (_) { }
    try { const t = document.createElement('textarea'); t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (_) { return false; }
  }
  async function compartirVista() {
    const c = mapa.getCenter(), q = new URLSearchParams(); q.set('base', base); q.set('capas', CAPAS.filter(x => x.on).map(x => x.id).join(',')); q.set('vista', [c.lng.toFixed(5), c.lat.toFixed(5), mapa.getZoom().toFixed(2), mapa.getPitch().toFixed(0), mapa.getBearing().toFixed(0)].join(','));
    if (EDIF.cargada && CAPAS.find(x => x.id === 'edificios_nunoa').on) q.set('modo', EDIF.modo); if (CAPAS.find(x => x.id === 'atlas').on) q.set('atlas', ATL.metrica || 'indice'); if (CAPAS.find(x => x.id === 'zonas14').on) q.set('zonas', ZON.metrica || 'indice'); if (comparando) q.set('comparar', '1'); if (ultimoPunto) q.set('punto', ultimoPunto.map(x => x.toFixed(5)).join(','));
    const url = `${location.origin}${location.pathname}?${q.toString()}#gemelo`; const ok = await copiarTexto(url); notificar(ok ? 'Enlace copiado · conserva cámara, base y capas' : 'No se pudo copiar el enlace');
  }

  function ui() {
    const bs = $('#bases'); bs.innerHTML = Object.keys(BASES).map(k => `<button type="button" data-base="${k}" class="${k === base ? 'on' : ''}" aria-pressed="${k === base}">${BASES[k].n}</button>`).join('');
    conEstilo(mapa, () => { Object.keys(S2_DEF).forEach(id => { const b = document.createElement('button'); b.type = 'button'; b.dataset.base = id; b.innerHTML = `${S2_DEF[id].n} · ${S2_DEF[id].fecha}`; b.title = 'Recorte Sentinel-2 L2A, 10 m, nubes en la ventana ' + S2_DEF[id].nubes + ' %'; b.setAttribute('aria-pressed', 'false'); bs.appendChild(b); }); GIBS_DEF.forEach(d => { if (d.ok) { const b = document.createElement('button'); b.type = 'button'; b.dataset.base = 'gibs_' + d.id; b.innerHTML = `${d.n} · ${d.fecha}`; b.title = 'NASA GIBS · fecha comprobada'; b.setAttribute('aria-pressed', 'false'); bs.appendChild(b); } }); bs.querySelectorAll('button').forEach(b => b.onclick = () => { setBase(b.dataset.base); actualizarLeyenda(); }); });
    bs.querySelectorAll('button').forEach(b => b.onclick = () => setBase(b.dataset.base));
    const grupos = [...new Set(CAPAS.map(c => c.g))]; const cs = $('#capas'); cs.innerHTML = grupos.map(g => `<section class="mapa-capa-grupo"><h3>${g}</h3><div>${CAPAS.filter(c => c.g === g).map(c => `<button type="button" data-capa="${c.id}" class="${c.on ? 'on' : ''}" aria-pressed="${c.on}" style="--sw:${c.color}"><span class="sw"></span>${c.n}<small>${c.archivo ? 'dato territorial' : c.id === 'hitos' ? 'rótulos de contexto' : c.virtual ? 'capa derivada' : 'contexto visual'}</small></button>`).join('')}</div></section>`).join('');
    cs.querySelectorAll('button').forEach(b => b.onclick = () => { const c = CAPAS.find(x => x.id === b.dataset.capa); if (c.id === 'edificios_nunoa') { toggleEdificiosNunoa(b); return; } if (c.id === 'atlas') { if (!c.on) mostrarAtlas(ATL.metrica || 'indice'); else { setCapa('atlas', false); if (mapa.getLayer('mascara') && CAPAS.find(x => x.id === 'limite').on) mapa.setLayoutProperty('mascara', 'visibility', 'visible'); } return; } if (c.id === 'zonas14') { if (!c.on) mostrarZonas(ZON.metrica || 'indice'); else setCapa('zonas14', false); return; } if (c.id === 'edificios') { c.on = !c.on; mapa.setLayoutProperty('edificios', 'visibility', c.on ? 'visible' : 'none'); b.classList.toggle('on', c.on); b.setAttribute('aria-pressed', String(c.on)); actualizarLeyenda(); actualizarEstado(); return; } setCapa(c.id, !c.on); });
    $('#acciones').querySelectorAll('button').forEach(b => b.onclick = () => accion(b.dataset.act, b));
    $('#divisor').addEventListener('pointerdown', arrastrarDivisor);
    const panel = $('#mapaPanel'), abrir = $('#btnMapaPanel'), cerrar = $('#cerrarMapaPanel');
    const ajustarPadding = (on, dur) => { const izq = on && !window.matchMedia('(max-width: 900px)').matches ? Math.min(344, Math.round(innerWidth * .3)) : 0; try { mapa.easeTo({ padding: { left: izq, top: 0, right: 0, bottom: 0 }, duration: dur == null ? 450 : dur }); } catch (_) { } };
    const mostrarPanel = on => { panel.classList.toggle('cerrado', !on); panel.inert = !on; panel.setAttribute('aria-hidden', String(!on)); abrir.setAttribute('aria-expanded', String(on)); ajustarPadding(on); };
    abrir.onclick = () => mostrarPanel(panel.classList.contains('cerrado'));
    cerrar.onclick = () => { mostrarPanel(false); abrir.focus(); };
    if (window.matchMedia('(max-width: 900px)').matches) mostrarPanel(false); else ajustarPadding(true, 0);
    const PRESETS = {
      cruce: { base: 'oscuro', capas: ['limite', 'intensidad_urbana', 'electricidad', 'trafico'], pitch: 36, kpis: 'cruce' },
      energia: { base: 'oscuro', capas: ['limite', 'electricidad', 'edificios'], pitch: 44, kpis: 'energia' },
      densificacion: { base: 'oscuro', capas: ['limite', 'zonas14', 'prc', 'metro', 'edificios_nunoa'], modo: 'intensidad', zonas: 'm2_construidos_hab', pitch: 62, kpis: 'densificacion' },
      trafico: { base: 'oscuro', capas: ['limite', 'trafico', 'metro', 'paraderos', 'ciclovias'], pitch: 38, kpis: 'trafico' },
      movilidad: { base: 'oscuro', capas: ['limite', 'vecinas', 'metro', 'paraderos', 'ciclovias', 'vialidad'] },
      servicios: { base: 'oscuro', capas: ['limite', 'metro', 'educacion', 'salud', 'cultura'] },
      turismo: { base: 'esri', capas: ['limite', 'hospedaje', 'comercio', 'cultura', 'verdes'], pitch: 55 },
      verde: { base: 'esri', capas: ['limite', 'verdes', 'ciclovias'] },
      planificacion: { base: 'oscuro', capas: ['limite', 'sectores', 'prc', 'patrimonio', 'edificios'] },
      edificacion: { base: 'oscuro', capas: ['limite', 'metro', 'edificios_nunoa'], modo: 'pisos', pitch: 60 },
      riesgo: { base: 'esri', capas: ['limite', 'tsunami', 'sismos', 'edificios'], pitch: 50 },
      limpiar: { base: 'esri', capas: ['limite', 'vecinas', 'metro', 'cultura', 'verdes', 'edificios'] },
    };

    async function aplicarPreset(nombre, origen) {
      const p = PRESETS[nombre]; if (!p) return;
      if (p.modo) EDIF.modo = p.modo;
      const quiereEdif = p.capas.includes('edificios_nunoa'), chipE = document.querySelector('#capas button[data-capa="edificios_nunoa"]'), cE = CAPAS.find(x => x.id === 'edificios_nunoa');
      if (quiereEdif && chipE && (!EDIF.cargada || !cE.on)) await toggleEdificiosNunoa(chipE);
      else if (!quiereEdif && EDIF.cargada && cE.on && chipE) await toggleEdificiosNunoa(chipE);
      if (p.modo && EDIF.cargada) setModoEdificios(p.modo);
      actualizacionEnLote = true;
      CAPAS.forEach(c => {
        if (c.id === 'edificios_nunoa' || c.id === 'hitos') return;
        if (c.id === 'edificios') {
          c.on = p.capas.includes(c.id); mapa.getLayer('edificios') && mapa.setLayoutProperty('edificios', 'visibility', c.on ? 'visible' : 'none');
          const eb = document.querySelector('#capas button[data-capa="edificios"]'); if (eb) { eb.classList.toggle('on', c.on); eb.setAttribute('aria-pressed', String(c.on)); }
        } else setCapa(c.id, p.capas.includes(c.id));
      });
      actualizacionEnLote = false;
      if (p.zonas) mostrarZonas(p.zonas); else { actualizarLeyenda(); actualizarEstado(); }
      setBase(p.base); pintarKpis(p.kpis || 'sistema');
      document.querySelectorAll('#mapaPresets button').forEach(x => { const on = x.dataset.preset === nombre; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      document.querySelectorAll('#mapaLentes button').forEach(x => { const on = x.dataset.lente === nombre; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      mapa.easeTo({ pitch: p.pitch != null ? p.pitch : (nombre === 'planificacion' ? 55 : 25), bearing: 0, duration: 700 });
      notificar(`Vista ${(origen && origen.textContent || nombre).trim()} activada`); if (matchMedia('(max-width: 900px)').matches) mostrarPanel(false);
    }
    $('#mapaPresets').querySelectorAll('button').forEach(b => b.onclick = () => aplicarPreset(b.dataset.preset, b));
    $('#mapaLentes').querySelectorAll('button').forEach(b => b.onclick = () => aplicarPreset(b.dataset.lente, b));
    pintarKpis('sistema');
    const inp = $('#mapaBuscar'), res = $('#mapaResultados');
    inp.addEventListener('input', () => { const q = inp.value.trim().toLocaleLowerCase('es'); if (q.length < 2) { res.hidden = true; return; } const hallados = lugares.filter(l => l.nombre.toLocaleLowerCase('es').includes(q)).slice(0, 8); res.innerHTML = hallados.length ? hallados.map((l, i) => `<button type="button" data-i="${i}"><span>${l.nombre}</span><small>${l.tipo}</small></button>`).join('') : '<button type="button" disabled>Sin coincidencias</button>'; res.hidden = false; res.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { const l = hallados[Number(b.dataset.i)]; irA(l); inp.value = l.nombre; res.hidden = true; mostrarPanel(false); }); });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') { res.hidden = true; inp.blur(); } });
    const inicio = $('#mapaInicio'); const cerrarInicio = () => { inicio.hidden = true; try { localStorage.setItem('lima_inicio_v1', '1'); } catch (_) { } };
    inicio.querySelector('.mapa-inicio-cerrar').onclick = cerrarInicio; inicio.querySelectorAll('[data-inicio]').forEach(b => b.onclick = () => { cerrarInicio(); mostrarPanel(false); aplicarPreset(b.dataset.inicio, b); });
    try { if (!location.search && localStorage.getItem('lima_inicio_v1') !== '1') setTimeout(() => { inicio.hidden = false; }, 900); } catch (_) { }
    $('#mapaAyuda').querySelector('.mapa-ayuda-cerrar').onclick = () => toggleAyuda(false);
    $('#reiniciarIntro').onclick = () => { toggleAyuda(false); inicio.hidden = false; try { localStorage.removeItem('lima_inicio_v1'); } catch (_) { } };
    document.addEventListener('keydown', e => { const tag = (e.target.tagName || '').toLowerCase(), escribiendo = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable; if (escribiendo || e.metaKey || e.ctrlKey || e.altKey) return; const r = document.getElementById('gemelo').getBoundingClientRect(), visible = r.bottom > 0 && r.top < innerHeight; if (!visible && e.key !== 'Escape') return; const k = e.key.toLowerCase(); if (k === '?') { e.preventDefault(); toggleAyuda(); } else if (k === 'e') { e.preventDefault(); mostrarPanel(panel.classList.contains('cerrado')); } else if (k === 'a') { e.preventDefault(); document.querySelector('#acciones button[data-act="analizar"]').click(); } else if (k === 'm') { e.preventDefault(); document.querySelector('#acciones button[data-act="medir"]').click(); } else if (k === 'h') { e.preventDefault(); document.querySelector('#acciones button[data-act="tecnico"]').click(); } else if (k === 'v') { e.preventDefault(); document.querySelector('#tour .tour-play').click(); } else if (/^[1-4]$/.test(e.key)) { e.preventDefault(); const lente = ['cruce', 'energia', 'densificacion', 'trafico'][Number(e.key) - 1]; const lb = document.querySelector(`#mapaLentes button[data-lente="${lente}"]`); lb && lb.click(); } else if (e.key === 'Escape') { if (!$('#mapaAyuda').hidden) toggleAyuda(false); if (!inicio.hidden) cerrarInicio(); if (VUELO.jugando) detenerVuelo(); if (MEDICION.activa) document.querySelector('#acciones button[data-act="medir"]').click(); const fc = $('#mapaFicha button'); if (fc) fc.click(); } });
    tour();
    actualizarEstado();
  }

  function accion(a, b) {
    if (a === 'analizar') { if (MEDICION.activa) { const mb = document.querySelector('#acciones button[data-act="medir"]'); mb && alternarMedicion(mb); analizarActivo = true; } else analizarActivo = !analizarActivo; b.classList.toggle('on', analizarActivo); b.setAttribute('aria-pressed', String(analizarActivo)); actualizarEstado(); notificar(analizarActivo ? 'Análisis activo · haz clic en el mapa' : 'Análisis pausado'); }
    if (a === 'medir') alternarMedicion(b);
    if (a === 'tecnico') { tecnicoActivo = !tecnicoActivo; $('#mapaHud').hidden = !tecnicoActivo; $('#mapaWrap').classList.toggle('tecnico', tecnicoActivo); b.classList.toggle('on', tecnicoActivo); b.setAttribute('aria-pressed', String(tecnicoActivo)); try { localStorage.setItem('lima_hud', tecnicoActivo ? '1' : '0'); } catch (_) { } notificar(tecnicoActivo ? 'Telemetría visible' : 'Telemetría oculta'); }
    if (a === 'compartir') compartirVista();
    if (a === 'ayuda') toggleAyuda();
    if (a === '3d') { const on = mapa.getPitch() > 5; mapa.easeTo({ pitch: on ? 0 : 55, bearing: on ? 0 : -17, duration: 900 }); b.classList.toggle('on', !on); b.setAttribute('aria-pressed', String(!on)); if (mapaB) mapaB.easeTo({ pitch: on ? 0 : 55, bearing: on ? 0 : -17, duration: 900 }); notificar(on ? 'Vista 2D activada' : 'Vista 3D activada'); }
    if (a === 'norte') { mapa.easeTo({ bearing: 0, duration: 600 }); }
    if (a === 'full') { const w = $('#mapaWrap'); document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen && w.requestFullscreen(); setTimeout(() => { mapa.resize(); mapaB && mapaB.resize(); }, 400); }
    if (a === 'google') { const c = mapa.getCenter(); window.open(`https://www.google.com/maps/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(mapa.getZoom() + 1)}z/data=!3m1!1e3?hl=es`, '_blank', 'noopener'); }
    if (a === 'trafico_vivo') { const c = mapa.getCenter(); window.open(`https://www.google.com/maps/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(mapa.getZoom() + 1)}z/data=!5m1!1e1?hl=es`, '_blank', 'noopener'); }
    if (a === 'earth') { const c = mapa.getCenter(); const d = Math.round(40000000 / Math.pow(2, mapa.getZoom())); window.open(`https://earth.google.com/web/@${c.lat.toFixed(5)},${c.lng.toFixed(5)},560a,${d}d,35y,${(-mapa.getBearing()).toFixed(0)}h,${Math.round(mapa.getPitch())}t,0r`, '_blank', 'noopener'); }
    if (a === 'comparar') { comparando ? cerrarComparar(b) : abrirComparar(b); notificar(comparando ? 'Comparador temporal activado · arrastra el divisor' : 'Comparador cerrado'); }
  }

  // Comparador de barrido: un segundo mapa sincronizado, recortado con clip-path por el divisor.
  function abrirComparar(b) {
    comparando = true; b.classList.add('on'); $('#mapaB').style.display = 'block'; $('#divisor').hidden = false;
    if (!mapaB) { mapaB = crearMapa('mapaB'); window.mapaB = mapaB; conEstilo(mapaB, () => { try { mapaB.setTerrain({ source: 'terrarium', exaggeration: 1.25 }); } catch (_) { } montarGIBS(mapaB); montarS2(mapaB); if (S2_DEF.s2_2025) { mapaB.setLayoutProperty('s2_2025', 'visibility', 'visible'); mapaB._capaB = { id: 's2_2025', n: S2_DEF.s2_2025.n, fecha: S2_DEF.s2_2025.fecha }; if (S2_DEF.s2) setBase('s2'); } else { const alt = GIBS_DEF.find(d => d.ok && d.id === 'hls') || GIBS_DEF.find(d => d.ok); if (alt) { mapaB.setLayoutProperty('gibs_' + alt.id, 'visibility', 'visible'); mapaB._capaB = alt; } } etiquetas(mapaB); const gjL = capasPropias.limite && capasPropias.limite.gj; if (gjL) { mapaB.addSource('src_limite', { type: 'geojson', data: gjL }); mapaB.addLayer({ id: 'limite', type: 'line', source: 'src_limite', paint: { 'line-color': '#23b5a3', 'line-width': 3 } }); } const tag = document.createElement('div'); tag.className = 'leyenda'; tag.style.cssText = 'left:auto;right:12px;top:110px;bottom:auto'; tag.id = 'leyendaB'; $('#mapaWrap').appendChild(tag); pintarLeyendaB(); }); let lock = false; const sync = (a, c) => () => { if (lock) return; lock = true; c.jumpTo({ center: a.getCenter(), zoom: a.getZoom(), pitch: a.getPitch(), bearing: a.getBearing() }); lock = false; }; mapa.on('move', sync(mapa, mapaB)); mapaB.on('move', sync(mapaB, mapa)); }
    mapaB.resize(); posDivisor(.5);
  }
  function pintarLeyendaB() { const l = $('#leyendaB'); if (!l) return; const ok = GIBS_DEF.filter(d => d.ok); const opciones = Object.keys(S2_DEF).map(id => ({ id, n: S2_DEF[id].n, fecha: S2_DEF[id].fecha, capa: id })).concat(ok.map(d => ({ id: d.id, n: d.n, fecha: d.fecha, capa: 'gibs_' + d.id }))); l.innerHTML = `<div style="color:#7fe0d2">Lado derecho: ${mapaB._capaB ? mapaB._capaB.n + ' · ' + mapaB._capaB.fecha : 'ESRI'}</div>` + opciones.map(o => `<div><button data-b="${o.id}" data-capa="${o.capa}" style="background:none;border:1px solid #1e3239;color:#9fb3b8;border-radius:99px;padding:1px 7px;cursor:pointer;font:10.5px monospace">${o.n} ${o.fecha}</button></div>`).join(''); l.querySelectorAll('button').forEach(b => b.onclick = () => { opciones.forEach(o => mapaB.getLayer(o.capa) && mapaB.setLayoutProperty(o.capa, 'visibility', o.capa === b.dataset.capa ? 'visible' : 'none')); mapaB._capaB = opciones.find(o => o.id === b.dataset.b); pintarLeyendaB(); }); }
  function cerrarComparar(b) { comparando = false; b.classList.remove('on'); $('#mapaB').style.display = 'none'; $('#divisor').hidden = true; const l = $('#leyendaB'); l && l.remove(); mapaB && mapaB.remove(); mapaB = null; }
  function posDivisor(p) { p = Math.max(.02, Math.min(.98, p)); $('#divisor').style.left = (p * 100) + '%'; $('#mapaB').style.clipPath = `inset(0 0 0 ${p * 100}%)`; }
  function arrastrarDivisor(e) { const w = $('#mapaWrap').getBoundingClientRect(); const mover = ev => posDivisor((ev.clientX - w.left) / w.width); const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); }; window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar); e.preventDefault(); }

  // Vuelo técnico: paradas resueltas contra las capas cargadas, con piloto automático cancelable al arrastrar.
  const PARADAS = [
    { n: 'Central Park', busca: /central park/i, ll: [-73.9654, 40.7829], z: 14.0, b: -20, capas: ['cultura', 'verdes'] },
    { n: 'Times Square', busca: /times square/i, ll: [-73.9851, 40.7580], z: 16.4, b: 60, pitch: 66, capas: ['cultura', 'comercio'] },
    { n: 'Empire State', busca: /empire state/i, ll: [-73.9857, 40.7484], z: 16.5, b: 0, capas: ['patrimonio', 'comercio'] },
    { n: 'Statue of Liberty', busca: /statue of liberty/i, ll: [-74.0445, 40.6892], z: 16.6, b: 90, pitch: 68, capas: ['cultura', 'verdes'] },
    { n: 'Broadway', ll: [-73.9870, 40.7590], z: 15.2, b: -12, pitch: 62, capas: ['metro', 'comercio'] },
    { n: 'Brooklyn Bridge', ll: [-73.9969, 40.7061], z: 15, b: 120, pitch: 70, capas: ['tsunami', 'verdes'] },
  ];

  function tour() { const t = $('#tour'); t.innerHTML = `<button type="button" class="tour-play" aria-label="Iniciar vuelo territorial">▶</button><div class="tour-cuenta"><b id="tourTitulo">Vuelo territorial</b><small id="tourMeta">6 hitos · cámara 3D</small><div class="tour-pista"><i></i></div></div><div class="tour-paradas">${PARADAS.map((p, i) => `<button type="button" data-i="${i}" title="${p.n}" aria-label="${p.n}">${i + 1}</button>`).join('')}</div>`; t.querySelector('.tour-play').onclick = () => VUELO.jugando ? detenerVuelo() : iniciarVuelo(); t.querySelectorAll('.tour-paradas button').forEach(b => b.onclick = () => { detenerVuelo(); irParada(PARADAS[Number(b.dataset.i)], Number(b.dataset.i), false); }); }
  function estadoVuelo() { const t = $('#tour'); if (!t) return; const play = t.querySelector('.tour-play'); play.textContent = VUELO.jugando ? 'Ⅱ' : '▶'; play.classList.toggle('on', VUELO.jugando); const p = PARADAS[Math.max(0, VUELO.indice)]; $('#tourTitulo').textContent = VUELO.indice < 0 ? 'Vuelo territorial' : p.n; $('#tourMeta').textContent = VUELO.indice < 0 ? '6 hitos · cámara 3D' : `${VUELO.indice + 1} / ${PARADAS.length} · ${VUELO.jugando ? 'piloto automático' : 'vista seleccionada'}`; t.querySelector('.tour-pista i').style.width = (VUELO.indice < 0 ? 0 : (VUELO.indice + 1) / PARADAS.length * 100) + '%'; t.querySelectorAll('.tour-paradas button').forEach((b, i) => b.classList.toggle('on', i === VUELO.indice)); }
  function iniciarVuelo() { clearTimeout(VUELO.reloj); VUELO.jugando = true; const siguiente = VUELO.indice >= PARADAS.length - 1 ? 0 : VUELO.indice + 1; irParada(PARADAS[siguiente], siguiente, true); }
  function detenerVuelo() { clearTimeout(VUELO.reloj); VUELO.jugando = false; estadoVuelo(); }
  function irParada(p, indice, automatico) { VUELO.indice = indice == null ? PARADAS.indexOf(p) : indice; let ll = p.ll; if (p.busca) { const l = lugares.find(x => p.busca.test(x.nombre)); if (l) ll = l.ll; } (p.capas || []).forEach(id => { const c = CAPAS.find(x => x.id === id); if (c && !c.on && capasPropias[id] && capasPropias[id].cargada) setCapa(id, true); }); estadoVuelo(); const reducida = matchMedia('(prefers-reduced-motion: reduce)').matches; if (automatico) mapa.once('moveend', () => { if (!VUELO.jugando) return; VUELO.reloj = setTimeout(() => { if (VUELO.indice >= PARADAS.length - 1) detenerVuelo(); else irParada(PARADAS[VUELO.indice + 1], VUELO.indice + 1, true); }, reducida ? 800 : 2200); }); mapa.flyTo({ center: ll, zoom: p.z, bearing: p.b || 0, pitch: p.pitch || 58, duration: reducida ? 0 : (automatico ? 3200 : 1900), essential: false }); analizarEntorno(ll, p.n); }
  function irA(l) { document.getElementById('gemelo').scrollIntoView({ behavior: 'smooth' }); const c = CAPAS.find(x => x.id === l.capa); if (c && !c.on) setCapa(l.capa, true); mapa.flyTo({ center: l.ll, zoom: 17, pitch: 58, duration: 1800, essential: true }); analizarEntorno(l.ll, l.nombre); }
  function buscarLugares(q) { const t = String(q || '').trim().toLocaleLowerCase('es'); return t.length < 2 ? [] : lugares.filter(l => l.nombre.toLocaleLowerCase('es').includes(t)).slice(0, 12); }

  function irZonaIntensidad(zona) {
    const c = capasPropias.intensidad_urbana, f = c && c.gj && c.gj.features.find(x => String(x.properties.zona) === String(zona)); if (!f) return;
    if (!CAPAS.find(x => x.id === 'intensidad_urbana').on) setCapa('intensidad_urbana', true);
    const cs = coordsPlanas(f.geometry.coordinates), bounds = cs.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(cs[0], cs[0])); mapa.fitBounds(bounds, { padding: 110, pitch: 42, duration: 1100, maxZoom: 15.3 });
    const p = f.properties, ficha = $('#mapaFicha'); ficha.hidden = false;
    ficha.innerHTML = `<button type="button" aria-label="Cerrar">✕</button><b>${p.nombre} · intensidad ${Number(p.indice_intensidad_urbana).toLocaleString('es-PE', { maximumFractionDigits: 1 })}/100</b><span>Índice comparativo entre las 14 zonas</span><div class="entorno-grid"><div class="entorno-metrica"><strong>${Number(p.score_energia).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong><em>energía normalizada</em></div><div class="entorno-metrica"><strong>${Number(p.score_edificacion).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong><em>edificación normalizada</em></div><div class="entorno-metrica"><strong>${Number(p.score_vial).toLocaleString('es-PE', { maximumFractionDigits: 0 })}</strong><em>presión vial normalizada</em></div><div class="entorno-metrica"><strong>${Number(p.subestaciones).toLocaleString('es-PE')}</strong><em>subestaciones</em></div><div class="entorno-metrica"><strong>${Number(p.demanda_kw_ha).toLocaleString('es-PE', { maximumFractionDigits: 1 })}</strong><em>kW máximos declarados/ha</em></div><div class="entorno-metrica"><strong>${Number(p.m2_construidos_ha).toLocaleString('es-PE')}</strong><em>m² construidos/ha</em></div></div><small class="entorno-fuente">Media simple de tres dimensiones normalizadas min–max. Es intensidad relativa, no riesgo ni déficit. OSINERGMIN + OSM + IMP/ATU.</small>`;
    ficha.querySelector('button').onclick = () => { ficha.hidden = true; };
  }

  window.MAPA = { init, lugares: () => lugares, buscarLugares, irA, irZonaIntensidad, analizar: analizarEntorno, setBase, setCapa, CAPAS, GIBS_DEF, capas: () => capasPropias , edificios: () => EDIF, setModoEdificios, toggleEdificiosNunoa, mostrarZonas, mostrarAtlas, atlasActivo: () => (CAPAS.find(x => x.id === 'atlas').on ? ATL.metrica : null) };
})();
