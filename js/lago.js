// Acceso al lago con la forma del contrato (tema, probado, fuentes, cifras, series, listas) y procedencia de cada cifra.
// Ninguna vista escribe a mano una fuente, una unidad o una vigencia: todo sale de aquí.
(function () {
  const TIPO = {
    medido: { t: 'Medido', api: 'API', d: 'Sale de una API o descarga oficial; solo se contó, sumó o filtró.' },
    derivado: { t: 'Derivado', api: 'cálculo', d: 'Lo calculamos con cifras medidas (tasa, porcentaje, diferencia). La fórmula está abajo.' },
    transcrito: { t: 'Transcrito', api: 'tabla oficial', d: 'Copiado de una tabla oficial que no tiene API; el script comprueba que la página sigue en línea.' },
    declarado: { t: 'Declarado', api: 'comunicado', d: 'Lo afirma un comunicado oficial. No viene de una API y no se puede verificar con microdatos abiertos.' },
    proxy: { t: 'Proxy', api: 'aproximado', d: 'Aproxima algo que no se mide directamente. La descripción dice qué aproxima y qué no.' },
  };
  let L = { datos: {}, geo: {} }, CAT = {};
  const ids = f => (Array.isArray(f) ? f : [f]).filter(x => x && x !== 'cada fila');

  const LG = {
    TIPO,
    init(lago) { L = lago; CAT = Object.fromEntries((L.datos.catalogo?.fuentes || []).map(f => [f.id, f])); },
    get L() { return L; },
    tema: t => L.datos[t],
    lista: (t, l) => L.datos[t]?.listas?.[l],
    filas: (t, l) => L.datos[t]?.listas?.[l]?.filas || [],
    col: (t, l, c) => L.datos[t]?.listas?.[l]?.columnas?.[c],
    cifra: (t, k) => L.datos[t]?.cifras?.[k],
    valor: (t, k) => L.datos[t]?.cifras?.[k]?.valor,
    serie: (t, k) => L.datos[t]?.series?.[k],
    puntos: (t, k) => L.datos[t]?.series?.[k]?.puntos || [],
    fuente: id => CAT[id],
    fuentes: () => Object.values(CAT),
    ids,

    // procedencia: lo que se ve a un clic de cada cifra
    prov(obj, extra = {}) {
      if (!obj) return null;
      return { descripcion: obj.descripcion, tipo: obj.tipo, vigencia: obj.vigencia, unidad: obj.unidad, fuentes: ids(obj.fuente),
        formula: obj.formula || obj.transformacion, original: obj.original, moe: obj.moe, ...extra };
    },
    provCifra: (t, k, extra) => LG.prov(LG.cifra(t, k), extra),
    provSerie: (t, k, extra) => LG.prov(LG.serie(t, k), extra),
    provLista: (t, l, extra) => LG.prov(LG.lista(t, l), extra),
    provCol: (t, l, c, extra) => { const d = LG.col(t, l, c); return d ? LG.prov(d, extra) : null; },
    // varias piezas en una misma vista (p. ej. un gráfico que cruza dos fuentes)
    unir(titulo, ...provs) {
      const p = provs.filter(Boolean);
      return { descripcion: titulo, tipo: p.every(x => x.tipo === p[0].tipo) ? p[0].tipo : 'derivado', vigencia: [...new Set(p.map(x => x.vigencia))].join(' · '),
        fuentes: [...new Set(p.flatMap(x => x.fuentes))], formula: p.map(x => x.formula).filter(Boolean).join(' · '), partes: p };
    },

    // métricas del atlas: una sola definición, en lago/distritos.json
    distritos: () => LG.filas('distritos', 'distritos'),
    metrica: k => LG.col('distritos', 'distritos', k),
    metricas: () => Object.entries(LG.lista('distritos', 'distritos')?.columnas || {}).filter(([k, c]) => c.etiqueta && !k.endsWith('_moe') && k !== 'area_km2').map(([k, c]) => ({ k, ...c })),
    provMetrica: k => LG.provCol('distritos', 'distritos', k),
    moe: (fila, k) => { const c = LG.metrica(k); return c && c.moe && fila ? fila[c.moe] : null; },
    // regla del Census Bureau al 90 %: dos estimaciones difieren si |a − b| > √(MOEa² + MOEb²)
    distinguibles(a, ma, b, mb) { if (a == null || b == null) return null; return Math.abs(a - b) > Math.sqrt((ma || 0) ** 2 + (mb || 0) ** 2); },

    // fechas de prueba
    probado: id => CAT[id]?.probado,
    pruebaMasReciente() { return Object.values(CAT).map(f => f.probado).filter(Boolean).sort().pop(); },
    pruebaMasAntigua() { return Object.values(CAT).map(f => f.probado).filter(Boolean).sort()[0]; },
  };
  window.LG = LG;
})();
