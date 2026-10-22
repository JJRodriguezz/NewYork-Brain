"""Preguntas del sistema y huecos conocidos. Única definición: viaja en lago/catalogo.json y de ahí la leen el sitio
(sección «Preguntas») y el Excel (columna «Pregunta del sistema que ayuda a responder»).
P1–P3 son las tres preguntas escritas en la primera entrega (documento «Por qué estos datos»)."""

PREGUNTAS = [
    {'id': 'P1', 'texto': '¿Qué distrito concentra más carga de calidad de vida, inseguridad y siniestralidad por habitante?', 'estado': 'respondida', 'seccion': 'panorama', 'entrega1': True,
     'limite': 'Tasas por residente: donde hay mucha población de paso (Midtown) se inflan.'},
    {'id': 'P2', 'texto': '¿Dónde se cruza la presión del alquiler con bajo ingreso, y cuánta vivienda nueva y asequible llega allí?', 'estado': 'respondida', 'seccion': 'economia', 'entrega1': True,
     'limite': 'Mide lo que pagan los inquilinos actuales (ACS 2020–2024), no el precio de mudarse hoy (ver P10).'},
    {'id': 'P3', 'texto': '¿Está bajando el delito este año frente al anterior, y en qué borough?', 'estado': 'respondida', 'seccion': 'seguridad', 'entrega1': True,
     'limite': 'Compara denuncias del primer semestre; no todo delito se denuncia.'},
    {'id': 'P4', 'texto': '¿Quiénes son las víctimas del tránsito y en qué borough?', 'estado': 'respondida', 'seccion': 'seguridad', 'entrega1': False,
     'limite': 'Solo choques con herido, fallecido o daño > US$1.000.'},
    {'id': 'P5', 'texto': '¿Cuánto se ha recuperado el transporte público y qué cambió con el peaje de congestión?', 'estado': 'parcial', 'seccion': 'movilidad', 'entrega1': False,
     'limite': 'Describe las series antes y después del peaje; no permite atribuirle un efecto causal.'},
    {'id': 'P6', 'texto': '¿Dónde es peor el aire y hay menos árboles, y coincide con menor ingreso?', 'estado': 'parcial', 'seccion': 'ambiente', 'entrega1': False,
     'limite': 'El arbolado es del censo de 2015 (el de 2025 no se ha publicado) y el aire no trae margen de error.'},
    {'id': 'P7', 'texto': '¿Cuánto interés externo despierta la ciudad y cada borough?', 'estado': 'respondida', 'seccion': 'escucha', 'entrega1': False,
     'limite': 'Es un proxy de atención (vistas de Wikipedia), no de opinión.'},
    {'id': 'P8', 'texto': '¿Cuánta gente vive en cada territorio y cómo es? (base para todas las tasas)', 'estado': 'respondida', 'seccion': 'gente', 'entrega1': False,
     'limite': 'El ACS es una encuesta con margen de error; el Censo 2020 se transcribe porque su página no tiene API.'},
    {'id': 'P9', 'texto': '¿Dónde se concentra la actividad audiovisual y de eventos?', 'estado': 'respondida', 'seccion': 'turismo', 'entrega1': False,
     'limite': 'Cuenta permisos, no producciones ni empleo; el turismo total es una cifra declarada.'},
    {'id': 'P10', 'texto': '¿Cuánto le costaría a una familia mudarse hoy a ese distrito?', 'estado': 'pendiente', 'seccion': 'preguntas', 'entrega1': False,
     'limite': 'No hay alquiler de mercado actual como dato abierto oficial: los índices de StreetEasy o Zillow son privados y no revisamos sus términos.'},
    {'id': 'P11', 'texto': '¿Cómo se mueve el precio de la vivienda que se vende, por distrito?', 'estado': 'pendiente', 'seccion': 'preguntas', 'entrega1': False,
     'limite': 'ACRIS (F11) es candidata: cerca de 4 de cada 10 escrituras traen monto 0 y el 94 % aparece en Manhattan, una distribución que no supimos explicar.'},
    {'id': 'P12', 'texto': '¿Qué opinan los vecinos de su distrito?', 'estado': 'pendiente', 'seccion': 'preguntas', 'entrega1': False,
     'limite': 'No hay una fuente abierta de opinión por distrito; el 311 mide demanda de servicio y Wikipedia solo atención.'},
    {'id': 'P13', 'texto': '¿Cuánta gente está de verdad en cada distrito durante el día (trabajadores, turistas)?', 'estado': 'pendiente', 'seccion': 'preguntas', 'entrega1': False,
     'limite': 'Las tasas son por residente. Sin datos abiertos de población flotante, Midtown y el Distrito Financiero parecen peores de lo que son por persona presente.'},
    {'id': 'G', 'texto': '(gobernanza) ¿De dónde sale cada cifra y se puede confiar en ella?', 'estado': 'respondida', 'seccion': 'fuentes', 'entrega1': False,
     'limite': 'La confianza llega hasta la fuente: si la fuente se equivoca, el lago hereda el error (ver hallazgos de calidad).'},
]

HUECOS = [
    ('Personas sin hogar', 'Solo aparecen indirectamente, como solicitudes 311 por «Encampment». No hay conteo abierto por distrito en el lago.'),
    ('Inmigrantes sin documentos', 'El ACS los subcuenta; ninguna fuente del lago los identifica (y no debería).'),
    ('Delitos que no se denuncian', 'El lago mide denuncias. Una caída en las denuncias no prueba una caída en los delitos.'),
    ('Choques sin herido ni daño mayor', 'La fuente solo obliga a reportar choques con herido, fallecido o daño mayor a US$1.000.'),
    ('Quien no llama al 311', 'El 311 refleja quién sabe y quiere reportar: un distrito con menos quejas no es necesariamente un distrito con menos problemas.'),
    ('Población de paso', 'Trabajadores, estudiantes y turistas no cuentan como residentes: las tasas por habitante de Midtown se inflan.'),
    ('Árboles de parques y el estado actual del arbolado', 'El censo es de árboles de calle y de 2015.'),
]
