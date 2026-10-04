"""Bitácora de la búsqueda con IA (hoja «3. Bitácora IA»). Regla: solo episodios que ocurrieron, con su comprobación.
Solo se registran episodios de los que hay evidencia (consultas re-ejecutables y resultados guardados en el lago).
La bitácora de la primera versión (Kiro) se retiró porque no fue posible comprobar sus episodios."""

GRUPO = {
    'ciudad': 'Nueva York (Ciudad de Nueva York, EE. UU.) · 5 boroughs, 55 distritos comunitarios (PUMA)',
    'integrantes': '[COMPLETAR con los nombres de los integrantes del grupo]',
    'repo': 'https://github.com/JJRodriguezz/NewYork-Brain (carpeta /lago; se reconstruye con scripts/construir_lago.py)',
}

C = 'Claude Code (Claude Opus 5.5)'


def B(herramienta, encargo, respuesta, comprobacion, resultado, fuente, aprendizaje):
    return dict(herramienta=herramienta, encargo=encargo, respuesta=respuesta, comprobacion=comprobacion, resultado=resultado, fuente=fuente, aprendizaje=aprendizaje)


BITACORA = [
    # ---- revisión 2026-10-04
    B(C, 'Auditar el lago v1: ¿las cifras de los JSON salen de verdad de las APIs citadas?',
      'Repitió las consultas documentadas en _meta y comparó resultado por resultado',
      'Colisiones 2024 y 311 de enero 2025 por borough coincidieron al dígito. Pero el ingreso "2024" atribuido al Contralor (PDF) era idéntico a la mediana del ACS 2020–2024: la fuente estaba mal atribuida.',
      'Correcto', 'F02, F03, F10', 'Re-ejecutar la consulta es la única forma de auditar un lago; y una coincidencia exacta con otra fuente delata una atribución equivocada.'),
    B(C, 'Obtener el ACS (ingreso, alquiler, pobreza) por borough desde una API sin llave',
      'Propuso la API oficial del Censo (api.census.gov)',
      'Sin llave respondió HTTP 302 hacia /data/missing_key.html. Buscamos un espejo abierto (Census Reporter, Northwestern University): declara la versión usada (ACS 2024, 5 años) y sus cifras coinciden con las que el prototipo había tomado de otra publicación (Manhattan US$103.931, Bronx US$48.676). Queda pendiente contrastarlas con la API oficial cuando tengamos llave.',
      'Parcial', 'F21, F10', 'Las condiciones de acceso cambian: la fuente primaria pasó a pedir registro. Un espejo académico sirve si se contrasta cifra por cifra.'),
    B(C, 'Conseguir la población 2020 por borough desde una API en lugar de transcribirla',
      'Ofreció el dataset "New York City Population by Borough, 1950 - 2040" (xywu-7bv9)',
      'Su columna 2020 dice 8.550.971 habitantes; el Censo 2020 publicado por el DCP dice 8.804.190. La columna es una proyección hecha en 2013.',
      'Incorrecto', 'F25, F09', 'Un nombre de columna ("_2020") no dice si el dato es medido o proyectado. Se descartó y se dejó la transcripción oficial.'),
    B(C, 'Contar las viviendas propuestas en obras nuevas radicadas en 2025 (DOB NOW)',
      'Primera consulta: sumó proposed_dwelling_units de todas las filas "New Building" de 2025: 562.235 viviendas',
      'La cifra era absurda (NYC produce unas 30.000 al año). Revisando las filas de mayor valor, la misma obra aparecía 7 veces (-P1, -P2, -S8, -Z1…). Contando solo la radicación inicial (-I1) quedan ~42.000.',
      'Incorrecto', 'F05', 'Una suma correcta sobre filas duplicadas es un error. Preguntarse si la magnitud es plausible es parte de la verificación.'),
    B(C, '¿El sistema legado de permisos del DOB sigue recibiendo trámites en 2025?',
      'Consultó DOB Permit Issuance con issuance_date ≥ 2025-01-01 y concluyó "0 permisos: dataset abandonado"',
      'Al ver filas de ejemplo, la fecha venía como texto "04/27/1998": el filtro comparaba texto con fecha. Con like "%/2025" aparecen 10.065 permisos. El sistema sí es legado, pero la conclusión era falsa.',
      'Incorrecto', 'F32', 'Antes de concluir "no hay datos", revisar el tipo del campo. Un 0 silencioso puede ser un error de consulta.'),
    B(C, 'Leer la licencia declarada en los metadatos de 20 datasets de NYC Open Data y Open NY',
      'Escribió un script que lee /api/views/{id}.json y extrae los campos license y attribution',
      'Ningún dataset trae license; todos traen attribution (la agencia). Se repitió con los 3 datasets de data.ny.gov (MTA): tampoco declaran licencia.',
      'Correcto', 'F02–F07, F11–F27', 'La regla «no supongan la licencia» se puede verificar con un script y queda reproducible.'),
    B(C, 'Asignar cada delito de 2025 a su distrito comunitario por coordenadas',
      'Consulta anual agrupada por latitud/longitud, paginada y ordenada',
      'Después de 20 minutos no terminaba. La misma agrupación por mes y sin $order tardó 1,5 s por mes. Además se verificó que las coordenadas no se escriben en el lago.',
      'Parcial', 'F04', 'El costo de una consulta depende de cómo se pide, no solo de cuántas filas hay. Ordenar un agregado grande es lo caro.'),
    B(C, 'Simplificar las geometrías oficiales para que el mapa pese poco',
      'Implementó Douglas-Peucker sobre cada anillo',
      'El GeoJSON de boroughs salió de 804 bytes: los polígonos habían desaparecido. Causa: en un anillo cerrado el primer y el último punto son iguales y el algoritmo lo colapsa. Se corrigió simplificando en dos mitades y se comprobó con punto-en-polígono (Times Square cae en el PUMA 4165).',
      'Incorrecto', 'F19, F20', 'Validar el tamaño y una prueba conocida después de cada transformación geométrica.'),
    B(C, 'Actualizar las cifras declaradas del sitio (visitantes y presupuesto municipal)',
      'Búsqueda web: 65 M visitantes en 2025 (NYC Tourism + Conventions, 24-mar-2026) y presupuesto FY2027 de US$125.800 M (Concejo, 30-jun-2026)',
      'Se abrieron los dos comunicados oficiales y las cifras coinciden. El sitio anterior usaba 2024 y FY2026.',
      'Correcto', 'F29, F30', 'Las cifras declaradas envejecen: se marcan como «declarado» con fecha para que se note cuándo revisarlas.'),
    B(C, 'Relacionar los 55 PUMA con los 59 distritos comunitarios para unir 311, árboles, aire y vivienda',
      'Propuso deducir los distritos del código PUMA (41xx Manhattan… 45xx Staten Island; 21 = CD 1&2, 65 = 5&6, 63 = 3&6)',
      'Se contrastó con los 55 nombres oficiales del ACS ("Community Districts 1 & 2", etc.): la regla acierta en todos.',
      'Correcto', 'F19, F10', 'Una regla inferida por la IA se acepta solo después de compararla con la lista oficial completa, no con un ejemplo.'),
]
