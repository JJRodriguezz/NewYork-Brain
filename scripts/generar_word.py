"""Llena la plantilla EN BLANCO «Preguntas_por_que_estos_datos.docx»: datos del grupo y una respuesta corta dentro
de cada recuadro. Las cifras se leen del lago para que el texto no contradiga a los datos.

Uso: python scripts/generar_word.py [plantilla] [salida]
"""
import sys, os, json
import docx
from docx.shared import Pt
from comun import RAIZ, LAGO, HOY
from bitacora import GRUPO, BITACORA

PADRE = os.path.dirname(RAIZ)
PLANTILLA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PADRE, 'Preguntas_por_que_estos_datos.docx')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(PADRE, 'Preguntas_por_que_estos_datos_NuevaYork.docx')

J = lambda n: json.load(open(os.path.join(LAGO, n), encoding='utf-8'))
n0 = lambda v: f'{v:,.0f}'.replace(',', '.')
n1 = lambda v: f'{v:,.1f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
num_bitacora = lambda texto: next(i + 2 for i, b in enumerate(BITACORA) if texto in b['encargo'])


def respuestas():
    dem = {d['borough']: d for d in J('demografia.json')['datos']}
    viv = J('vivienda.json'); ver = J('verificaciones.json')['resultados']; dis = J('distritos.json')['datos']
    deli = J('seguridad_delitos.json')['primer_semestre']['datos']
    h25, h26 = sum(d['denuncias_2025'] for d in deli), sum(d['denuncias_2026'] for d in deli)
    carga = max(dem.values(), key=lambda d: d['pct_hogares_con_carga_alquiler'])
    nb = sum(x['viviendas_propuestas'] for x in viv['obra_nueva_2025'])
    acris = ver.get('F11_acris') or []
    deeds = sum(int(x['n']) for x in acris) if isinstance(acris, list) else 0
    con_monto = sum(int(float(x.get('con_monto') or 0)) for x in acris) if isinstance(acris, list) else 0
    mn = sum(int(x['n']) for x in acris if x.get('recorded_borough') == '1') if isinstance(acris, list) else 0
    min_pob = min(d['poblacion_acs'] for d in dis)
    b_dob, b_puma, b_pob, b_bis = num_bitacora('obras nuevas radicadas'), num_bitacora('55 PUMA'), num_bitacora('población 2020'), num_bitacora('sistema legado')

    return [
        # 1. Para quién
        [('Para quién. ', True), ('Le sirve a una junta comunitaria (Community Board) o al equipo de un concejal que tiene que pedir inversión y servicios para su distrito, y también a Planeación (NYC DCP) cuando compara distritos. Trabajamos con 55 áreas PUMA (F19) y no con los 5 boroughs, porque cada PUMA corresponde a uno o dos de los 59 distritos comunitarios y es la escala más pequeña a la que el Censo publica ingreso y alquiler. ', False),
         ('Preguntas: ', True), ('(1) ¿qué distrito concentra más carga de calidad de vida, inseguridad y siniestralidad por habitante? (F03, F04, F02 normalizados con F10); ', False),
         (f'(2) ¿dónde se cruza la presión del alquiler con bajo ingreso, y cuánta vivienda nueva y asequible llega allí? (F10, F05, F16; hoy el {carga["borough"]} tiene la mayor carga: {n1(carga["pct_hogares_con_carga_alquiler"])} % de los hogares inquilinos paga 30 % o más de su ingreso); ', False),
         (f'(3) ¿está bajando el delito este año? (F04 y F14: enero–junio pasó de {n0(h25)} a {n0(h26)} denuncias, {n1((h26 / h25 - 1) * 100)} %). Son P1–P3 de la columna M del diccionario; el lago responde además tránsito, movilidad, aire e interés externo (P4–P7).', False)],
        # 2. Fuentes que sostienen el lago
        [('(a) American Community Survey 2020–2024 (F10, U.S. Census Bureau). ', True), ('Es lo único que da ingreso, alquiler, pobreza y población por distrito, y sin población ninguna otra cifra se puede comparar (todo el tablero está en tasas por habitante). Es oficial, se actualiza cada año y trae margen de error, que mostramos. Lo tomamos de Census Reporter (Knight Lab, Northwestern) porque la API del Censo exige llave (F21); esa réplica no declara licencia, pero los datos federales son de dominio público. ', False),
         ('(b) 311 Service Requests (F03, NYC311). ', True), ('Es la voz de la ciudadanía: qué pide cada distrito, actualizado a diario. Mide demanda de servicio, no gravedad. ', False),
         ('(c) NYPD Complaint Data (F04 y F14). ', True), ('Es la única medición oficial de delitos con categoría legal y ubicación para asignar distrito; mide denuncias, no condenas. ', False),
         ('Ningún dataset de NYC Open Data declara licencia en sus metadatos: escribimos «no declara» y confiamos en ellos porque el portal existe por la Local Law 11 de 2012, que obliga a las agencias a publicar sus datos sin registro ni restricciones de uso. Todas respondieron por API el ' + HOY + '.', False)],
        # 3. Lo que dejaron por fuera
        [('ACRIS – Real Property Master (F11), candidata. ', True),
         (f'Era la fuente para medir el mercado inmobiliario, pero de las {n0(deeds)} escrituras (DEED) registradas en 2025 solo {n0(con_monto)} traen monto mayor que cero y el {n1(mn / deeds * 100)} % aparece en Manhattan, algo que no cuadra (Brooklyn y Queens deberían tener muchas más ventas) y que no logramos explicar; Staten Island ni siquiera aparece, porque sus escrituras las registra otra oficina (Richmond County Clerk); además los nombres de compradores y vendedores están en ACRIS-Parties, que evitamos por minimización. Usarla exigiría entender ese sesgo y cruzarla con las ventas depuradas del Departamento de Finanzas. ' if deeds else 'Era la fuente para medir el mercado inmobiliario, pero mezcla escrituras, hipotecas y cesiones, muchas escrituras traen monto 0 y los nombres de las partes están en ACRIS-Parties, que evitamos por minimización. ', False),
         ('Lo que perdió el sistema: no puede decir cuánto cuestan las viviendas que se venden ni dónde sube el precio. ', False),
         ('También descartamos, por dato viejo o engañoso, la serie de pasajeros MTA que dejó de actualizarse en enero de 2025 (F22) y la “población 2020” de NYC Open Data, que resultó ser una proyección de 2013 (F25).', False)],
        # 4. IA en la búsqueda
        [('Ayudó: ', True), (f'para unir 311, árboles, aire y vivienda (que vienen por distrito comunitario) con el ACS (que viene por PUMA), la IA propuso deducir los distritos desde el código PUMA; la contrastamos con los 55 nombres oficiales y acertó en todos (Bitácora #{b_puma}). ', False),
         ('Se equivocó: ', True), (f'al sumar las viviendas de las obras nuevas de 2025 en DOB NOW dio 562.235, un número que no tenía sentido para una ciudad que construye algunas decenas de miles de viviendas al año. Revisando las filas vimos que cada obra se repite en cada trámite (-P1, -S8, -Z1…); contando solo la radicación inicial quedan {n0(nb)} (Bitácora #{b_dob}). ', False),
         (f'También ofreció como “población 2020” un dataset que resultó ser una proyección de 2013 (F25, #{b_pob}) y dio por abandonado el sistema legado del DOB porque filtró como fecha un campo que es texto (F32, #{b_bis}). Nos dimos cuenta porque antes de meter una cifra volvimos a correr la consulta y nos preguntamos si el número tenía sentido.', False)],
        # 5. Dato que podría hacer daño
        [('El más delicado: edad, raza y sexo de la víctima (vic_age_group, vic_race, vic_sex) junto con la coordenada del delito en NYPD Complaint Data (F04). ', True),
         ('Son públicos, pero cruzados entre sí y con un mapa de edificios o con redes sociales permiten adivinar quién denunció una agresión o violencia doméstica en un edificio pequeño, y exponerla a represalias. ', False),
         (f'Decisión: los campos de la víctima y del sospechoso no se descargan; la coordenada se usa solo en memoria para asignar el distrito y se descarta, y lo publicado son tasas por 1.000 habitantes en distritos de al menos {n0(min_pob)} residentes. ', False),
         ('Aplicamos lo mismo a los nombres de dueños y solicitantes de DOB NOW (F05). Los dos campos quedan en el diccionario como «Sensible» / «Dato personal», con la transformación EXCLUIDO, para dejar constancia de que existen y por qué no entran.', False)],
        # 6. Lo que no encontraron
        [('Nos falta el alquiler de mercado actual: ', True),
         ('cuánto pide hoy un anuncio por un apartamento en cada barrio. Los índices que existen (StreetEasy, Zillow) los publican empresas privadas, no son datos abiertos oficiales y sus términos de uso exigirían una revisión legal que no hicimos, así que no los integramos; y el ACS mide lo que pagan los inquilinos actuales (incluidas casi un millón de viviendas con renta estabilizada) como promedio 2020–2024. ', False),
         ('Lo reemplazamos con el ACS (alquiler mediano y carga de alquiler, F10) y la producción de vivienda asequible (F16). Por eso “¿dónde está la presión del alquiler?” sí queda respondida, pero “¿cuánto le costaría a una familia mudarse hoy a ese distrito?” queda sin responder. Tampoco existe aún como dato abierto el censo de árboles 2025, así que el arbolado es de 2015 (F07).', False)],
    ]


def poner(celda, partes):
    for p in list(celda.paragraphs)[1:]:
        p._element.getparent().remove(p._element)
    par = celda.paragraphs[0]
    for r in list(par.runs):
        r._element.getparent().remove(r._element)
    for texto, negrita in partes:
        run = par.add_run(texto); run.bold = negrita; run.font.size = Pt(10)
    par.paragraph_format.space_after = Pt(2)


def main():
    d = docx.Document(PLANTILLA)
    cab = d.tables[0]
    valores = [GRUPO['ciudad'], GRUPO['integrantes'], GRUPO['repo'], HOY]
    for fila, v in zip(cab.rows, valores):
        poner(fila.cells[1], [(v, False)])
    for tabla, partes in zip(d.tables[1:7], respuestas()):
        poner(tabla.cell(0, 0), partes)
    d.save(SALIDA)
    palabras = [sum(len(t.split()) for t, _ in p) for p in respuestas()]
    print(f'✓ {SALIDA}\n  palabras por respuesta: {palabras}')


if __name__ == '__main__':
    main()
