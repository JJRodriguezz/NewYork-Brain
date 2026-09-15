// Diagnóstico ejecutivo por zona: convierte las tres capas de infraestructura en una lectura comparable.
(function () {
  const $ = s => document.querySelector(s);
  const PERFIL = {
    equilibrio: { energia: 1, edificacion: 1, vial: 1 },
    infraestructura: { energia: 55, edificacion: 25, vial: 20 },
    inversion: { energia: 30, edificacion: 50, vial: 20 },
    movilidad: { energia: 20, edificacion: 20, vial: 60 },
  };
  const DIM = {
    energia: { score: 'score_energia', raw: 'demanda_kw_ha', nombre: 'demanda eléctrica', unidad: 'kW/ha', estado: 'observado', fuente: 'Con Edison · SED' },
    edificacion: { score: 'score_edificacion', raw: 'm2_construidos_ha', nombre: 'intensidad construida', unidad: 'm²/ha', estado: 'estimado', fuente: 'OSM · huella × pisos' },
    vial: { score: 'score_vial', raw: 'presion_vial_media', nombre: 'presión vial', unidad: '/100', estado: 'proxy', fuente: 'OSM + IMP/ATU' },
  };
  let LAGO, zonas = [], pesos = Object.assign({}, PERFIL.equilibrio), perfil = 'equilibrio';

  const esc = v => String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const fmt = (v, d = 1) => Number(v).toLocaleString('es-PE', { maximumFractionDigits: d });
  const mediana = vals => { const v = vals.map(Number).filter(Number.isFinite).sort((a, b) => a - b); const m = Math.floor(v.length / 2); return v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : 0; };
  const zona = id => zonas.find(z => String(z.zona) === String(id));
  const totalPesos = () => Object.values(pesos).reduce((a, b) => a + Number(b || 0), 0) || 1;
  const score = z => Object.entries(DIM).reduce((s, [k, d]) => s + Number(z[d.score] || 0) * Number(pesos[k] || 0), 0) / totalPesos();
  const ranking = () => [...zonas].sort((a, b) => score(b) - score(a));
  const delta = (v, m) => m ? (Number(v) / m - 1) * 100 : 0;
  const dir = d => Math.abs(d) < 4 ? 'en la mediana' : `${Math.abs(d).toLocaleString('es-PE', { maximumFractionDigits: 0 })} % ${d > 0 ? 'sobre' : 'bajo'} la mediana`;

  function opciones(sel, valor) {
    sel.innerHTML = zonas.map(z => `<option value="${esc(z.zona)}" ${String(z.zona) === String(valor) ? 'selected' : ''}>${esc(z.nombre)}</option>`).join('');
  }

  function barraComparacion(k, a, b) {
    const d = DIM[k], av = Number(a[d.score] || 0), bv = Number(b[d.score] || 0);
    return `<article class="diagnostico-compara-fila"><header><b>${d.nombre}</b><span><i class="pill ${d.estado}">${d.estado}</i> ${d.fuente}</span></header><div class="diagnostico-barra a" style="--w:${av}%"><span>${esc(a.nombre)}</span><i></i><strong>${fmt(a[d.raw], d.raw === 'm2_construidos_ha' ? 0 : 1)} ${d.unidad}</strong></div><div class="diagnostico-barra b" style="--w:${bv}%"><span>${esc(b.nombre)}</span><i></i><strong>${fmt(b[d.raw], d.raw === 'm2_construidos_ha' ? 0 : 1)} ${d.unidad}</strong></div></article>`;
  }

  function evidencia(k, a) {
    const d = DIM[k], m = mediana(zonas.map(z => z[d.raw])), de = delta(a[d.raw], m);
    return `<article><header><span>${d.nombre}</span><i class="pill ${d.estado}">${d.estado}</i></header><strong>${fmt(a[d.raw], d.raw === 'm2_construidos_ha' ? 0 : 1)} <small>${d.unidad}</small></strong><p>${dir(de)} de las 14 zonas.</p><footer>${d.fuente}</footer></article>`;
  }

  function lectura(a, puesto, sc) {
    const orden = Object.entries(DIM).sort(([, x], [, y]) => Number(a[y.score]) - Number(a[x.score]));
    const fuerte = orden[0][1], debil = orden[orden.length - 1][1];
    const e = delta(a.demanda_kw_ha, mediana(zonas.map(z => z.demanda_kw_ha)));
    const d = delta(a.m2_construidos_ha, mediana(zonas.map(z => z.m2_construidos_ha)));
    const v = delta(a.presion_vial_media, mediana(zonas.map(z => z.presion_vial_media)));
    const patron = sc >= 68 ? 'concentración urbana muy alta' : sc >= 50 ? 'intensidad urbana alta' : sc >= 32 ? 'intensidad intermedia' : 'intensidad relativa baja';
    return `<b>${a.nombre} presenta ${patron}</b> y ocupa el puesto ${puesto} de ${zonas.length} con las prioridades actuales. Su señal dominante es la ${fuerte.nombre}; la ${debil.nombre} tiene el menor peso territorial relativo. Frente a la mediana: electricidad ${dir(e)}, construcción ${dir(d)} y presión vial ${dir(v)}. <em>Esto orienta una revisión; no demuestra déficit, capacidad disponible ni causalidad.</em>`;
  }

  function render() {
    const sa = $('#diagnosticoZonaA'), sb = $('#diagnosticoZonaB'), root = $('#diagnosticoResultado');
    const a = zona(sa.value) || zonas[0], b = zona(sb.value) || zonas[1] || zonas[0];
    const ran = ranking(), puestoA = ran.findIndex(z => z.zona === a.zona) + 1, puestoB = ran.findIndex(z => z.zona === b.zona) + 1;
    const scA = score(a), scB = score(b), probado = LAGO.infraestructura.probado || '—';
    root.innerHTML = `<div class="diagnostico-resumen"><div><span>LECTURA EJECUTIVA · ${esc(a.nombre)}</span><h3>${fmt(scA, 1)}<small>/100</small></h3><p>${lectura(a, puestoA, scA)}</p></div><aside><span>POSICIÓN RELATIVA</span><strong>#${puestoA}</strong><small>de ${zonas.length} zonas · ${scA >= scB ? fmt(scA - scB, 1) + ' puntos sobre ' : fmt(scB - scA, 1) + ' puntos bajo '}${esc(b.nombre)}</small><button id="diagnosticoIrMapa" type="button">Ver ${esc(a.nombre)} en el mapa ↑</button></aside></div>
      <div class="diagnostico-evidencias">${Object.keys(DIM).map(k => evidencia(k, a)).join('')}</div>
      <section class="diagnostico-comparacion"><header><div><span>COMPARACIÓN DIRECTA</span><h3>${esc(a.nombre)} frente a ${esc(b.nombre)}</h3></div><p>Las barras usan valores normalizados 0–100; las etiquetas muestran los valores territoriales originales.</p></header><div>${Object.keys(DIM).map(k => barraComparacion(k, a, b)).join('')}</div><footer><span>${esc(a.nombre)} · #${puestoA} · ${fmt(scA, 1)}</span><span>${esc(b.nombre)} · #${puestoB} · ${fmt(scB, 1)}</span></footer></section>
      <section class="diagnostico-sensibilidad"><header><div><span>SENSIBILIDAD DEL ÍNDICE</span><h3>¿La conclusión cambia si cambia la prioridad?</h3></div><p>Los pesos se normalizan automáticamente. Son una decisión analítica, no un dato observado.</p></header><div class="diagnostico-pesos">${Object.entries(DIM).map(([k, d]) => `<label><span>${d.nombre}<b>${Math.round(pesos[k] / totalPesos() * 100)} %</b></span><input type="range" min="0" max="100" step="5" value="${pesos[k]}" data-peso="${k}" aria-label="Peso de ${d.nombre}"></label>`).join('')}</div><div class="diagnostico-ranking-mini">${ran.slice(0, 5).map((z, i) => `<button type="button" data-zona-rank="${z.zona}"><span>#${i + 1} ${esc(z.nombre)}</span><strong>${fmt(score(z), 1)}</strong><i style="--w:${score(z)}%"></i></button>`).join('')}</div></section>
      <footer class="diagnostico-metodo"><div><span class="pill observado">observado</span> Con Edison <span class="pill estimado">estimado</span> edificación OSM <span class="pill proxy">proxy</span> presión vial</div><p>Actualización del cruce: ${esc(probado)} · índice ponderado de tres dimensiones normalizadas entre las 14 zonas. No equivale a consumo eléctrico facturado, tráfico en tiempo real, riesgo ni capacidad remanente.</p><button id="diagnosticoCopiar" type="button">Copiar diagnóstico</button></footer>`;
    root.querySelectorAll('input[data-peso]').forEach(i => {
      i.addEventListener('input', () => { const b = i.closest('label').querySelector('b'); const prev = Object.assign({}, pesos, { [i.dataset.peso]: Number(i.value) }); const t = Object.values(prev).reduce((x, y) => x + y, 0) || 1; b.textContent = Math.round(Number(i.value) / t * 100) + ' %'; });
      i.addEventListener('change', () => { pesos[i.dataset.peso] = Number(i.value); perfil = ''; document.querySelectorAll('.diagnostico-presets button').forEach(b => b.classList.remove('on')); render(); });
    });
    root.querySelectorAll('[data-zona-rank]').forEach(btn => btn.onclick = () => { sa.value = btn.dataset.zonaRank; render(); root.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#diagnosticoIrMapa').onclick = () => irMapa(a);
    $('#diagnosticoCopiar').onclick = async e => {
      const t = `${a.nombre}: ${root.querySelector('.diagnostico-resumen p').innerText} Índice ${fmt(scA, 1)}/100, puesto ${puestoA} de ${zonas.length}. Fuente: Con Edison + OSM + IMP/ATU; cruce ${probado}.`;
      try { await navigator.clipboard.writeText(t); e.currentTarget.textContent = 'Diagnóstico copiado'; } catch (_) { e.currentTarget.textContent = 'No se pudo copiar'; }
    };
  }

  function irMapa(z) {
    document.getElementById('gemelo').scrollIntoView({ behavior: 'smooth' });
    const activar = () => { const lente = document.querySelector('#mapaLentes button[data-lente="cruce"]'); lente && lente.click(); setTimeout(() => window.MAPA && MAPA.irZonaIntensidad(z.zona), 420); };
    setTimeout(activar, 280);
  }

  function buscarLugar() {
    const inp = $('#diagnosticoLugar'), box = $('#diagnosticoLugares'), q = inp.value.trim();
    if (q.length < 2 || !window.MAPA || !MAPA.buscarLugares) { box.hidden = true; return []; }
    const hallados = MAPA.buscarLugares(q).slice(0, 6);
    box.innerHTML = hallados.length ? hallados.map((l, i) => `<button type="button" data-i="${i}"><span>${esc(l.nombre)}</span><small>${esc(l.tipo)}</small></button>`).join('') : '<p>El lugar aún no aparece en las capas cargadas. Prueba con un parque, estación o hito.</p>';
    box.hidden = false; box.querySelectorAll('button').forEach(b => b.onclick = () => { const l = hallados[Number(b.dataset.i)]; box.hidden = true; inp.value = l.nombre; MAPA.irA(l); });
    return hallados;
  }

  function init(lago) {
    LAGO = lago; zonas = ((lago.infraestructura && lago.infraestructura.listas && lago.infraestructura.listas.zonas) || []).map(z => Object.assign({}, z));
    if (!zonas.length || !$('#diagnosticoApp')) return;
    const sa = $('#diagnosticoZonaA'), sb = $('#diagnosticoZonaB'); opciones(sa, zonas[0].zona); opciones(sb, (zonas[1] || zonas[0]).zona);
    sa.addEventListener('change', render); sb.addEventListener('change', render);
    $('#diagnosticoIntercambiar').onclick = () => { const a = sa.value; sa.value = sb.value; sb.value = a; render(); };
    document.querySelectorAll('.diagnostico-presets button').forEach(b => b.onclick = () => { perfil = b.dataset.perfil; pesos = Object.assign({}, PERFIL[perfil]); document.querySelectorAll('.diagnostico-presets button').forEach(x => x.classList.toggle('on', x === b)); render(); });
    $('#diagnosticoLugar').addEventListener('input', buscarLugar);
    $('#diagnosticoLugar').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const h = buscarLugar(); if (h[0]) MAPA.irA(h[0]); } else if (e.key === 'Escape') $('#diagnosticoLugares').hidden = true; });
    $('#diagnosticoBuscarLugar').onclick = () => { const h = buscarLugar(); if (h[0]) { $('#diagnosticoLugares').hidden = true; MAPA.irA(h[0]); } };
    render();
  }

  window.DIAGNOSTICO = { init };
})();
