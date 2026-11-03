// Guía editorial de decisiones. No calcula cifras nuevas ni altera el índice.
(function () {
  const escenarios = {
    vivienda: {
      pregunta: '¿Dónde coinciden carga de alquiler y pobreza?',
      seccion: '#diagnostico',
      instruccion: 'Selecciona «Vivienda y pobreza», compara dos PUMA y examina los márgenes de error del ACS.',
      accion: 'Priorizar una evaluación territorial de necesidades de apoyo a vivienda antes de asignar recursos.',
      cautela: 'El ACS 2020–2024 describe hogares encuestados, no alquileres disponibles hoy.'
    },
    seguridad: {
      pregunta: '¿Dónde se concentra la carga de seguridad y tránsito?',
      seccion: '#seguridad',
      instruccion: 'Selecciona «Seguridad» en el diagnóstico y contrasta tasas por residente con volumen absoluto.',
      accion: 'Solicitar revisión de puntos críticos y validación con actores locales.',
      cautela: 'La población flotante puede distorsionar las tasas por residente, especialmente en Midtown.'
    },
    ambiente: {
      pregunta: '¿Qué zonas merecen una evaluación ambiental prioritaria?',
      seccion: '#ambiente',
      instruccion: 'Selecciona «Ambiente» y revisa PM2,5 junto a pobreza y vigencia del arbolado.',
      accion: 'Proponer monitoreo ambiental adicional antes de priorizar intervenciones.',
      cautela: 'El inventario de árboles es de 2015 y el indicador de aire no incluye margen de error publicado.'
    }
  };
  function render() {
    const selector = document.getElementById('preguntaDecision');
    const salida = document.getElementById('resultadoDecision');
    if (!selector || !salida) return;
    const e = escenarios[selector.value];
    salida.innerHTML = `<h3>${e.pregunta}</h3><p><strong>Cómo comprobarlo:</strong> ${e.instruccion}</p><p><strong>Decisión que permite explorar:</strong> ${e.accion}</p><p><strong>Límite de evidencia:</strong> ${e.cautela}</p><a href="${e.seccion}">Abrir evidencia relacionada</a>`;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('preguntaDecision');
    if (selector) { selector.addEventListener('change', render); render(); }
  });
})();
