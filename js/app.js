// Arranque: carga el lago (paquete lago.js o, si falta, los JSON sueltos), navegación, buscador, reloj, clima, tema y presentación.
(function () {
  const $ = s => document.querySelector(s);
  const ARCHIVOS = ['demografia', 'distritos', 'seguridad_vial', 'calidad_de_vida_311', 'seguridad_delitos', 'vivienda', 'economia_rodajes', 'ambiente', 'escucha_interes', 'movilidad', 'verificaciones', 'catalogo'];
  const GEOS = ['boroughs', 'distritos_puma', 'barrios_nta', 'precintos', 'estaciones'];

  async function cargar() {
    if (window.LAGO_PAQUETE) return { datos: LAGO_PAQUETE.datos, geo: LAGO_PAQUETE.geo, generado: LAGO_PAQUETE.generado };
    const j = f => fetch(f, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
    const datos = {}, geo = {};
    await Promise.all(ARCHIVOS.map(async a => { datos[a] = await j(`lago/${a}.json`); }));
    await Promise.all(GEOS.map(async g => { geo[g] = await j(`lago/geo/${g}.geojson`); }));
    return { datos, geo, generado: null };
  }

  async function arrancar() {
    const L = await cargar(); window.LAGO = L;
    const ok = ARCHIVOS.filter(a => L.datos[a]).length;
    const fechas = Object.values(L.datos).map(d => d && d._meta && d._meta.fecha_prueba).filter(Boolean).sort();
    $('#estadoDatos').innerHTML = `lago: <b>${ok}/${ARCHIVOS.length}</b> temas · probado <b>${fechas[fechas.length - 1] || '—'}</b>`;
    $('#pie').textContent = `Cerebro NYC · datos abiertos federados · lago probado ${fechas[0] || ''}${fechas[0] !== fechas[fechas.length - 1] ? ' → ' + fechas[fechas.length - 1] : ''} · réplica del Cerebro Lima para el Taller de Datos (Gestión y Gobernanza de Datos)`;
    const paso = (n, f) => { try { f(); } catch (e) { console.error(n, e); } };
    paso('diagnostico', () => DIAGNOSTICO.init(L));
    paso('secciones', () => SECCIONES.render(L));
    paso('correlaciones', () => CORRELACIONES.render(L));
    paso('mapa', () => MAPA.init(L));
    navegacion(); buscador(); reloj(); clima(); tema(); presentacion();
    if (location.hash) { const s = document.querySelector(location.hash); s && s.scrollIntoView(); }
  }

  function navegacion() {
    const enlaces = [...document.querySelectorAll('#menu a')], secs = enlaces.map(a => document.getElementById(a.dataset.sec));
    const sb = $('#sidebar'), tg = $('#navToggle');
    tg.onclick = () => { const a = sb.classList.toggle('open'); tg.setAttribute('aria-expanded', a); };
    enlaces.forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.sec); document.getElementById(a.dataset.sec).scrollIntoView({ behavior: 'smooth' }); sb.classList.remove('open'); }));
    const marcar = () => { let mejor = 0, y = Infinity; secs.forEach((s, i) => { const d = Math.abs(s.getBoundingClientRect().top - 60); if (d < y) { y = d; mejor = i; } }); enlaces.forEach((a, i) => a.classList.toggle('activa', i === mejor)); $('#migas').textContent = enlaces[mejor].textContent.slice(1).trim(); };
    addEventListener('scroll', () => requestAnimationFrame(marcar), { passive: true }); marcar();
  }

  function buscador() {
    const box = $('#buscador'), inp = $('#buscadorInput'), lista = $('#buscadorLista'); let items = [], r = [], sel = 0, previo = null;
    function indexar() {
      items = [];
      document.querySelectorAll('#menu a').forEach(a => items.push({ t: a.textContent.slice(1).trim(), s: 'sección', go: () => a.click() }));
      document.querySelectorAll('.tile').forEach(t => { const sec = t.closest('.sec'); items.push({ t: t.querySelector('.l').textContent + ' · ' + t.querySelector('.v').textContent, s: sec ? sec.querySelector('h1').textContent : '', go: () => { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.animate([{ outline: '2px solid var(--accent)' }, { outline: '2px solid transparent' }], 1800); } }); });
      document.querySelectorAll('.card h3').forEach(h => items.push({ t: h.textContent, s: 'gráfico', go: () => h.scrollIntoView({ behavior: 'smooth', block: 'start' }) }));
      (window.MAPA && MAPA.lugares ? MAPA.lugares() : []).forEach(l => items.push({ t: l.nombre, s: l.tipo, go: () => MAPA.irA(l) }));
    }
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    function pintar(q) {
      q = norm(q); r = items.filter(i => norm(i.t).includes(q)).slice(0, 16); sel = 0;
      lista.innerHTML = r.map((i, k) => `<button type="button" role="option" id="bq-${k}" aria-selected="${k === 0}" class="${k === 0 ? 'sel' : ''}"><span>${G.esc(i.t)}</span><small>${G.esc(i.s)}</small></button>`).join('') || '<div style="padding:12px;color:var(--muted);font-size:13px">Sin resultados</div>';
      lista.querySelectorAll('button').forEach((b, k) => b.onclick = () => { cerrar(); r[k].go(); });
    }
    function mover(d) { sel = Math.max(0, Math.min(r.length - 1, sel + d)); lista.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('sel', k === sel); b.setAttribute('aria-selected', k === sel); }); const a = $('#bq-' + sel); a && a.scrollIntoView({ block: 'nearest' }); }
    function abrir() { previo = document.activeElement; indexar(); box.hidden = false; inp.value = ''; pintar(''); inp.focus(); }
    function cerrar() { box.hidden = true; previo && previo.focus && previo.focus(); }
    inp.addEventListener('input', () => pintar(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { mover(1); e.preventDefault(); } else if (e.key === 'ArrowUp') { mover(-1); e.preventDefault(); } else if (e.key === 'Enter') { const x = r[sel]; cerrar(); x && x.go(); } else if (e.key === 'Escape') cerrar(); });
    document.addEventListener('keydown', e => { const t = (e.target.tagName || '').toLowerCase(); const escr = ['input', 'textarea', 'select'].includes(t); if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !escr)) { e.preventDefault(); box.hidden ? abrir() : cerrar(); } });
    box.addEventListener('click', e => { if (e.target === box) cerrar(); });
    $('#btnBuscar').onclick = abrir;
  }

  function reloj() { const f = () => { $('#reloj').innerHTML = '<b>' + new Date().toLocaleString('es-CO', { timeZone: 'America/New_York', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</b> hora de NYC'; }; f(); setInterval(f, 30000); }

  async function clima() {
    const COD = { 0: 'despejado', 1: 'casi despejado', 2: 'parcialmente nublado', 3: 'nublado', 45: 'niebla', 48: 'niebla', 51: 'llovizna', 53: 'llovizna', 55: 'llovizna', 61: 'lluvia débil', 63: 'lluvia', 65: 'lluvia fuerte', 71: 'nieve', 73: 'nieve', 75: 'nevada fuerte', 80: 'chubascos', 81: 'chubascos', 82: 'chubascos fuertes', 95: 'tormenta' };
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7831&longitude=-73.9712&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=America%2FNew_York');
      const c = (await r.json()).current;
      $('#clima').innerHTML = `Central Park: <b>${Math.round(c.temperature_2m)} °C</b> · ${c.relative_humidity_2m} % HR · ${Math.round(c.wind_speed_10m)} km/h · ${COD[c.weather_code] || ''} <span title="F24 · Open-Meteo, CC BY 4.0">(F24)</span>`;
    } catch (_) { $('#clima').textContent = 'clima en vivo no disponible (sin conexión)'; }
  }

  function tema() {
    const raiz = document.documentElement; let t = null; try { t = localStorage.getItem('cerebro-tema'); } catch (_) { }
    if (t) raiz.dataset.theme = t;
    $('#btnTema').onclick = () => { const oscuro = raiz.dataset.theme ? raiz.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; raiz.dataset.theme = oscuro ? 'light' : 'dark'; try { localStorage.setItem('cerebro-tema', raiz.dataset.theme); } catch (_) { } window.MAPA && MAPA.tema && MAPA.tema(); };
  }

  function presentacion() {
    const secs = [...document.querySelectorAll('.sec')]; let i = 0;
    const ir = k => { i = Math.max(0, Math.min(secs.length - 1, k)); secs[i].scrollIntoView({ behavior: 'smooth' }); $('#presPos').textContent = `${i + 1}/${secs.length}`; };
    const entrar = () => { document.body.classList.add('presentando'); document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); ir(0); setTimeout(() => window.MAPA && MAPA.redimensionar && MAPA.redimensionar(), 400); };
    const salir = () => { document.body.classList.remove('presentando'); document.fullscreenElement && document.exitFullscreen(); setTimeout(() => window.MAPA && MAPA.redimensionar && MAPA.redimensionar(), 400); };
    $('#btnPresentar').onclick = entrar; $('#presSalir').onclick = salir; $('#presAnt').onclick = () => ir(i - 1); $('#presSig').onclick = () => ir(i + 1);
    document.addEventListener('keydown', e => { if (!document.body.classList.contains('presentando')) return; if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(i + 1); } if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(i - 1); } if (e.key === 'Escape') salir(); });
  }

  arrancar();
})();
