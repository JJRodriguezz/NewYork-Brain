"""Ingesta · movilidad (F17 pasajeros diarios MTA desde 2020; F18 estaciones, desde el GeoJSON de pull_01)."""
import collections
from comun import *

MODOS = {'Subway': ('subte', 'Viajes diarios promedio en subte'), 'Bus': ('bus', 'Viajes diarios promedio en bus'),
         'LIRR': ('lirr', 'Viajes diarios promedio en Long Island Rail Road'), 'MNR': ('metro_north', 'Viajes diarios promedio en Metro-North'),
         'SIR': ('ferrocarril_staten', 'Viajes diarios promedio en el ferrocarril de Staten Island'),
         'BT': ('puentes_tuneles', 'Cruces diarios promedio por puentes y túneles de la MTA'),
         'CRZ Entries': ('ingresos_zona_congestion', 'Vehículos diarios que entran a la zona de cobro por congestión'),
         'CBD Entries': ('ingresos_cbd', 'Vehículos diarios que entran al distrito central de negocios'),
         'AAR': ('access_a_ride', 'Viajes diarios de Access-A-Ride (paratránsito)')}
SEL = 'date_trunc_ym(date) as m,mode,sum(count) as n,count(count) as dias'
W = "date >= '2020-03-01T00:00:00'"


def main():
    print('· movilidad')
    filas = soql(NYS, 'sayj-mze2', select=SEL, where=W, group='m,mode', order='m', limit=5000)
    t = Tema('movilidad', 'Movilidad: transporte público y peaje de congestión')
    serie = collections.defaultdict(dict)
    for r in filas:
        if r['mode'] in MODOS and r.get('n') and int(r.get('dias') or 0):
            serie[MODOS[r['mode']][0]][r['m'][:7]] = round(float(r['n']) / int(r['dias']))
    actual = HOY[:7]
    meses = sorted({m for s in serie.values() for m in s if m != actual})   # el mes en curso llega incompleto
    t.fuente('F17', f'{meses[0]} a {meses[-1]}', url=f'{NYS}/sayj-mze2.json', consulta=consulta_legible(select=SEL, where=W, group='m,mode'))
    for modo, (clave, desc) in MODOS.items():
        pts = [[m, serie[clave][m]] for m in meses if m in serie[clave]]
        if pts:
            t.serie(clave, pts, 'viajes por día (promedio del mes)', f'{pts[0][0]} a {pts[-1][0]}', 'F17', 'derivado', desc + ' (suma del mes ÷ días con dato)', pregunta='P5')
    sub = t.d['series']['subte']['puntos']
    ult = sub[-1]
    prev = next((v for m, v in sub if m == f'{int(ult[0][:4]) - 1}{ult[0][4:]}'), None)
    t.cifra('subte_ultimo_mes', ult[1], 'viajes por día', ult[0], 'F17', 'derivado', 'Viajes diarios promedio en subte en el último mes completo', pregunta='P5')
    if prev:
        t.cifra('subte_variacion_anual', r1((ult[1] / prev - 1) * 100), '%', f'{ult[0]} vs mismo mes del año anterior', 'F17', 'derivado',
                'Cambio del subte frente al mismo mes del año anterior', formula='(mes ÷ mismo mes año anterior − 1) × 100', pregunta='P5')
    if 'ingresos_zona_congestion' in t.d['series']:
        c = t.d['series']['ingresos_zona_congestion']['puntos']
        t.cifra('congestion_ultimo_mes', c[-1][1], 'vehículos por día', c[-1][0], 'F17', 'derivado', 'Vehículos diarios que entran a la zona de congestión, último mes', pregunta='P5')
        t.cifra('congestion_primer_mes', c[0][1], 'vehículos por día', c[0][0], 'F17', 'derivado', 'Vehículos diarios que entraron a la zona de congestión el primer mes con peaje', pregunta='P5')

    est = leer('geo/estaciones.geojson')['features']
    por_b = collections.Counter(f['properties']['borough'] for f in est)
    t.fuente('F18', 'vigente', estado='vivo')
    t.lista('estaciones', [{'borough': b, 'paradas': por_b[b]} for b in BOROUGHS], {
        'borough': COL_BORO('F18', 'borough (M/Bx/Bk/Q/SI)', 'P5'),
        'paradas': C('Filas del dataset de estaciones en el borough (una por estación-línea)', 'paradas', 'Entero', 'medido', 'count(*)', 'COUNT por borough', pregunta='P5'),
    }, 'vigente', 'F18', 'Paradas de subte (y del ferrocarril de Staten Island) por borough')
    t.cifra('paradas_total', len(est), 'paradas', 'vigente', 'F18', 'medido', 'Filas del dataset de estaciones MTA (subte + ferrocarril de Staten Island)', pregunta='P5')
    t.nota('El promedio diario por mes (suma ÷ días con dato) hace comparables meses de distinta duración. El mes en curso no se publica porque llega incompleto.')
    t.nota('La MTA comunica 472 estaciones de subte porque cuenta las de transbordo de otra forma; el dataset trae una fila por estación-línea.')
    t.calidad('El dataset anterior de pasajeros (F22) dejó de actualizarse en enero de 2025; se reemplazó por F17.')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
