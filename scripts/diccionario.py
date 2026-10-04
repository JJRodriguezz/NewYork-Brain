"""Diccionario de datos del lago: una entrada por campo. El ejemplo y el rango NO se escriben a mano:
generar_entregables.py los calcula leyendo el lago real, y verificar_lago.py falla si aparece un campo sin documentar.

Ruta del campo: archivo + camino JSON. [] = elemento de lista, {borough} = clave dinámica con el nombre del borough.
Tupla: (id_fuente, nombre_original, significado, tipo, unidad, puede_vacio, clasificacion, transformacion, pregunta)
"""

PREGUNTAS = {
    'P1': '¿Qué distrito concentra más carga de calidad de vida, inseguridad y siniestralidad por habitante?',
    'P2': '¿Dónde se cruza la presión del alquiler con bajo ingreso, y cuánta vivienda nueva y asequible llega allí?',
    'P3': '¿Está bajando el delito este año frente al anterior, y en qué borough?',
    'P4': '¿Quiénes son las víctimas del tránsito y en qué borough?',
    'P5': '¿Cuánto se ha recuperado el transporte público y qué cambió con el peaje de congestión?',
    'P6': '¿Dónde es peor el aire y hay menos árboles, y coincide con menor ingreso?',
    'P7': '¿Cuánto interés externo despierta la ciudad y cada borough?',
    'P8': '¿Cuánta gente vive en cada territorio y cómo es? (base para normalizar todas las tasas)',
    'P9': '¿Dónde se concentra la actividad audiovisual y de eventos?',
    'G': '(gobernanza) ¿De dónde sale cada cifra y se puede confiar en ella?',
}

T, E, D, F, C, G = 'Texto', 'Entero', 'Decimal', 'Fecha', 'Código', 'Coordenada / geometría'
PUB, SEN = 'Pública', 'Sensible'

# --------------------------------------------------------------- indicadores ACS (se repiten en demografia y distritos)
ACS = {
    'poblacion_acs': ('F10', 'B01003_001E', 'Población total estimada por el ACS (promedio 2020–2024)', E, 'personas', 'No', PUB, 'Ninguna', 'P8'),
    'edad_mediana': ('F10', 'B01002_001E', 'Edad mediana de la población', D, 'años', 'No', PUB, 'Ninguna', 'P8'),
    'ingreso_mediano': ('F10', 'B19013_001E', 'Ingreso mediano anual del hogar', E, 'US$ de 2024', 'Sí', PUB, 'Ninguna', 'P2'),
    'ingreso_mediano_moe': ('F10', 'B19013_001M', 'Margen de error al 90 % del ingreso mediano', E, 'US$ de 2024', 'Sí', PUB, 'Ninguna', 'P2'),
    'alquiler_mediano': ('F10', 'B25064_001E', 'Alquiler bruto mediano mensual (renta + servicios)', E, 'US$/mes', 'Sí', PUB, 'Ninguna', 'P2'),
    'alquiler_mediano_moe': ('F10', 'B25064_001M', 'Margen de error al 90 % del alquiler mediano', E, 'US$/mes', 'Sí', PUB, 'Ninguna', 'P2'),
    'alquiler_pct_ingreso': ('F10', 'B25071_001E', 'Alquiler bruto mediano como porcentaje del ingreso del hogar', D, '%', 'Sí', PUB, 'Ninguna', 'P2'),
    'pct_hogares_con_carga_alquiler': ('F10', 'B25070_007E..010E / (001E − 011E)', 'Hogares inquilinos que pagan 30 % o más de su ingreso en alquiler', D, '%', 'Sí', PUB, 'Suma de los tramos ≥30 % dividida por los hogares con cálculo posible ×100, 1 decimal', 'P2'),
    'pct_pobreza': ('F10', 'B17001_002E / B17001_001E', 'Personas con ingreso bajo la línea de pobreza federal', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P2'),
    'pct_inquilinos': ('F10', 'B25003_003E / B25003_001E', 'Hogares que alquilan su vivienda', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P2'),
    'pct_transporte_publico': ('F10', 'B08301_010E / B08301_001E', 'Trabajadores que van al trabajo en transporte público', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P5'),
    'pct_teletrabajo': ('F10', 'B08301_021E / B08301_001E', 'Trabajadores que trabajan desde casa', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P5'),
    'pct_hogares_sin_auto': ('F10', 'B08201_002E / B08201_001E', 'Hogares sin vehículo disponible', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P5'),
    'pct_nacidos_extranjero': ('F10', 'B05002_013E / B05002_001E', 'Población nacida fuera de EE. UU.', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P8'),
    'pct_hispano': ('F10', 'B03002_012E / B03002_001E', 'Población hispana o latina (de cualquier raza)', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal. Dato agregado autodeclarado; nunca se usa a nivel de persona', 'P8'),
    'pct_blanco_nh': ('F10', 'B03002_003E / B03002_001E', 'Población blanca no hispana', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P8'),
    'pct_negro_nh': ('F10', 'B03002_004E / B03002_001E', 'Población negra o afroamericana no hispana', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P8'),
    'pct_asiatico_nh': ('F10', 'B03002_006E / B03002_001E', 'Población asiática no hispana', D, '%', 'Sí', PUB, 'Cociente ×100, 1 decimal', 'P8'),
}

BORO = ('borough', 'Nombre del borough (distrito) de NYC', T, 'nombre', 'No', PUB, 'Normalizado desde mayúsculas, códigos o nombres de condado', )


def boro(fid, orig='borough', preg='P1', otros=False):
    rango_nota = 'Incluye "No especificado"' if otros else 'Normalizado a 5 nombres'
    return (fid, orig, 'Borough (distrito) de NYC', T, 'nombre', 'No', PUB, rango_nota + ' (mayúsculas, códigos 1–5 y nombres de condado se unifican)', preg)


DIC = {}


def add(archivo, campos):
    for k, v in campos.items():
        DIC[(archivo, k)] = v


# --------------------------------------------------------------- metadatos comunes (_meta)
META = {
    '_meta.id_fuente': ('—', '(propio)', 'ID(s) de la fuente en la hoja Fuentes', C, 'código F##', 'No', PUB, 'Asignado por el equipo', 'G'),
    '_meta.tabla': ('—', '(propio)', 'Nombre lógico de la tabla', T, 'nombre', 'No', PUB, 'Asignado por el equipo', 'G'),
    '_meta.fecha_prueba': ('—', '(propio)', 'Día en que la API respondió al construir el lago', F, 'AAAA-MM-DD', 'No', PUB, 'Fecha del sistema al correr el script', 'G'),
    '_meta.conjunto_de_datos': ('—', 'name (metadatos del portal)', 'Nombre oficial del conjunto de datos', T, 'nombre', 'Sí', PUB, 'Copiado del portal', 'G'),
    '_meta.entidad': ('—', 'attribution', 'Entidad que publica', T, 'nombre', 'Sí', PUB, 'Copiado del portal', 'G'),
    '_meta.url_api': ('—', '(URL)', 'Endpoint exacto consultado', T, 'URL', 'Sí', PUB, 'Ninguna', 'G'),
    '_meta.consulta_soql': ('—', '(propio)', 'Consulta SoQL usada, para reproducir la cifra', T, 'texto', 'Sí', PUB, 'Ninguna', 'G'),
    '_meta.licencia': ('—', 'license (metadatos)', 'Licencia tal como la declara la fuente («no declara» si no trae)', T, 'texto', 'Sí', PUB, 'Copiada; si falta se escribe «no declara»', 'G'),
    '_meta.trae_personas': ('—', '(propio)', '¿La fuente original trae datos de personas?', 'Booleano', 'sí/no', 'Sí', PUB, 'Revisión del esquema de la fuente', 'G'),
    '_meta.campos_personales_excluidos[]': ('—', '(esquema de la fuente)', 'Campos personales que existen en la fuente y NO se descargan', T, 'nombre de campo', 'Sí', PUB, 'Lista de exclusión por minimización', 'G'),
    '_meta.cobertura': ('—', '(propio)', 'Cobertura geográfica', T, 'texto', 'Sí', PUB, 'Ninguna', 'G'),
    '_meta.periodo': ('—', '(propio)', 'Periodo que cubren los datos del archivo', T, 'texto', 'Sí', PUB, 'Ninguna', 'G'),
    '_meta.frecuencia_actualizacion': ('—', 'Update Frequency', 'Frecuencia de actualización de la fuente', T, 'texto', 'Sí', PUB, 'Copiada del portal', 'G'),
    '_meta.unidad': ('—', '(propio)', 'Unidad de los conteos del archivo', T, 'texto', 'Sí', PUB, 'Ninguna', 'G'),
    '_meta.nota': ('—', '(propio)', 'Decisiones de limpieza y advertencias de calidad', T, 'texto', 'Sí', PUB, 'Ninguna', 'G'),
}

# --------------------------------------------------------------- demografia.json
add('demografia.json', {
    'release_acs.id': ('F10', 'release.id', 'Versión del ACS usada', C, 'código', 'No', PUB, 'Ninguna', 'G'),
    'release_acs.name': ('F10', 'release.name', 'Nombre de la versión del ACS', T, 'texto', 'No', PUB, 'Ninguna', 'G'),
    'release_acs.years': ('F10', 'release.years', 'Años que promedia la estimación', T, 'AAAA-AAAA', 'No', PUB, 'Ninguna', 'G'),
    'poblacion_total_2020': ('F09', 'Total population 2020', 'Población total de NYC en el Censo 2020', E, 'personas', 'No', PUB, 'Suma de los 5 boroughs', 'P8'),
    'datos[].borough': boro('F09', 'Borough', 'P8'),
    'datos[].condado': ('F10', 'NAME', 'Condado equivalente al borough', T, 'nombre', 'No', PUB, 'Se quita el sufijo " County, NY"', 'P8'),
    'datos[].poblacion_2020': ('F09', 'Total population (Census 2020)', 'Población residente el 1-abr-2020', E, 'personas', 'No', PUB, 'Transcrita de la tabla oficial del DCP', 'P8'),
    'datos[].superficie_mi2': ('F20', 'shape_area', 'Superficie terrestre del borough', D, 'millas²', 'No', PUB, 'pies² ÷ 27.878.400, 2 decimales', 'P8'),
    'datos[].densidad_hab_mi2': ('F09, F20', '(derivado)', 'Habitantes por milla² de tierra', E, 'hab/mi²', 'No', PUB, 'poblacion_2020 ÷ superficie_mi2, redondeado', 'P1'),
    'datos[].estaciones_subte': ('F18', 'count(stop_name)', 'Paradas de subte (y SIR en Staten Island) en el dataset MTA', E, 'paradas', 'No', PUB, 'Conteo por borough', 'P5'),
    'datos[].estaciones_por_mi2': ('F18, F20', '(derivado)', 'Paradas por milla² de tierra', D, 'paradas/mi²', 'No', PUB, 'estaciones ÷ superficie, 2 decimales', 'P5'),
    **{'datos[].' + k: v for k, v in ACS.items()},
})

# --------------------------------------------------------------- distritos.json
add('distritos.json', {
    'datos[].puma': ('F19', 'puma', 'Código PUMA 2020 (4 dígitos; el 2.º es el borough)', C, 'código', 'No', PUB, 'Últimos 4 dígitos del GEOID 79500US36xxxx', 'P1'),
    'datos[].nombre': ('F10', 'NAME', 'Barrios que forman el distrito', T, 'nombre', 'No', PUB, 'Parte del nombre del PUMA después de "--"', 'P1'),
    'datos[].etiqueta': ('F10', 'NAME', 'Borough y distrito(s) comunitario(s)', T, 'nombre', 'No', PUB, 'Recorte del nombre del PUMA', 'P1'),
    'datos[].borough': boro('F19', 'puma (2.º dígito)'),
    'datos[].distritos_comunitarios[]': ('F19', '(derivado del nombre)', 'Distritos comunitarios DCP que componen el PUMA', C, 'código BCC', 'No', PUB, 'MN 1&2, MN 5&6, BX 1&2 y BX 3&6 comparten PUMA', 'P1'),
    'datos[].area_km2': ('F19', 'shape_area', 'Superficie del PUMA', D, 'km²', 'No', PUB, 'pies² × 0,0929 ÷ 10⁶, 2 decimales', 'P1'),
    'datos[].densidad_hab_km2': ('F10, F19', '(derivado)', 'Habitantes por km²', E, 'hab/km²', 'No', PUB, 'poblacion_acs ÷ area_km2', 'P1'),
    'datos[].solicitudes_311_por_1000': ('F03', 'count(*) por community_board', 'Solicitudes 311 de 2025 por cada 1.000 residentes', D, 'por 1.000 hab.', 'Sí', PUB, 'Conteo por CD sumado al PUMA ÷ poblacion_acs ×1.000', 'P1'),
    'datos[].delitos_por_1000': ('F04', 'count(*) por latitude/longitude', 'Denuncias de 2025 por cada 1.000 residentes', D, 'por 1.000 hab.', 'Sí', PUB, 'Coordenada → PUMA por punto en polígono; la coordenada se descarta', 'P1'),
    'datos[].delitos_graves_por_1000': ('F04', 'law_cat_cd = FELONY', 'Delitos graves (felony) de 2025 por cada 1.000 residentes', D, 'por 1.000 hab.', 'Sí', PUB, 'Igual que delitos_por_1000, solo FELONY', 'P1'),
    'datos[].heridos_transito_por_10000': ('F02', 'number_of_persons_injured', 'Personas heridas en choques de 2025 por cada 10.000 residentes', D, 'por 10.000 hab.', 'Sí', PUB, 'Choque → PUMA por coordenadas; suma de heridos', 'P4'),
    'datos[].peatones_heridos_por_10000': ('F02', 'number_of_pedestrians_injured', 'Peatones heridos en 2025 por cada 10.000 residentes', D, 'por 10.000 hab.', 'Sí', PUB, 'Igual que heridos_transito_por_10000', 'P4'),
    'datos[].arboles_calle_por_km2': ('F07, F19', 'count(tree_id) por cb_num', 'Árboles de calle (censo 2015) por km²', D, 'árboles/km²', 'Sí', PUB, 'Conteo por CD sumado al PUMA ÷ area_km2', 'P6'),
    'datos[].pm25': ('F15', 'data_value (Fine particles, Annual mean, CD)', 'Partículas finas PM2,5, media anual del último año', D, 'µg/m³', 'Sí', PUB, 'Promedio simple de los CD del PUMA', 'P6'),
    'datos[].no2': ('F15', 'data_value (Nitrogen dioxide, Annual mean, CD)', 'Dióxido de nitrógeno, media anual del último año', D, 'ppb', 'Sí', PUB, 'Promedio simple de los CD del PUMA', 'P6'),
    'datos[].viviendas_obra_nueva_por_1000': ('F05', 'sum(proposed_dwelling_units) solo -I1', 'Viviendas propuestas en obras nuevas radicadas en 2025, por 1.000 residentes', D, 'por 1.000 hab.', 'Sí', PUB, 'Solo radicación inicial (-I1) para no duplicar', 'P2'),
    'datos[].viviendas_asequibles_por_1000': ('F16', 'sum(all_counted_units)', 'Viviendas asequibles HPD acumuladas desde 2014 por 1.000 residentes', D, 'por 1.000 hab.', 'Sí', PUB, 'Conteo por CD sumado al PUMA ÷ poblacion_acs ×1.000', 'P2'),
    **{'datos[].' + k: v for k, v in ACS.items()},
})

# --------------------------------------------------------------- seguridad_vial.json
vial = lambda orig, sig, preg='P4': ('F02', orig, sig, E, 'personas', 'No', PUB, 'SUM por borough', preg)
add('seguridad_vial.json', {
    'total_colisiones': ('F02', 'count(collision_id)', 'Choques reportados en 2025', E, 'choques', 'No', PUB, 'Conteo', 'P4'),
    'recuperados_por_coordenadas': ('F02', '(derivado)', 'Choques sin borough que se ubicaron por coordenadas', E, 'choques', 'No', PUB, 'Punto en polígono contra F19', 'G'),
    'datos[].borough': boro('F02', otros=True, preg='P4'),
    'datos[].colisiones': ('F02', 'count(collision_id)', 'Choques reportados', E, 'choques', 'No', PUB, 'COUNT por borough', 'P4'),
    'datos[].heridos': vial('number_of_persons_injured', 'Personas heridas'),
    'datos[].fallecidos': vial('number_of_persons_killed', 'Personas fallecidas'),
    'datos[].peatones_heridos': vial('number_of_pedestrians_injured', 'Peatones heridos'),
    'datos[].peatones_fallecidos': vial('number_of_pedestrians_killed', 'Peatones fallecidos'),
    'datos[].ciclistas_heridos': vial('number_of_cyclist_injured', 'Ciclistas heridos'),
    'datos[].ciclistas_fallecidos': vial('number_of_cyclist_killed', 'Ciclistas fallecidos'),
    'datos[].ocupantes_heridos': vial('number_of_motorist_injured', 'Ocupantes de vehículos heridos'),
    'datos[].ocupantes_fallecidos': vial('number_of_motorist_killed', 'Ocupantes de vehículos fallecidos'),
    'datos[].heridos_por_100k': ('F02, F09', '(derivado)', 'Heridos por 100.000 habitantes', D, 'por 100.000 hab.', 'Sí', PUB, 'heridos ÷ poblacion_2020 ×10⁵ (vacío en "No especificado")', 'P4'),
    'datos[].fallecidos_por_100k': ('F02, F09', '(derivado)', 'Fallecidos por 100.000 habitantes', D, 'por 100.000 hab.', 'Sí', PUB, 'fallecidos ÷ poblacion_2020 ×10⁵', 'P4'),
    'serie_mensual[].mes': ('F02', 'crash_date', 'Mes del choque', F, 'AAAA-MM', 'No', PUB, 'Fecha truncada a mes', 'P4'),
    'serie_mensual[].colisiones': ('F02', 'count(collision_id)', 'Choques del mes', E, 'choques', 'No', PUB, 'COUNT por mes', 'P4'),
    'serie_mensual[].heridos': vial('number_of_persons_injured', 'Heridos del mes'),
    'serie_mensual[].fallecidos': vial('number_of_persons_killed', 'Fallecidos del mes'),
})

# --------------------------------------------------------------- calidad_de_vida_311.json
add('calidad_de_vida_311.json', {
    'total_2025': ('F03', 'count(*)', 'Solicitudes 311 recibidas en 2025', E, 'solicitudes', 'No', PUB, 'Suma de 12 consultas mensuales', 'P1'),
    'por_borough[].borough': boro('F03', otros=True),
    'por_borough[].solicitudes': ('F03', 'count(*)', 'Solicitudes del borough en 2025', E, 'solicitudes', 'No', PUB, 'COUNT por borough', 'P1'),
    'por_borough[].por_1000_hab': ('F03, F09', '(derivado)', 'Solicitudes por cada 1.000 habitantes', D, 'por 1.000 hab.', 'Sí', PUB, 'solicitudes ÷ poblacion_2020 ×1.000', 'P1'),
    'top_tipos[].tipo': ('F03', 'complaint_type', 'Tipo de solicitud', T, 'categoría', 'No', PUB, 'Tipos en MAYÚSCULAS pasados a tipo oración', 'P1'),
    'top_tipos[].solicitudes': ('F03', 'count(*)', 'Solicitudes de ese tipo en 2025', E, 'solicitudes', 'No', PUB, 'COUNT por tipo, 15 más frecuentes', 'P1'),
    'top_tipos_por_borough{borough}[].tipo': ('F03', 'complaint_type', 'Tipo de solicitud dentro del borough', T, 'categoría', 'No', PUB, 'Igual que top_tipos.tipo', 'P1'),
    'top_tipos_por_borough{borough}[].solicitudes': ('F03', 'count(*)', 'Solicitudes de ese tipo en el borough', E, 'solicitudes', 'No', PUB, '5 más frecuentes por borough', 'P1'),
    'serie_mensual[].mes': ('F03', 'created_date', 'Mes de creación de la solicitud', F, 'AAAA-MM', 'No', PUB, 'Una consulta por mes', 'P1'),
    'serie_mensual[].solicitudes': ('F03', 'count(*)', 'Solicitudes del mes', E, 'solicitudes', 'No', PUB, 'COUNT', 'P1'),
})

# --------------------------------------------------------------- seguridad_delitos.json
add('seguridad_delitos.json', {
    'total_2025': ('F04', 'count(*)', 'Denuncias con fecha de reporte en 2025', E, 'denuncias', 'No', PUB, 'COUNT', 'P3'),
    'datos[].borough': boro('F04', 'boro_nm', 'P3', otros=True),
    'datos[].denuncias': ('F04', 'count(*)', 'Denuncias de 2025', E, 'denuncias', 'No', PUB, 'COUNT por boro_nm', 'P3'),
    'datos[].graves': ('F04', "law_cat_cd = 'FELONY'", 'Delitos graves (felony)', E, 'denuncias', 'No', PUB, 'COUNT por categoría legal', 'P3'),
    'datos[].menos_graves': ('F04', "law_cat_cd = 'MISDEMEANOR'", 'Delitos menos graves (misdemeanor)', E, 'denuncias', 'No', PUB, 'COUNT por categoría legal', 'P3'),
    'datos[].infracciones': ('F04', "law_cat_cd = 'VIOLATION'", 'Infracciones (violation)', E, 'denuncias', 'No', PUB, 'COUNT por categoría legal', 'P3'),
    'datos[].por_1000_hab': ('F04, F09', '(derivado)', 'Denuncias por 1.000 habitantes', D, 'por 1.000 hab.', 'Sí', PUB, 'denuncias ÷ poblacion_2020 ×1.000', 'P1'),
    'datos[].graves_por_1000_hab': ('F04, F09', '(derivado)', 'Delitos graves por 1.000 habitantes', D, 'por 1.000 hab.', 'Sí', PUB, 'graves ÷ poblacion_2020 ×1.000', 'P1'),
    'top_ofensas_por_borough{borough}[].ofensa': ('F04', 'ofns_desc', 'Descripción de la ofensa', T, 'categoría NYPD', 'No', PUB, 'Pasada a tipo título; 5 más frecuentes', 'P3'),
    'top_ofensas_por_borough{borough}[].denuncias': ('F04', 'count(*)', 'Denuncias de esa ofensa en el borough', E, 'denuncias', 'No', PUB, 'COUNT por boro_nm y ofns_desc', 'P3'),
    'primer_semestre.disponible_hasta': ('F14', 'max(rpt_dt)', 'Última fecha de reporte publicada en el dataset del año en curso', F, 'AAAA-MM-DD', 'No', PUB, 'Fecha truncada a día', 'P3'),
    'primer_semestre.datos[].borough': boro('F04, F14', 'boro_nm', 'P3'),
    'primer_semestre.datos[].denuncias_2025': ('F04', 'count(*)', 'Denuncias enero–junio 2025', E, 'denuncias', 'No', PUB, 'COUNT por rpt_dt', 'P3'),
    'primer_semestre.datos[].denuncias_2026': ('F14', 'count(*)', 'Denuncias enero–junio 2026', E, 'denuncias', 'No', PUB, 'COUNT por rpt_dt', 'P3'),
    'primer_semestre.datos[].variacion_pct': ('F04, F14', '(derivado)', 'Cambio porcentual 2026 frente a 2025', D, '%', 'Sí', PUB, '(2026 ÷ 2025 − 1) ×100', 'P3'),
})

# --------------------------------------------------------------- vivienda.json
add('vivienda.json', {
    'obra_nueva_2025[].borough': boro('F05', 'borough', 'P2'),
    'obra_nueva_2025[].solicitudes_obra_nueva': ('F05', "count(*) job_type='New Building' -I1", 'Obras nuevas radicadas en 2025', E, 'obras', 'No', PUB, 'Solo radicación inicial (-I1)', 'P2'),
    'obra_nueva_2025[].viviendas_propuestas': ('F05', 'sum(proposed_dwelling_units)', 'Viviendas propuestas en esas obras', E, 'viviendas', 'No', PUB, 'Texto convertido a número (::number) y sumado', 'P2'),
    'obra_nueva_2025[].viviendas_por_1000_hab': ('F05, F09', '(derivado)', 'Viviendas propuestas por 1.000 habitantes', D, 'por 1.000 hab.', 'No', PUB, '÷ poblacion_2020 ×1.000', 'P2'),
    'filas_sin_filtrar_2025.filas': ('F05', 'count(*)', 'Filas de obra nueva en 2025 sin depurar trámites repetidos', E, 'filas', 'No', PUB, 'Se guarda para documentar el problema de calidad', 'G'),
    'filas_sin_filtrar_2025.viviendas': ('F05', 'sum(proposed_dwelling_units)', 'Viviendas que suman esas filas (inflado)', E, 'viviendas', 'No', PUB, 'Se guarda para documentar el problema de calidad', 'G'),
    'asequible_hpd[].borough': boro('F16', 'borough', 'P2'),
    'asequible_hpd[].viviendas_asequibles': ('F16', 'sum(all_counted_units)', 'Viviendas asequibles contadas por HPD desde 2014', E, 'viviendas', 'No', PUB, 'SUM por borough', 'P2'),
    'asequible_hpd[].ingreso_extremadamente_bajo': ('F16', 'extremely_low_income_units', 'Unidades para hogares ≤30 % del AMI', E, 'viviendas', 'No', PUB, 'SUM', 'P2'),
    'asequible_hpd[].ingreso_muy_bajo': ('F16', 'very_low_income_units', 'Unidades para hogares 31–50 % del AMI', E, 'viviendas', 'No', PUB, 'SUM', 'P2'),
    'asequible_hpd[].ingreso_bajo': ('F16', 'low_income_units', 'Unidades para hogares 51–80 % del AMI', E, 'viviendas', 'No', PUB, 'SUM', 'P2'),
    'asequible_hpd[].ingreso_moderado': ('F16', 'moderate_income_units', 'Unidades para hogares 81–120 % del AMI', E, 'viviendas', 'No', PUB, 'SUM', 'P2'),
    'asequible_hpd[].ingreso_medio': ('F16', 'middle_income_units', 'Unidades para hogares 121–165 % del AMI', E, 'viviendas', 'No', PUB, 'SUM', 'P2'),
    'asequible_por_anio_inicio[].anio': ('F16', 'project_start_date', 'Año de inicio del proyecto', E, 'año', 'No', PUB, 'date_extract_y', 'P2'),
    'asequible_por_anio_inicio[].viviendas': ('F16', 'sum(all_counted_units)', 'Viviendas asequibles iniciadas ese año', E, 'viviendas', 'No', PUB, 'SUM por año', 'P2'),
})

# --------------------------------------------------------------- economia_rodajes.json
add('economia_rodajes.json', {
    'por_borough[].borough': boro('F06', 'borough', 'P9'),
    'por_borough[].permisos': ('F06', 'count(*)', 'Permisos de rodaje/evento con inicio en 2025', E, 'permisos', 'No', PUB, 'COUNT; filas con borough inválido excluidas', 'P9'),
    'por_categoria[].categoria': ('F06', 'category', 'Categoría del permiso (TV, cine, publicidad…)', T, 'categoría', 'No', PUB, 'Ninguna', 'P9'),
    'por_categoria[].permisos': ('F06', 'count(*)', 'Permisos de esa categoría', E, 'permisos', 'No', PUB, 'COUNT', 'P9'),
    'serie_mensual[].mes': ('F06', 'startdatetime', 'Mes de inicio del permiso', F, 'AAAA-MM', 'No', PUB, 'date_trunc_ym', 'P9'),
    'serie_mensual[].permisos': ('F06', 'count(*)', 'Permisos del mes', E, 'permisos', 'No', PUB, 'COUNT', 'P9'),
    'filas_descartadas_por_codificacion[].valor_borough': ('F06', 'borough', 'Valor inválido encontrado en el campo borough', T, 'texto', 'No', PUB, 'Se documenta, no se suma', 'G'),
    'filas_descartadas_por_codificacion[].conteo': ('F06', 'count(*)', 'Filas con ese valor inválido', E, 'filas', 'No', PUB, 'COUNT', 'G'),
})

# --------------------------------------------------------------- ambiente.json
add('ambiente.json', {
    'arboles_por_borough[].borough': boro('F07', 'boroname', 'P6'),
    'arboles_por_borough[].arboles': ('F07', 'count(tree_id)', 'Árboles de calle censados en 2015 (incluye tocones y muertos)', E, 'árboles', 'No', PUB, 'COUNT por boroname', 'P6'),
    'arboles_por_borough[].buena': ('F07', "health = 'Good'", 'Árboles en buen estado', E, 'árboles', 'No', PUB, 'COUNT', 'P6'),
    'arboles_por_borough[].regular': ('F07', "health = 'Fair'", 'Árboles en estado regular', E, 'árboles', 'No', PUB, 'COUNT', 'P6'),
    'arboles_por_borough[].mala': ('F07', "health = 'Poor'", 'Árboles en mal estado', E, 'árboles', 'No', PUB, 'COUNT', 'P6'),
    'arboles_por_borough[].sin_registro': ('F07', 'health IS NULL', 'Tocones o árboles muertos (sin estado de salud)', E, 'árboles', 'No', PUB, 'Nulos renombrados', 'P6'),
    'arboles_por_borough[].arboles_por_km2': ('F07, F20', '(derivado)', 'Árboles de calle por km² de tierra', D, 'árboles/km²', 'No', PUB, 'arboles ÷ (superficie mi² × 2,59)', 'P6'),
    'aire_ultimo_anio': ('F15', 'max(time_period)', 'Último año con datos de aire', C, 'AAAA', 'No', PUB, 'Ninguna', 'P6'),
    'aire_serie[].lugar': ('F15', 'geo_place_name', 'Ciudad o borough de la medición', T, 'nombre', 'No', PUB, 'Citywide → "Ciudad"', 'P6'),
    'aire_serie[].anio': ('F15', 'time_period', 'Año de la medición', E, 'año', 'No', PUB, 'Solo periodos anuales', 'P6'),
    'aire_serie[].pm25': ('F15', 'data_value (Fine particles PM 2.5)', 'PM2,5, media anual', D, 'µg/m³', 'Sí', PUB, 'Filtro measure = Annual mean, 2 decimales', 'P6'),
    'aire_serie[].no2': ('F15', 'data_value (Nitrogen dioxide NO2)', 'NO₂, media anual', D, 'ppb', 'Sí', PUB, 'Filtro measure = Annual mean, 2 decimales', 'P6'),
})

# --------------------------------------------------------------- escucha_interes.json
add('escucha_interes.json', {
    'series[].articulo': ('F08', 'project + article', 'Artículo de Wikipedia medido (idioma:título)', C, 'idioma:título', 'No', PUB, 'Ninguna', 'P7'),
    'series[].etiqueta': ('F08', '(propio)', 'Nombre legible del artículo', T, 'nombre', 'No', PUB, 'Ninguna', 'P7'),
    'series[].puntos[].mes': ('F08', 'timestamp', 'Mes de la medición', F, 'AAAA-MM', 'No', PUB, 'AAAAMMDDHH → AAAA-MM', 'P7'),
    'series[].puntos[].vistas': ('F08', 'views', 'Vistas del artículo hechas por personas en el mes', E, 'vistas', 'No', PUB, "Agente 'user' (sin bots)", 'P7'),
})

# --------------------------------------------------------------- movilidad.json
mta = lambda modo, sig: ('F17', f"sum(count) mode='{modo}'", sig, E, 'viajes/día', 'Sí', PUB, 'Suma del mes ÷ días con dato', 'P5')
add('movilidad.json', {
    'serie_mensual[].mes': ('F17', 'date', 'Mes', F, 'AAAA-MM', 'No', PUB, 'date_trunc_ym', 'P5'),
    'serie_mensual[].subte': mta('Subway', 'Viajes diarios promedio en subte'),
    'serie_mensual[].bus': mta('Bus', 'Viajes diarios promedio en bus'),
    'serie_mensual[].lirr': mta('LIRR', 'Viajes diarios promedio en Long Island Rail Road'),
    'serie_mensual[].metro_north': mta('MNR', 'Viajes diarios promedio en Metro-North'),
    'serie_mensual[].ferrocarril_staten': mta('SIR', 'Viajes diarios promedio en el ferrocarril de Staten Island'),
    'serie_mensual[].puentes_tuneles': mta('BT', 'Cruces diarios promedio por puentes y túneles de la MTA'),
    'serie_mensual[].ingresos_zona_congestion': mta('CRZ Entries', 'Vehículos diarios que entran a la zona de cobro por congestión'),
    'serie_mensual[].ingresos_cbd': mta('CBD Entries', 'Vehículos diarios que entran al distrito central de negocios'),
    'serie_mensual[].access_a_ride': mta('AAR', 'Viajes diarios de Access-A-Ride (paratránsito)'),
    'estaciones.filas_dataset': ('F18', 'count(*)', 'Filas del dataset de estaciones (estación-línea)', E, 'filas', 'No', PUB, 'COUNT', 'P5'),
    'estaciones.por_borough{borough}': ('F18', 'count(*) por borough', 'Paradas por borough', E, 'paradas', 'No', PUB, 'Códigos M/Bx/Bk/Q/SI → nombre', 'P5'),
    'estaciones.complejos_por_borough{borough}': ('F18', 'count(distinct complex_id)', 'Complejos de estaciones por borough', E, 'complejos', 'No', PUB, 'Conteo de complex_id distintos', 'P5'),
})

# --------------------------------------------------------------- catalogo.json (espejo de la hoja Fuentes)
CAT = {'id': 'ID fuente', 'nombre': 'Nombre del conjunto', 'entidad': 'Entidad', 'tipo_publicador': 'Tipo de publicador', 'url': 'URL exacta', 'formato': 'Formato',
       'como_se_obtiene': 'Cómo se obtiene', 'licencia': 'Licencia tal como aparece', 'personas': '¿Trae datos de personas?', 'cobertura': 'Cobertura', 'periodo': 'Periodo',
       'frecuencia': 'Frecuencia', 'fecha_prueba': 'Fecha en que se probó', 'estado': 'Estado', 'como_la_encontraron': 'Cómo se encontró', 'observaciones': 'Observaciones', 'lago': 'Archivo(s) del lago que alimenta'}
add('catalogo.json', {f'fuentes[].{k}': ('—', '(propio)', v + ' (mismo contenido que la hoja «1. Fuentes»)', F if k == 'fecha_prueba' else T, 'texto', 'No', PUB, 'Generado desde scripts/catalogo.py', 'G') for k, v in CAT.items()})

# --------------------------------------------------------------- verificaciones.json
add('verificaciones.json', {
    'resultados.F11_acris[].recorded_borough': ('F11', 'recorded_borough', 'Borough codificado 1–5 de la escritura', C, 'código', 'No', PUB, 'Sin transformar', 'G'),
    'resultados.F11_acris[].n': ('F11', 'count(*)', 'Escrituras (DEED) registradas en 2025', E, 'documentos', 'No', PUB, 'COUNT', 'G'),
    'resultados.F11_acris[].con_monto': ('F11', 'document_amt > 0', 'Escrituras con monto mayor que cero', E, 'documentos', 'No', PUB, 'CASE + SUM', 'G'),
    'resultados.F12_calls[].n': ('F12', 'count(*)', 'Filas del dataset de llamadas (prueba de vida)', E, 'filas', 'No', PUB, 'COUNT', 'G'),
    'resultados.F21_census_api.status': ('F21', '(respuesta HTTP)', 'Código HTTP de la API del Censo sin llave', E, 'código HTTP', 'No', PUB, 'Ninguna', 'G'),
    'resultados.F21_census_api.location': ('F21', 'Location', 'Redirección que devuelve la API sin llave', T, 'URL', 'Sí', PUB, 'Ninguna', 'G'),
    'resultados.F22_mta_viejo[].ultima': ('F22', 'max(date)', 'Última fecha del dataset viejo de la MTA', F, 'fecha', 'No', PUB, 'Ninguna', 'G'),
    'resultados.F23_dob_bis[].n': ('F23', 'count(*)', "Radicaciones de 2025 en el sistema legado (filtro de texto '%/2025')", E, 'filas', 'No', PUB, 'COUNT', 'G'),
    'resultados.F32_dob_permisos[].n': ('F32', 'count(*)', "Permisos de 2025 en el sistema legado (filtro de texto '%/2025')", E, 'filas', 'No', PUB, 'COUNT', 'G'),
    'resultados.F25_pob_proyeccion[].borough': ('F25', 'borough', 'Borough tal como viene (con espacios a la izquierda)', T, 'texto', 'No', PUB, 'Sin transformar, a propósito', 'G'),
    'resultados.F25_pob_proyeccion[]._2020': ('F25', '_2020', 'Valor de la columna 2020 (proyección de 2013, no Censo)', T, 'personas (texto)', 'No', PUB, 'Sin transformar', 'G'),
})

# --------------------------------------------------------------- geo/*.geojson
GEO = {
    ('geo/boroughs.geojson', 'features[].properties.borough'): boro('F20', 'boroname', 'P8'),
    ('geo/boroughs.geojson', 'features[].properties.codigo'): ('F20', 'borocode', 'Código DCP del borough (1 Manhattan … 5 Staten Island)', C, 'código', 'No', PUB, 'Texto → entero', 'P8'),
    ('geo/boroughs.geojson', 'features[].properties.area_mi2'): ('F20', 'shape_area', 'Superficie terrestre', D, 'millas²', 'No', PUB, 'pies² → mi²', 'P8'),
    ('geo/boroughs.geojson', 'features[].geometry'): ('F20', 'the_geom', 'Polígono del borough', G, 'WGS84 lon/lat', 'No', PUB, 'Douglas-Peucker ~25 m, 5 decimales', 'P8'),
    ('geo/distritos_puma.geojson', 'features[].properties.puma'): ('F19', 'puma', 'Código PUMA', C, 'código', 'No', PUB, 'Ninguna', 'P1'),
    ('geo/distritos_puma.geojson', 'features[].properties.area_km2'): ('F19', 'shape_area', 'Superficie del PUMA', D, 'km²', 'No', PUB, 'pies² → km²', 'P1'),
    ('geo/distritos_puma.geojson', 'features[].properties.nombre'): ('F10', 'NAME', 'Barrios del distrito', T, 'nombre', 'No', PUB, 'Unido desde el ACS por código', 'P1'),
    ('geo/distritos_puma.geojson', 'features[].properties.etiqueta'): ('F10', 'NAME', 'Borough y distrito comunitario', T, 'nombre', 'No', PUB, 'Unido desde el ACS', 'P1'),
    ('geo/distritos_puma.geojson', 'features[].properties.borough'): boro('F19', 'puma'),
    ('geo/distritos_puma.geojson', 'features[].geometry'): ('F19', 'the_geom', 'Polígono del distrito', G, 'WGS84 lon/lat', 'No', PUB, 'Douglas-Peucker ~20 m', 'P1'),
    ('geo/barrios_nta.geojson', 'features[].properties.nta'): ('F26', 'nta2020', 'Código del barrio NTA 2020', C, 'código', 'No', PUB, 'Ninguna', 'P8'),
    ('geo/barrios_nta.geojson', 'features[].properties.nombre'): ('F26', 'ntaname', 'Nombre del barrio', T, 'nombre', 'No', PUB, 'Ninguna', 'P8'),
    ('geo/barrios_nta.geojson', 'features[].properties.borough'): boro('F26', 'boroname', 'P8'),
    ('geo/barrios_nta.geojson', 'features[].properties.tipo'): ('F26', 'ntatype', 'Tipo de NTA (0 residencial; 5–9 parques, aeropuertos, cementerios…)', C, 'código', 'Sí', PUB, 'Ninguna', 'P8'),
    ('geo/barrios_nta.geojson', 'features[].geometry'): ('F26', 'the_geom', 'Polígono del barrio', G, 'WGS84 lon/lat', 'No', PUB, 'Douglas-Peucker ~20 m', 'P8'),
    ('geo/precintos.geojson', 'features[].properties.precinto'): ('F27', 'precinct', 'Número de precinto del NYPD', C, 'código', 'No', PUB, 'Texto → entero', 'P3'),
    ('geo/precintos.geojson', 'features[].geometry'): ('F27', 'the_geom', 'Polígono del precinto', G, 'WGS84 lon/lat', 'No', PUB, 'Douglas-Peucker ~20 m', 'P3'),
    ('geo/estaciones.geojson', 'features[].properties.nombre'): ('F18', 'stop_name', 'Nombre de la estación', T, 'nombre', 'No', PUB, 'Ninguna', 'P5'),
    ('geo/estaciones.geojson', 'features[].properties.lineas'): ('F18', 'daytime_routes', 'Líneas que paran de día', T, 'códigos de línea', 'Sí', PUB, 'Ninguna', 'P5'),
    ('geo/estaciones.geojson', 'features[].properties.borough'): boro('F18', 'borough (M/Bx/Bk/Q/SI)', 'P5'),
    ('geo/estaciones.geojson', 'features[].properties.linea'): ('F18', 'line', 'Ramal o línea física', T, 'nombre', 'Sí', PUB, 'Ninguna', 'P5'),
    ('geo/estaciones.geojson', 'features[].properties.ada'): ('F18', 'ada', 'Accesibilidad ADA (0 no, 1 sí, 2 parcial)', C, 'código', 'Sí', PUB, 'Ninguna', 'P5'),
    ('geo/estaciones.geojson', 'features[].geometry'): ('F18', 'gtfs_latitude, gtfs_longitude', 'Ubicación de la estación', G, 'WGS84 lon/lat', 'No', PUB, 'Redondeo a 5 decimales', 'P5'),
}
DIC.update(GEO)

# --------------------------------------------------------------- campos que existen en la fuente y NO entran (se documentan igual)
EXCLUIDOS = [
    ('F05', '(no se guarda)', 'owner_first_name, owner_last_name', 'owner_first_name / owner_last_name', 'Nombre y apellido del dueño del predio en cada radicación de obra', T, 'nombre', 'Sí', 'Dato personal', 'EXCLUIDO del lago: no se pide en el $select (minimización)', 'P2'),
    ('F05', '(no se guarda)', 'applicant_first_name, applicant_last_name, applicant_license', 'applicant_*', 'Nombre y licencia profesional del solicitante', T, 'nombre', 'Sí', 'Dato personal', 'EXCLUIDO del lago', 'P2'),
    ('F04', '(no se guarda)', 'vic_age_group, vic_race, vic_sex', 'vic_*', 'Edad, raza y sexo de la víctima de cada denuncia', T, 'categoría', 'Sí', 'Sensible', 'EXCLUIDO: combinados con la coordenada pueden reidentificar a la víctima', 'P3'),
    ('F04', '(no se guarda)', 'latitude, longitude', 'latitude / longitude', 'Punto aproximado del delito', G, 'WGS84', 'Sí', 'Sensible', 'Se usa en memoria para asignar el distrito y se descarta; nunca se escribe', 'P1'),
    ('F03', '(no se guarda)', 'incident_address, descriptor', 'incident_address / descriptor', 'Dirección exacta y descripción en texto libre de la solicitud 311', T, 'texto libre', 'Sí', 'Sensible', 'EXCLUIDO: puede identificar al vecino que reporta', 'P1'),
]
