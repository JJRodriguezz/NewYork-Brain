"""Ingesta · ambiente (F07 censo de árboles de calle 2015; F15 calidad del aire NYCCAS, media anual)."""
import collections
from comun import *

MI2_A_KM2 = 2.589988


def main():
    print('· ambiente')
    props, _, cd_a_puma = pumas()
    area_b = {f['properties']['borough']: f['properties']['area_mi2'] for f in leer('geo/boroughs.geojson')['features']}
    t = Tema('ambiente', 'Ambiente: arbolado y aire')
    salud = soql(NYC, 'uvpi-gqnh', select='boroname,health,count(*) as n', group='boroname,health', limit=100)
    cds = soql(NYC, 'uvpi-gqnh', select='cb_num,count(*) as n', group='cb_num', limit=200)
    t.fuente('F07', 'censo 2015', url=f'{NYC}/uvpi-gqnh.json', consulta=consulta_legible(select='boroname,health,count(*)', group='boroname,health'))
    arb = collections.defaultdict(collections.Counter)
    for r in salud:
        arb[borough_norm(r['boroname'])][r.get('health') or 'sin'] += int(r['n'])
    arb_puma = sumar_por_puma({parse_cd(r['cb_num']): int(r['n']) for r in cds if parse_cd(r.get('cb_num'))}, cd_a_puma)

    where = "measure='Annual mean' AND (name like 'Fine particles%' OR name like 'Nitrogen dioxide%') AND geo_type_name in ('Borough','Citywide','CD')"
    pm = soql(NYC, 'c3uy-2p5r', select='name,geo_type_name,geo_join_id,geo_place_name,time_period,data_value', where=where, limit=20000)
    anios = [r['time_period'] for r in pm if r['time_period'].isdigit()]
    ultimo = max(anios)
    t.fuente('F15', f'{min(anios)}–{ultimo}', url=f'{NYC}/c3uy-2p5r.json', consulta=consulta_legible(where=where))
    serie, cd_ult = collections.defaultdict(dict), collections.defaultdict(dict)
    for r in pm:
        if not r['time_period'].isdigit():
            continue
        k = 'pm25' if r['name'].startswith('Fine') else 'no2'
        if r['geo_type_name'] in ('Borough', 'Citywide'):
            lugar = 'Ciudad' if r['geo_type_name'] == 'Citywide' else borough_norm(r['geo_place_name'])
            serie[(lugar, int(r['time_period']))][k] = round(float(r['data_value']), 2)
        elif r['time_period'] == ultimo:
            cd_ult[int(r['geo_join_id'])][k] = float(r['data_value'])
    acc = collections.defaultdict(list)
    for cd, v in cd_ult.items():
        if cd in cd_a_puma and 'pm25' in v and 'no2' in v:
            acc[cd_a_puma[cd]].append(v)
    aire_puma = {p: {k: round(sum(x[k] for x in vs) / len(vs), 2) for k in ('pm25', 'no2')} for p, vs in acc.items()}

    t.lista('arboles', [{'borough': b, 'arboles': sum(arb[b].values()), 'buena': arb[b]['Good'], 'regular': arb[b]['Fair'], 'mala': arb[b]['Poor'],
                         'sin_registro': arb[b]['sin'], 'arboles_por_km2': r1(sum(arb[b].values()) / (area_b[b] * MI2_A_KM2))} for b in BOROUGHS], {
        'borough': COL_BORO('F07', 'boroname', 'P6'),
        'arboles': C('Árboles de calle censados (incluye tocones y muertos)', 'árboles', 'Entero', 'medido', 'count(tree_id)', 'COUNT por borough', pregunta='P6'),
        'buena': C('Árboles en buen estado', 'árboles', 'Entero', 'medido', "health = 'Good'", 'COUNT', pregunta='P6'),
        'regular': C('Árboles en estado regular', 'árboles', 'Entero', 'medido', "health = 'Fair'", 'COUNT', pregunta='P6'),
        'mala': C('Árboles en mal estado', 'árboles', 'Entero', 'medido', "health = 'Poor'", 'COUNT', pregunta='P6'),
        'sin_registro': C('Tocones o árboles muertos (sin estado de salud)', 'árboles', 'Entero', 'medido', 'health IS NULL', 'Nulos renombrados', pregunta='P6'),
        'arboles_por_km2': C('Árboles de calle por km² de tierra', 'árboles/km²', 'Decimal', 'derivado', '(calculado)', 'árboles ÷ (superficie mi² × 2,59)', fuente=['F07', 'F20'], pregunta='P6', decimales=0),
    }, 'censo 2015', 'F07', 'Árboles de calle por borough y estado de salud')
    t.lista('aire_serie', [{'lugar': l, 'anio': a, 'pm25': v.get('pm25'), 'no2': v.get('no2')} for (l, a), v in sorted(serie.items())], {
        'lugar': C('Ciudad o borough de la medición', 'nombre', 'Texto', 'medido', 'geo_place_name', 'Citywide → "Ciudad"', pregunta='P6'),
        'anio': C('Año de la medición', 'año', 'Entero', 'medido', 'time_period', 'Solo periodos anuales', pregunta='P6'),
        'pm25': C('Partículas finas PM2,5, media anual', 'µg/m³', 'Decimal', 'medido', 'data_value (Fine particles)', "Filtro measure = 'Annual mean'; 2 decimales", pregunta='P6', decimales=2),
        'no2': C('Dióxido de nitrógeno, media anual', 'ppb', 'Decimal', 'medido', 'data_value (Nitrogen dioxide)', "Filtro measure = 'Annual mean'; 2 decimales", pregunta='P6', decimales=2),
    }, f'{min(anios)}–{ultimo}', 'F15', 'Serie anual de calidad del aire por ciudad y borough')
    t.lista('distritos', [{'puma': p, 'arboles': arb_puma.get(p, 0), 'pm25': aire_puma.get(p, {}).get('pm25'), 'no2': aire_puma.get(p, {}).get('no2')} for p in sorted(props)], {
        'puma': C('Código PUMA del distrito', 'código', 'Código', 'derivado', 'cb_num / geo_join_id', 'Distrito comunitario → PUMA', pregunta='P6'),
        'arboles': C('Árboles de calle censados en el distrito', 'árboles', 'Entero', 'medido', 'count(tree_id)', 'SUM por PUMA', fuente='F07', vigencia='censo 2015', pregunta='P6'),
        'pm25': C('PM2,5 media anual del último año', 'µg/m³', 'Decimal', 'derivado', 'data_value (CD)', 'Promedio simple de los distritos comunitarios del PUMA (exacto en 51 de 55)', fuente='F15', vigencia=ultimo, pregunta='P6', decimales=2, etiqueta='PM2,5'),
        'no2': C('NO₂ media anual del último año', 'ppb', 'Decimal', 'derivado', 'data_value (CD)', 'Promedio simple de los distritos comunitarios del PUMA (exacto en 51 de 55)', fuente='F15', vigencia=ultimo, pregunta='P6', decimales=2, etiqueta='NO₂'),
    }, f'árboles 2015 · aire {ultimo}', ['F07', 'F15'], 'Ambiente por distrito (PUMA)')
    ciudad = {a: v for (l, a), v in serie.items() if l == 'Ciudad'}
    a0, a1 = min(ciudad), max(ciudad)
    t.cifra('pm25_ciudad', ciudad[a1]['pm25'], 'µg/m³', str(a1), 'F15', 'medido', 'PM2,5 media anual de la ciudad, último año', pregunta='P6', decimales=2)
    t.cifra('no2_ciudad', ciudad[a1]['no2'], 'ppb', str(a1), 'F15', 'medido', 'NO₂ media anual de la ciudad, último año', pregunta='P6', decimales=1)
    t.cifra('pm25_cambio', r1((ciudad[a1]['pm25'] / ciudad[a0]['pm25'] - 1) * 100, 0), '%', f'{a0}–{a1}', 'F15', 'derivado', 'Cambio del PM2,5 de la ciudad en la serie', formula='(último ÷ primero − 1) × 100', pregunta='P6')
    t.cifra('arboles_2015', sum(sum(arb[b].values()) for b in BOROUGHS), 'árboles', 'censo 2015', 'F07', 'medido', 'Árboles de calle censados en 2015', pregunta='P6')
    t.nota('El censo de árboles es de 2015: es una referencia estructural, no el estado actual. El censo 2025 aún no está publicado como dato abierto.')
    t.calidad("La fuente de aire trae para cada año tres filas por lugar (media anual, de verano y de invierno) con la misma etiqueta de periodo: se filtra measure = 'Annual mean'.")
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
