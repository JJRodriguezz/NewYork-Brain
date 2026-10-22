// Preguntas del sistema: cuáles responde (con la respuesta calculada desde el lago), cuáles a medias y cuáles quedan
// pendientes, y lo que el cerebro no sabe. Las preguntas se definen en ingesta/preguntas.py y viajan en el catálogo.
(function () {
  const $ = s => document.querySelector(s);
  const { fmt, esc } = G;
  const r = (a, b, D) => G.pearson(D.map(p => p[a]), D.map(p => p[b]));

  // respuesta corta de cada pregunta, calculada con el lago (si falta el dato, no se responde)
  const RESPUESTAS = {
    P1() {
      const g = DIAGNOSTICO.grupos('equilibrio')[0]; if (!g) return null;
      const nombres = g.miembros.map(m => LG.distritos().find(d => d.puma === m)).map(d => `${d.nombre} (${d.borough})`);
      return { texto: `Con prioridad equilibrio, el grupo de mayor atención —puestos ${DIAGNOSTICO.textoRango(g)}, indistinguibles entre sí dentro del margen de error— es: ${nombres.join('; ')}.`, prov: LG.unir('Índice de atención', ...Object.values(DIAGNOSTICO.DIM).map(d => LG.provMetrica(d.k))) };
    },
    P2() {
      const D = LG.distritos().filter(p => p.puma !== '4165'), B = LG.filas('demografia', 'boroughs');
      const m = [...B].sort((a, b) => b.pct_hogares_con_carga_alquiler - a.pct_hogares_con_carga_alquiler)[0];
      return { texto: `La carga del alquiler es mayor en ${m.borough} (${fmt.pct(m.pct_hogares_con_carga_alquiler)} ± ${fmt.n(m.pct_hogares_con_carga_alquiler_moe, 1)} de hogares inquilinos). Entre los 54 distritos residenciales, la vivienda asequible de HPD sí llega más a donde hay más pobreza (r = ${fmt.n(r('pct_pobreza', 'viviendas_asequibles_por_1000', D), 2)}), pero casi nada a donde más pesa el alquiler (r = ${fmt.n(r('pct_hogares_con_carga_alquiler', 'viviendas_asequibles_por_1000', D), 2)}).`,
        prov: LG.unir('Carga de alquiler y vivienda asequible', LG.provMetrica('pct_hogares_con_carga_alquiler'), LG.provMetrica('viviendas_asequibles_por_1000'), LG.provMetrica('pct_pobreza')) };
    },
    P3() {
      const v = LG.valor('seguridad_delitos', 'variacion_ene_jun'); if (v == null) return null;
      const H = LG.filas('seguridad_delitos', 'primer_semestre').sort((a, b) => a.variacion_pct - b.variacion_pct);
      return { texto: `${v < -1 ? 'Sí' : v < 0 ? 'Sí, apenas' : 'No'}: las denuncias de enero a junio de 2026 fueron ${fmt.signo(v)} frente a 2025. Bajaron más en ${H[0].borough} (${fmt.signo(H[0].variacion_pct)}) y ${H[H.length - 1].variacion_pct > 0 ? `subieron en ${H[H.length - 1].borough} (${fmt.signo(H[H.length - 1].variacion_pct)})` : 'bajaron en todos los boroughs'}.`, prov: LG.provCifra('seguridad_delitos', 'variacion_ene_jun') };
    },
    P4() {
      const V = LG.filas('seguridad_vial', 'boroughs').filter(x => x.borough !== 'No especificado').sort((a, b) => b.fallecidos - a.fallecidos);
      return { texto: `En 2025 murieron ${fmt.n(LG.valor('seguridad_vial', 'fallecidos_2025'))} personas en el tránsito; el ${fmt.n(LG.valor('seguridad_vial', 'pct_fallecidos_peatones'), 0)} % eran peatones. ${V[0].borough} tuvo más muertes (${V[0].fallecidos}).`, prov: LG.provCifra('seguridad_vial', 'pct_fallecidos_peatones') };
    },
    P5() {
      const s = LG.cifra('movilidad', 'subte_ultimo_mes'), v = LG.valor('movilidad', 'subte_variacion_anual'), c0 = LG.cifra('movilidad', 'congestion_primer_mes'), c1 = LG.cifra('movilidad', 'congestion_ultimo_mes'); if (!s) return null;
      return { texto: `El subte movió ${fmt.k(s.valor)} viajes diarios en ${s.vigencia} (${fmt.signo(v)} frente al mismo mes del año anterior). A la zona de congestión entraban ${fmt.k(c0.valor)} vehículos diarios en ${c0.vigencia} y ${fmt.k(c1.valor)} en ${c1.vigencia}. Describir no es atribuir: las series no prueban un efecto del peaje.`, prov: LG.unir('Movilidad', LG.provCifra('movilidad', 'subte_ultimo_mes'), LG.provCifra('movilidad', 'congestion_ultimo_mes')) };
    },
    P6() {
      const D = LG.distritos().filter(p => p.pm25 != null);
      return { texto: `El PM2,5 más alto está en el centro de Manhattan. Con estos datos, el aire no es peor donde hay más pobreza (r = ${fmt.n(r('pct_pobreza', 'pm25', D), 2)}) y el arbolado de calle tampoco sigue al ingreso (r = ${fmt.n(r('ingreso_mediano', 'arboles_calle_por_km2', D), 2)}).`, prov: LG.unir('Aire, arbolado e ingreso', LG.provMetrica('pm25'), LG.provMetrica('arboles_calle_por_km2'), LG.provMetrica('pct_pobreza')) };
    },
    P7() {
      const c = LG.cifra('escucha_interes', 'vistas_12_meses'); if (!c) return null;
      return { texto: `El artículo «New York City» sumó ${fmt.k(c.valor)} vistas hechas por personas (no bots) en ${c.vigencia}; el pico fue ${LG.valor('escucha_interes', 'mes_pico')}. Son vistas, no lectores únicos.`, prov: LG.provCifra('escucha_interes', 'vistas_12_meses') };
    },
    P8() { return { texto: `${fmt.n(LG.valor('demografia', 'poblacion_2020'))} habitantes en el Censo 2020, en 5 boroughs y 55 distritos (PUMA).`, prov: LG.provCifra('demografia', 'poblacion_2020') }; },
    P9() {
      const R = [...LG.filas('economia_rodajes', 'boroughs')].sort((a, b) => b.permisos - a.permisos); if (!R.length) return null;
      return { texto: `${fmt.n(LG.valor('economia_rodajes', 'permisos_2025'))} permisos de rodaje en 2025; ${R[0].borough} concentra el ${fmt.n(R[0].permisos / LG.valor('economia_rodajes', 'permisos_2025') * 100, 0)} %.`, prov: LG.provCifra('economia_rodajes', 'permisos_2025') };
    },
    G() { return { texto: `${LG.fuentes().length} fuentes catalogadas, todas probadas el ${LG.pruebaMasReciente()}; cada cifra abre su ficha con un clic.`, prov: null }; },
  };
  const ESTADO = { respondida: ['ok', 'Respondida'], parcial: ['med', 'A medias'], pendiente: ['mal', 'Pendiente'] };

  window.PREGUNTAS = {
    render() {
      const cat = LG.tema('catalogo'); if (!cat || !cat.preguntas) return;
      const P = cat.preguntas, n = e => P.filter(p => p.estado === e).length;
      $('#preguntasLead').innerHTML = `El sistema responde <b>${n('respondida')}</b> preguntas, <b>${n('parcial')}</b> a medias, y deja <b>${n('pendiente')}</b> escritas como pendientes, con la razón. Las preguntas P1 a P3 son las que el grupo escribió en la primera entrega. Cada respuesta se calcula con el lago al abrir la página; toca «ⓘ» para ver de dónde sale.`;
      const lista = $('#preguntasLista');
      lista.innerHTML = P.map(p => {
        const [c, t] = ESTADO[p.estado] || ['', p.estado];
        let resp = null; try { resp = RESPUESTAS[p.id] && RESPUESTAS[p.id](); } catch (e) { console.error(p.id, e); }
        return `<article class="pregunta-item ${p.estado}"><header><span class="mono">${esc(p.id)}</span><span class="pill ${c}">${t}</span>${p.entrega1 ? '<span class="pill">1.ª entrega</span>' : ''}</header>
          <h3>${esc(p.texto)}</h3>
          ${resp ? `<p class="respuesta">${esc(resp.texto)} ${resp.prov ? `<button type="button" class="enlace" data-p="${esc(p.id)}">ⓘ fuente</button>` : ''}</p>` : ''}
          <p class="limite"><b>${p.estado === 'pendiente' ? 'Por qué queda pendiente' : 'Límite'}:</b> ${esc(p.limite)}</p>
          ${p.seccion !== 'preguntas' ? `<a href="#${esc(p.seccion)}" class="ir">ver en el sistema →</a>` : ''}</article>`;
      }).join('');
      lista.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const x = RESPUESTAS[b.dataset.p](); G.ficha(x.prov, P.find(p => p.id === b.dataset.p).texto); });
      $('#huecos').innerHTML = `<h3>Lo que el cerebro no sabe, lo dice</h3><p class="nota">Quién vive en Nueva York y no aparece, o aparece mal, en las fuentes de este lago. El mapa no es el territorio: una decisión tomada solo con este sistema no ve a estas personas.</p><ul>${cat.huecos.map(h => `<li><b>${esc(h.quien)}.</b> ${esc(h.por_que)}</li>`).join('')}</ul>`;
    },
  };
})();
