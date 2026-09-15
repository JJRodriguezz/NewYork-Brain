// Explorador de asociaciones entre los 43 distritos. Muestra valores originales,
// Pearson y Spearman; conserva la fuente de cada eje y evita lenguaje causal.
(function () {
  const $ = s => document.querySelector(s);
  const F = () => window.G.fmt;

  function pearson(xs, ys) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0));
    return den ? num / den : 0;
  }

  function fuerza(v) {
    const a = Math.abs(v);
    return a >= .8 ? 'muy fuerte' : a >= .6 ? 'fuerte' : a >= .4 ? 'moderada' : a >= .2 ? 'débil' : 'muy débil';
  }

  function fmt(v, m) {
    if (v == null) return '—';
    if (m.unidad === 'índice 0–1') return F().n(v, 3);
    if (m.unidad === '%') return F().n(v, 1) + ' %';
    return F().n(v, Math.abs(v) >= 100 ? 0 : 1);
  }

  function render(L, h) {
    const j = L.correlaciones;
    if (!j || !j.listas || !j.listas.metricas) return false;
    const metricas = j.listas.metricas;
    const filas = j.listas.distritos;
    const pares = j.listas.pares;
    const presets = j.listas.presets || [];
    const porId = Object.fromEntries(metricas.map(m => [m.id, m]));
    const fuentePorId = Object.fromEntries((j.fuentes || []).map(f => [f.id, f]));

    $('#correlacionesLead').innerHTML = `Cruza <b>${metricas.length} variables reales y trazables</b> de los 43 distritos de Nueva York: bienestar, demografía, servicios, economía, turismo, seguridad y capacidad municipal. El gráfico conserva los valores originales, calcula Pearson y Spearman sobre casos completos y resalta Manhattan. <b>Correlación no implica causalidad</b>: úsala para formular preguntas y detectar relaciones que merecen análisis.`;
    h.tiles(h.cont, j, ['metricas_n', 'pares_n', 'distritos_n']);

    const g = h.gcont;
    const explorer = window.G.card(g, 'Explorador de relaciones', 'elige dos variables · Manhattan en coral', { ancha: true });
    explorer.cuerpo.innerHTML = `
      <div class="corr-presets" aria-label="Lecturas sugeridas">${presets.map((p, i) => `<button type="button" data-preset="${i}" class="${i === 0 ? 'on' : ''}">${p.titulo}</button>`).join('')}</div>
      <div class="corr-controls">
        <label><span>Eje horizontal</span><select id="corrX">${metricas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}</select></label>
        <button type="button" id="corrSwap" class="corr-swap" aria-label="Intercambiar ejes" title="Intercambiar ejes">⇄</button>
        <label><span>Eje vertical</span><select id="corrY">${metricas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}</select></label>
        <div class="corr-metodo" role="group" aria-label="Método de correlación"><span>Método</span><button type="button" data-metodo="spearman" class="on" aria-pressed="true">Spearman</button><button type="button" data-metodo="pearson" aria-pressed="false">Pearson</button></div>
      </div>
      <div class="corr-stage">
        <aside class="corr-score" aria-live="polite"><span id="corrMetodo">RHO DE SPEARMAN</span><strong id="corrValor">—</strong><b id="corrFuerza">—</b><small id="corrN">—</small></aside>
        <div id="corrPlot" class="corr-plot"></div>
      </div>
      <div id="corrLectura" class="corr-lectura" aria-live="polite"></div>
      <div id="corrFuentes" class="corr-fuentes"></div>`;
    explorer.nota('Método: casos completos, sin imputación. Pearson mide relación lineal; Spearman mide relación monótona sobre rangos y resiste mejor los extremos. Las tasas por residente pueden sobrerrepresentar distritos con mucha población flotante.');
    explorer.fuente('Fuente: lago/correlaciones.json · variables oficiales de INEI, PNUD, MINEDU, SUSALUD, MININTER, MINCETUR y MEF; vigencia visible por eje.');

    const fuertes = window.G.card(g, 'Relaciones que abren preguntas', 'ordenadas por |Spearman| · fuentes distintas', { ancha: true });
    const elegibles = pares.filter(p => p.robusta && !p.misma_fuente).slice(0, 10);
    fuertes.cuerpo.innerHTML = `<div class="corr-lista">${elegibles.map((p, i) => `<button type="button" data-par="${i}"><span><b>${porId[p.x].corto}</b><i>${p.spearman > 0 ? '↗' : '↘'}</i><b>${porId[p.y].corto}</b></span><strong>${p.spearman > 0 ? '+' : ''}${p.spearman.toFixed(2)}</strong><small>Spearman · n=${p.n}</small></button>`).join('')}</div>`;
    fuertes.nota('Se omiten del listado las parejas que provienen de la misma fuente para reducir relaciones casi mecánicas —por ejemplo, IDH e ingreso o hospedajes y habitaciones—. Aun así, una asociación fuerte puede deberse a terceros factores.');

    const xSel = $('#corrX'), ySel = $('#corrY');
    let metodo = 'spearman';
    let presetActivo = 0;

    function buscarPar(x, y) {
      const p = pares.find(q => q.x === x && q.y === y) || pares.find(q => q.x === y && q.y === x);
      if (p) return p;
      const puntos = filas.filter(f => Number.isFinite(f[x]) && Number.isFinite(f[y]));
      return { n: puntos.length, pearson: pearson(puntos.map(f => f[x]), puntos.map(f => f[y])), spearman: 0, misma_fuente: porId[x].fuente === porId[y].fuente };
    }

    function dibujar(x, y) {
      const mx = porId[x], my = porId[y];
      const puntos = filas.filter(f => Number.isFinite(f[x]) && Number.isFinite(f[y]));
      const W = 980, H = 480, M = { l: 78, r: 28, t: 28, b: 66 };
      const xv = puntos.map(p => p[x]), yv = puntos.map(p => p[y]);
      let xmin = Math.min(...xv), xmax = Math.max(...xv), ymin = Math.min(...yv), ymax = Math.max(...yv);
      const xpad = (xmax - xmin || 1) * .07, ypad = (ymax - ymin || 1) * .09;
      xmin -= xpad; xmax += xpad; ymin -= ypad; ymax += ypad;
      const X = v => M.l + (v - xmin) / (xmax - xmin) * (W - M.l - M.r);
      const Y = v => H - M.b - (v - ymin) / (ymax - ymin) * (H - M.t - M.b);
      const ticks = 5;
      let rejilla = '';
      for (let i = 0; i <= ticks; i++) {
        const tx = xmin + (xmax - xmin) * i / ticks, ty = ymin + (ymax - ymin) * i / ticks;
        rejilla += `<line x1="${X(tx)}" x2="${X(tx)}" y1="${M.t}" y2="${H - M.b}" class="grid"/><text x="${X(tx)}" y="${H - M.b + 24}" text-anchor="middle">${fmt(tx, mx)}</text>`;
        rejilla += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(ty)}" y2="${Y(ty)}" class="grid"/><text x="${M.l - 10}" y="${Y(ty) + 4}" text-anchor="end">${fmt(ty, my)}</text>`;
      }
      const sx = xv.reduce((a, b) => a + b, 0), sy = yv.reduce((a, b) => a + b, 0);
      const xbar = sx / xv.length, ybar = sy / yv.length;
      const pendiente = xv.reduce((a, v, i) => a + (v - xbar) * (yv[i] - ybar), 0) / xv.reduce((a, v) => a + (v - xbar) ** 2, 0);
      const intercepto = ybar - pendiente * xbar;
      const y1 = intercepto + pendiente * xmin, y2 = intercepto + pendiente * xmax;
      const puntosSvg = puntos.map(p => {
        const mira = p.ubigeo === 'NY';
        const etiqueta = `${p.nombre}: ${mx.corto} ${fmt(p[x], mx)} · ${my.corto} ${fmt(p[y], my)}`;
        return `<g class="corr-punto ${mira ? 'mira' : ''}" tabindex="0" role="img" aria-label="${etiqueta}" data-nombre="${p.nombre}" data-x="${p[x]}" data-y="${p[y]}"><circle cx="${X(p[x])}" cy="${Y(p[y])}" r="${mira ? 8 : 5}"><title>${etiqueta}</title></circle>${mira ? `<text x="${X(p[x]) + 12}" y="${Y(p[y]) - 10}" class="mira-label">Manhattan</text>` : ''}</g>`;
      }).join('');
      const html = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dispersión de ${mx.nombre} y ${my.nombre} para ${puntos.length} distritos">
        ${rejilla}<line x1="${X(xmin)}" y1="${Y(y1)}" x2="${X(xmax)}" y2="${Y(y2)}" class="corr-tendencia"/>
        ${puntosSvg}
        <text x="${(M.l + W - M.r) / 2}" y="${H - 14}" text-anchor="middle" class="corr-axis">${mx.nombre} · ${mx.unidad}</text>
        <text x="18" y="${(M.t + H - M.b) / 2}" text-anchor="middle" transform="rotate(-90 18 ${(M.t + H - M.b) / 2})" class="corr-axis">${my.nombre} · ${my.unidad}</text>
      </svg>`;
      $('#corrPlot').innerHTML = html;
      $('#corrPlot').querySelectorAll('.corr-punto').forEach(n => {
        const mostrar = e => window.G.showTip(`${n.dataset.nombre}<br><b>${mx.corto}: ${fmt(Number(n.dataset.x), mx)}</b><br><b>${my.corto}: ${fmt(Number(n.dataset.y), my)}</b>`, e.clientX || innerWidth / 2, e.clientY || innerHeight / 2);
        n.addEventListener('mousemove', mostrar); n.addEventListener('focus', mostrar); n.addEventListener('mouseleave', window.G.hideTip); n.addEventListener('blur', window.G.hideTip);
      });
    }

    function actualizar() {
      const x = xSel.value, y = ySel.value;
      if (x === y) {
        const alternativa = metricas.find(m => m.id !== x);
        ySel.value = alternativa.id;
        return actualizar();
      }
      const mx = porId[x], my = porId[y], p = buscarPar(x, y), valor = p[metodo];
      $('#corrMetodo').textContent = metodo === 'spearman' ? 'RHO DE SPEARMAN' : 'R DE PEARSON';
      $('#corrValor').textContent = `${valor > 0 ? '+' : ''}${Number(valor).toFixed(2)}`;
      $('#corrValor').className = valor < 0 ? 'negativa' : 'positiva';
      $('#corrFuerza').textContent = `${fuerza(valor)} · ${valor < 0 ? 'inversa' : 'directa'}`;
      $('#corrN').textContent = `${p.n} distritos · ${metodo === 'spearman' ? 'rangos' : 'valores'}`;
      const actual = presets[presetActivo];
      const coincide = actual && ((actual.x === x && actual.y === y) || (actual.x === y && actual.y === x));
      const cautelas = [];
      if (p.misma_fuente) cautelas.push('Las dos variables provienen de la misma fuente; parte de la relación puede ser estructural o de construcción.');
      if (/Tasa derivada/.test(mx.nota) && /Tasa derivada/.test(my.nota)) cautelas.push('Ambos indicadores comparten población como denominador; eso puede intensificar la asociación.');
      $('#corrLectura').innerHTML = `<div><span>LECTURA</span><p>${coincide ? actual.lectura : `La asociación entre <b>${mx.corto}</b> y <b>${my.corto}</b> es ${fuerza(valor)} y ${valor < 0 ? 'se mueve en sentido inverso' : 'se mueve en el mismo sentido'}. Es una pista descriptiva; no demuestra que una variable cause la otra.`}</p></div>${cautelas.length ? `<aside><b>Precaución</b>${cautelas.join(' ')}</aside>` : ''}`;
      $('#corrFuentes').innerHTML = [mx, my].map((m, i) => { const f = fuentePorId[m.fuente] || {}; return `<article><span>EJE ${i ? 'Y' : 'X'} · ${m.grupo}</span><b>${m.nombre}</b><small>${m.unidad} · ${m.vigencia} · n=${m.cobertura}</small><p>${m.nota}</p><a href="${m.url}" target="_blank" rel="noopener">${f.nombre || m.fuente_nombre} ↗</a></article>`; }).join('');
      explorer.cuerpo.querySelectorAll('[data-preset]').forEach((b, i) => b.classList.toggle('on', coincide && i === presetActivo));
      dibujar(x, y);
    }

    explorer.cuerpo.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      presetActivo = Number(b.dataset.preset); const p = presets[presetActivo]; xSel.value = p.x; ySel.value = p.y; actualizar();
    });
    fuertes.cuerpo.querySelectorAll('[data-par]').forEach(b => b.onclick = () => {
      const p = elegibles[Number(b.dataset.par)]; presetActivo = -1; xSel.value = p.x; ySel.value = p.y; actualizar(); explorer.cuerpo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    xSel.onchange = () => { presetActivo = -1; actualizar(); };
    ySel.onchange = () => { presetActivo = -1; actualizar(); };
    $('#corrSwap').onclick = () => { const x = xSel.value; xSel.value = ySel.value; ySel.value = x; actualizar(); };
    explorer.cuerpo.querySelectorAll('[data-metodo]').forEach(b => b.onclick = () => {
      metodo = b.dataset.metodo; explorer.cuerpo.querySelectorAll('[data-metodo]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); actualizar();
    });

    const inicial = presets[0] || { x: 'pobreza_pct', y: 'idh' };
    xSel.value = inicial.x; ySel.value = inicial.y; actualizar();
    return true;
  }

  if (window.NARRATIVA) window.NARRATIVA.correlaciones = render;
})();
