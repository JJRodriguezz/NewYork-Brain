// Arranque: compuerta (servidor), carga del lago vía /api/datos, navegación, buscador, reloj/clima.
(function () {
  const $ = s => document.querySelector(s);
  const gate = $('#gate'), app = $('#app');
  window.LAGO = {};
  const ARCHIVOS = ['demografia', 'social', 'economia', 'turismo', 'seguridad', 'municipio', 'escucha', 'sensores', 'geo', 'geo_resumen', 'edificios', 'atlas_distritos', 'atlas_zonas', 'infraestructura', 'correlaciones', 'catalogo'];

  async function sesion() { try { const r = await fetch('/api/sesion', { cache: 'no-store' }); return true; } catch (_) { return false; } }
  async function datos(f) { const r = await fetch('./datos/' + f); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); }
  window.cargarGeo = async (nombre) => datos('geo/' + nombre + '.geojson');
  window.cargarTerritorio = async (nombre) => datos('territorio/' + nombre + '.geojson');

  async function arrancar() {
    app.hidden = false;
    const estado = $('#estadoDatos');
    const res = await Promise.allSettled(ARCHIVOS.map(a => datos(a + '.json').then(j => { LAGO[a] = j; })));
    const ok = res.filter(r => r.status === 'fulfilled').length;
    estado.textContent = `lago: ${ok}/${ARCHIVOS.length} temas`;
    const probados = Object.values(LAGO).map(j => j && j.probado).filter(Boolean).sort();
    $('#pieProbado').textContent = probados.length ? 'lago probado ' + probados[0] + (probados[probados.length - 1] !== probados[0] ? ' → ' + probados[probados.length - 1] : '') : '';
    try { window.SECCIONES && SECCIONES.render(LAGO); } catch (e) { console.error('secciones', e); }
    try { window.DIAGNOSTICO && DIAGNOSTICO.init(LAGO); } catch (e) { console.error('diagnostico', e); }
    try { window.MAPA && MAPA.init(LAGO); } catch (e) { console.error('mapa', e); }
    navegacion(); buscador(); reloj(); clima();
    if (location.hash) { const s = document.querySelector(location.hash); s && s.scrollIntoView(); }
    // QA sin ojos: ?solo=gemelo deja una sola sección visible para que la captura headless la tenga arriba
    const solo = new URLSearchParams(location.search).get('solo'); if (solo) document.querySelectorAll('.sec').forEach(s => { if (s.id !== solo) s.style.display = 'none'; });
  }

  // Compuerta
  $('#gateForm').addEventListener('submit', async e => {
    e.preventDefault(); const msg = $('#gateMsg'); msg.textContent = 'verificando…';
    try { const r = await fetch('/api/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave: $('#clave').value }) }); const j = await r.json(); if (r.ok && j.ok) { gate.hidden = true; arrancar(); } else msg.textContent = j.error || 'Clave incorrecta'; }
    catch (_) { msg.textContent = 'No se pudo contactar el servidor'; }
  });
  sesion().then(abierta => { if (abierta) arrancar(); else { gate.hidden = false; $('#clave').focus(); } });

  // Navegación: el resaltado se calcula por posición; menú y DOM deben coincidir (check en verificar.py)
  function navegacion() {
    const enlaces = [...document.querySelectorAll('#menu a')]; const secs = enlaces.map(a => document.getElementById(a.dataset.sec));
    enlaces.forEach(a => a.addEventListener('click', e => { e.preventDefault(); const s = document.getElementById(a.dataset.sec); history.replaceState(null, '', '#' + a.dataset.sec); s.scrollIntoView({ behavior: 'smooth' }); }));
    const io = new IntersectionObserver(() => { let mejor = 0, y = Infinity; secs.forEach((s, i) => { const d = Math.abs(s.getBoundingClientRect().top - 80); if (d < y) { y = d; mejor = i; } }); enlaces.forEach((a, i) => a.classList.toggle('activa', i === mejor)); $('#migas').textContent = enlaces[mejor].textContent.trim(); }, { threshold: [0, .25, .5, .75, 1] });
    secs.forEach(s => io.observe(s));
  }

  // Buscador ⌘K: secciones, cifras, lugares del mapa
  function buscador() {
    const box = $('#buscador'), inp = $('#buscadorInput'), lista = $('#buscadorLista'); let items = [], sel = 0, focoPrevio = null;
    function indexar() { items = []; document.querySelectorAll('#menu a').forEach(a => items.push({ t: a.textContent.trim(), s: 'sección', go: () => a.click() })); document.querySelectorAll('.tile').forEach(t => { const sec = t.closest('.sec'); items.push({ t: t.querySelector('.l').textContent + ' · ' + t.querySelector('.v').textContent, s: sec ? sec.querySelector('h1').textContent : '', go: () => { sec.scrollIntoView({ behavior: 'smooth' }); t.animate([{ outline: '2px solid #23b5a3' }, { outline: '2px solid transparent' }], 1600); } }); }); (window.MAPA && MAPA.lugares ? MAPA.lugares() : []).forEach(l => items.push({ t: l.nombre, s: l.tipo, go: () => MAPA.irA(l) })); }
    function abrir() { focoPrevio = document.activeElement; indexar(); box.hidden = false; inp.value = ''; pintar(''); inp.focus(); }
    function cerrar() { box.hidden = true; inp.removeAttribute('aria-activedescendant'); if (focoPrevio && focoPrevio.focus) focoPrevio.focus(); }
    function pintar(q) { q = q.toLowerCase(); const r = items.filter(i => i.t.toLowerCase().includes(q)).slice(0, 14); sel = 0; lista.innerHTML = r.map((i, k) => `<button type="button" role="option" id="busqueda-${k}" data-k="${k}" aria-selected="${k === 0}" class="${k === 0 ? 'sel' : ''}"><span>${i.t}</span><small>${i.s}</small></button>`).join(''); lista.querySelectorAll('button').forEach((d, k) => d.onclick = () => { r[k].go(); cerrar(); }); box._r = r; if (r.length) inp.setAttribute('aria-activedescendant', 'busqueda-0'); else inp.removeAttribute('aria-activedescendant'); }
    inp.addEventListener('input', () => pintar(inp.value));
    inp.addEventListener('keydown', e => { const r = box._r || []; if (e.key === 'ArrowDown') { sel = Math.min(r.length - 1, sel + 1); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); } else if (e.key === 'Enter') { r[sel] && r[sel].go(); cerrar(); return; } else if (e.key === 'Escape') { cerrar(); return; } else return; e.preventDefault(); lista.querySelectorAll('button').forEach((d, k) => { d.classList.toggle('sel', k === sel); d.setAttribute('aria-selected', String(k === sel)); }); inp.setAttribute('aria-activedescendant', 'busqueda-' + sel); const a = document.getElementById('busqueda-' + sel); a && a.scrollIntoView({ block: 'nearest' }); });
    document.addEventListener('keydown', e => { const tag = (e.target.tagName || '').toLowerCase(), escribiendo = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable; if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' || (e.key === '/' && !escribiendo)) { e.preventDefault(); box.hidden ? abrir() : cerrar(); } if (e.key === 'Escape' && !box.hidden) cerrar(); });
    $('#btnBuscar').addEventListener('click', abrir);
    document.addEventListener('click', e => { if (!box.hidden && !box.contains(e.target) && e.target !== $('#btnBuscar')) cerrar(); });
  }

  function reloj() { const r = $('#reloj'); const f = () => { r.textContent = new Date().toLocaleString('es-CL', { timeZone: 'America/New_York', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' PET'; }; f(); setInterval(f, 30000); }
  async function clima() { try { const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.7831&longitude=-73.9712&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=America/New_York'); const j = await r.json(); const c = j.current; $('#clima').textContent = `${Math.round(c.temperature_2m)} °C · ${c.relative_humidity_2m} % HR · ${Math.round(c.wind_speed_10m)} km/h`; window.CLIMA_VIVO = c; } catch (_) { } }
})();
