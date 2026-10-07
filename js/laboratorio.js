(function () {
  const $ = s => document.querySelector(s), A = ANALISIS;
  let L, D, seleccionado, activo = false;
  const n = (v, d = 1) => A.valido(v) ? G.fmt.n(v, d) : '—';
  const opciones = () => D.map(d => `<option value="${d.puma}">${G.esc(d.etiqueta + ' · ' + d.nombre)}</option>`).join('');
  const campos = [
    ['ingreso_mediano', 'Ingreso mediano', 'US$', 'F10 · ACS 2020–2024'],
    ['alquiler_mediano', 'Alquiler mediano', 'US$/mes', 'F10 · ACS 2020–2024'],
    ['pct_pobreza', 'Pobreza', '%', 'F10 · ACS 2020–2024'],
    ['pct_hogares_con_carga_alquiler', 'Carga de alquiler', '%', 'F10 · ACS 2020–2024'],
    ['delitos_graves_por_1000', 'Delitos graves', '/1.000 hab.', 'F04 · 2025'],
    ['solicitudes_311_por_1000', 'Solicitudes 311', '/1.000 hab.', 'F03 · 2025'],
    ['heridos_transito_por_10000', 'Heridos de tránsito', '/10.000 hab.', 'F02 · 2025'],
    ['pm25', 'PM2,5', 'µg/m³', 'F15 · último año del lago'],
    ['pct_transporte_publico', 'Transporte público al trabajo', '%', 'F10 · ACS 2020–2024'],
    ['arboles_calle_por_km2', 'Árboles de calle', '/km²', 'F07 · censo 2015'],
    ['viviendas_obra_nueva_por_1000', 'Viviendas propuestas', '/1.000 hab.', 'F05 · 2025'],
    ['viviendas_asequibles_por_1000', 'Viviendas asequibles', '/1.000 hab.', 'F16 · acumulado desde 2014']
  ];
  function comparar() {
    const a = D.find(d => d.puma === $('#compA').value), b = D.find(d => d.puma === $('#compB').value);
    $('#compResultado').innerHTML = `<div class="tabla-scroll"><table><thead><tr><th>Indicador / fuente</th><th>${G.esc(a.nombre)} (A)</th><th>${G.esc(b.nombre)} (B)</th><th>B − A</th></tr></thead><tbody>${campos.map(([k, titulo, unidad, fuente]) => {
      const dif = A.diferencia(a[k], b[k]);
      return `<tr><th>${titulo}<small>${unidad} · ${fuente}</small></th><td>${n(a[k])}</td><td>${n(b[k])}</td><td>${n(dif.absoluta)} ${unidad === '%' ? 'pp' : unidad}${unidad === '%' ? '' : ` (${n(dif.porcentaje)} %)`}</td></tr>`;
    }).join('')}</tbody></table></div><p class="veredicto">${a === b ? 'Elegiste el mismo distrito: las diferencias son cero.' : campos.filter(([k]) => ['pct_pobreza','pct_hogares_con_carga_alquiler','pm25','delitos_graves_por_1000'].includes(k) && A.valido(a[k]) && A.valido(b[k])).map(([k,t]) => `${t}: ${a[k] === b[k] ? 'igual en ambos' : 'mayor en ' + G.esc(a[k] > b[k] ? a.nombre : b.nombre)}`).join(' · ')}.</p><p class="nota">Diferencias descriptivas, sin prueba de significancia. Ingreso ACS: margen de error A ±${n(a.ingreso_mediano_moe,0)} US$, B ±${n(b.ingreso_mediano_moe,0)} US$. Las tasas usan residentes, no población de paso; PUMA 4165 (Midtown) requiere especial cuidado. Un porcentaje con base cero queda sin resultado.</p>`;
  }
  const preguntas = [
    ['¿Dónde coinciden pobreza y contaminación?', {pobreza:50, aire:50}],
    ['¿Dónde hay mayor presión de vivienda?', {vivienda:60, pobreza:40}],
    ['¿Qué distritos tienen más carga de seguridad y tránsito?', {seguridad:50, vial:50}],
    ['¿Dónde hay más solicitudes 311 por habitante?', {calidad:100}],
    ['¿Qué distritos necesitan mayor atención?', {calidad:1, seguridad:1, vial:1, vivienda:1, pobreza:1, aire:1}]
  ];
  function preguntar(i) {
    if (!preguntas[i]) return;
    DIAGNOSTICO.personalizar(preguntas[i][1]); MAPA.indice();
    $('#respuestaNYC').textContent = preguntas[i][0] + ' El ranking del Panorama y la lente de atención usan ahora estos pesos. Son cruces descriptivos; no demuestran causalidad.';
    document.getElementById('panorama').scrollIntoView({behavior:'smooth'});
  }
  function espacial() {
    $('#espacialControles').innerHTML = `<h3>Analizar un punto y su entorno</h3><div class="fila-ctrl"><button class="chip" id="activarPunto" aria-pressed="false">Activar análisis al hacer clic</button><label class="campo">Radio<select id="radioPunto"><option value="500">500 m</option><option value="1000" selected>1 km</option><option value="2000">2 km</option></select></label><label class="campo">Longitud<input type="number" step="any" id="lonPunto" value="-73.9855" min="-180" max="180"></label><label class="campo">Latitud<input type="number" step="any" id="latPunto" value="40.7580" min="-90" max="90"></label><button class="chip" id="usarPunto">Analizar coordenadas</button></div><div id="resultadoPunto" aria-live="polite">Activa la herramienta y haz clic en el mapa, o introduce coordenadas. Times Square viene como ejemplo.</div>`;
    $('#activarPunto').onclick = e => { activo = !activo; e.target.setAttribute('aria-pressed', activo); e.target.classList.toggle('on', activo); };
    $('#usarPunto').onclick = () => {
      const lon = $('#lonPunto'), lat = $('#latPunto');
      if (!lon.value || !lat.value || !lon.checkValidity() || !lat.checkValidity()) { $('#resultadoPunto').textContent = 'Introduce coordenadas válidas.'; return; }
      analizarPunto([+lon.value,+lat.value]);
    };
    $('#radioPunto').onchange = () => seleccionado && analizarPunto(seleccionado);
  }
  function analizarPunto(p) {
    seleccionado = p; $('#lonPunto').value = p[0]; $('#latPunto').value = p[1];
    const metros = +$('#radioPunto').value, f = L.geo.distritos_puma?.features.find(f => A.contiene(p,f.geometry));
    const d = f && D.find(d => d.puma === f.properties.puma);
    const estaciones = L.geo.estaciones?.features.filter(f => f.geometry.type === 'Point' && A.distancia(p,f.geometry.coordinates) <= metros);
    MAPA.radio(p,metros); if (d) MAPA.seleccionar(d.puma);
    $('#resultadoPunto').innerHTML = `<h3>${d ? G.esc(d.etiqueta + ' · ' + d.nombre) : 'Punto fuera de los PUMA disponibles'}</h3><p><b>${estaciones ? estaciones.length : '—'}</b> registros de estaciones a ≤ ${metros} m en línea recta (F18 · MTA). Son filas por andén/línea; no equivalen a complejos únicos ni a distancia caminando.</p>${d ? `<p>Contexto del PUMA: pobreza ${n(d.pct_pobreza)} % · carga de alquiler ${n(d.pct_hogares_con_carga_alquiler)} % · PM2,5 ${n(d.pm25,2)} µg/m³ · atención ${n(DIAGNOSTICO.puntaje(d.puma))}/100.</p>` : ''}<p class="nota">El contexto corresponde al distrito completo, no al radio. El lago no conserva puntos de incidentes, 311 ni árboles: no se estiman conteos locales a partir de tasas distritales. El círculo se dibuja cuando el mapa está disponible.</p>`;
  }
  function series() {
    const res = [];
    const aire = L.datos.ambiente?.aire_serie || [];
    for (const k of ['pm25','no2']) res.push({id:k, nombre:k === 'pm25' ? 'Aire · PM2,5' : 'Aire · NO₂', fuente:'F15 · NYCCAS', unidad:k === 'pm25' ? 'µg/m³' : 'ppb', escala:'borough', filas:aire.map(d=>({periodo:String(d.anio),lugar:d.lugar,v:d[k]}))});
    const mta = L.datos.movilidad?.serie_mensual || [];
    for (const k of ['subte','bus','lirr','metro_north','ingresos_zona_congestion']) res.push({id:k,nombre:'MTA · '+k.replaceAll('_',' '),fuente:'F17 · MTA',unidad:'viajes/día (promedio del mes)',escala:'red MTA',filas:mta.map(d=>({periodo:d.mes,lugar:'Red MTA',v:d[k]}))});
    res.push({id:'denuncias',nombre:'Denuncias · enero–junio',fuente:'F04 / F14 · NYPD',unidad:'denuncias',escala:'borough',filas:(L.datos.seguridad_delitos?.primer_semestre?.datos || []).flatMap(d=>[2025,2026].map(y=>({periodo:String(y),lugar:d.borough,v:d['denuncias_'+y]})))});
    return res.map(s=>({...s,filas:s.filas.filter(d=>A.valido(d.v))})).filter(s=>s.filas.length);
  }
  function temporal() {
    const S = series();
    let mapeado = false;
    $('#temporal').innerHTML = `<h2>Evolución y mapa de cambio</h2><div class="fila-ctrl"><label class="campo">Serie<select id="serieTemporal">${S.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join('')}</select></label><label class="campo">Desde<select id="desdeTemporal"></select></label><label class="campo">Hasta<select id="hastaTemporal"></select></label><label class="campo">Mapa<select id="modoTemporal"><option value="valor">Valor final</option><option value="cambio">Cambio porcentual</option></select></label><button class="chip" id="mapearTemporal">Ver en el mapa</button><button class="chip" id="restaurarMapa">Volver a atención</button></div><div id="resultadoTemporal" aria-live="polite"></div>`;
    const elegida = () => S.find(s=>s.id === $('#serieTemporal').value);
    function llenar() {
      const ps = [...new Set(elegida().filas.map(d=>d.periodo))].sort();
      const opts = ps.map(p=>`<option>${p}</option>`).join('');
      $('#desdeTemporal').innerHTML = opts; $('#hastaTemporal').innerHTML = opts; $('#hastaTemporal').value = ps.at(-1);
      let linea = $('#lineaTemporal');
      if (!linea) { linea = document.createElement('label'); linea.id = 'lineaTemporal'; linea.className = 'campo'; $('#resultadoTemporal').before(linea); }
      linea.innerHTML = `Explorar periodo final <input type="range" id="cursorTemporal" min="0" max="${ps.length-1}" value="${ps.length-1}" aria-label="Periodo final de la serie"><output id="periodoTemporal">${ps.at(-1)}</output>`;
      $('#cursorTemporal').oninput = e => { $('#hastaTemporal').value = ps[+e.target.value]; pintar(); if(mapeado) mapear(); }; pintar();
    }
    function valores() {
      const s = elegida(), desde = $('#desdeTemporal').value, hasta = $('#hastaTemporal').value;
      return [...new Set(s.filas.map(d=>d.lugar))].sort().map(lugar=>{
        const a=s.filas.find(d=>d.lugar === lugar && d.periodo === desde)?.v;
        const b=s.filas.find(d=>d.lugar === lugar && d.periodo === hasta)?.v;
        return {lugar,a,b,...A.diferencia(a,b)};
      });
    }
    function pintar() {
      const s=elegida(); $('#mapearTemporal').disabled=s.escala !== 'borough';
      const ps = [...new Set(s.filas.map(d=>d.periodo))].sort();
      $('#cursorTemporal').value = ps.indexOf($('#hastaTemporal').value); $('#periodoTemporal').textContent = $('#hastaTemporal').value;
      $('#resultadoTemporal').innerHTML = `<p>${s.fuente} · escala: <b>${s.escala}</b> · ${s.unidad}. ${s.id === 'denuncias' ? 'Ambos años comparan enero–junio; no se compara un año completo con un semestre.' : ''}</p><div class="tabla-scroll"><table><thead><tr><th>Lugar</th><th>${$('#desdeTemporal').value}</th><th>${$('#hastaTemporal').value}</th><th>Cambio absoluto</th><th>Cambio %</th></tr></thead><tbody>${valores().map(d=>`<tr><th>${G.esc(d.lugar)}</th><td>${n(d.a,2)}</td><td>${n(d.b,2)}</td><td>${n(d.absoluta,2)}</td><td>${n(d.porcentaje)} %</td></tr>`).join('')}</tbody></table></div><p class="nota">Sin dato o base cero: —. Selecciona cualquier par de periodos reales disponibles. El aire y las denuncias se mapean por borough; sus valores se repiten en los PUMA de ese borough. La serie MTA describe la red y no admite distribución territorial. Estas diferencias no permiten atribuir efectos causales al peaje.</p>`;
    }
    $('#serieTemporal').onchange=()=>{ mapeado = false; MAPA.indice(); llenar(); };
    $('#restaurarMapa').onclick=()=>{ mapeado = false; MAPA.indice(); };
    function mapear() {
      const s=elegida(); if(s.escala !== 'borough') return;
      const cambio=$('#modoTemporal').value === 'cambio', datos=valores();
      MAPA.temporal({valores:Object.fromEntries(datos.map(d=>[d.lugar,cambio ? d.porcentaje : d.b])),cambio,max:Math.max(1,...datos.map(d=>Math.abs(d.porcentaje || 0))),unidad:cambio ? '%' : s.unidad,fuente:s.fuente,titulo:s.nombre+' · '+$('#desdeTemporal').value+' → '+$('#hastaTemporal').value});
    }
    for (const id of ['desdeTemporal','hastaTemporal','modoTemporal']) $('#'+id).onchange=()=>{ pintar(); if(mapeado) mapear(); };
    $('#mapearTemporal').onclick=()=>{
      mapeado = true; mapear();
      document.getElementById('gemelo').scrollIntoView({behavior:'smooth'});
    };
    llenar();
  }
  window.LABORATORIO = {
    init(lago) {
      L=lago; D=(L.datos.distritos?.datos || []).slice().sort((a,b)=>a.etiqueta.localeCompare(b.etiqueta)); if (!D.length) return;
      $('#comparador').innerHTML=`<h2>Comparar dos distritos</h2><div class="fila-ctrl"><label class="campo">Distrito A<select id="compA">${opciones()}</select></label><button class="chip" id="intercambiarComp" aria-label="Intercambiar distritos">⇄</button><label class="campo">Distrito B<select id="compB">${opciones()}</select></label></div><div id="compResultado" aria-live="polite"></div>`;
      $('#compB').value=D[1]?.puma || D[0].puma;
      $('#compA').onchange=$('#compB').onchange=comparar;
      $('#intercambiarComp').onclick=()=>{const a=$('#compA'),b=$('#compB');[a.value,b.value]=[b.value,a.value];comparar();}; comparar();
      $('#preguntasNYC').innerHTML=`<h2>Pregúntale a NYC</h2><p>Elige una pregunta guiada para configurar el índice y el mapa con reglas transparentes.</p><div class="chips">${preguntas.map(([t],i)=>`<button class="chip" data-pregunta="${i}">${t}</button>`).join('')}</div><p id="respuestaNYC" aria-live="polite"></p>`;
      document.querySelectorAll('[data-pregunta]').forEach(b=>b.onclick=()=>preguntar(+b.dataset.pregunta));
      espacial(); temporal();
      window.addEventListener('prioridad-cambiada',()=>MAPA.actualizarIndice());
    },
    punto(p) { if(activo) analizarPunto(p); }
  };
})();
