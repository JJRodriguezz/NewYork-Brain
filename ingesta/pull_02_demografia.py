"""Ingesta · demografía (F09 Censo 2020 transcrito, F10 ACS 2020–2024 con MOE, F18 estaciones, F20 superficie).
Escribe lago/demografia.json con dos escalas: los 5 boroughs y los 55 distritos (PUMA)."""
import collections
from comun import *
import acs

CONDADOS = {'Manhattan': '05000US36061', 'Bronx': '05000US36005', 'Brooklyn': '05000US36047', 'Queens': '05000US36081', 'Staten Island': '05000US36085'}
URL_DCP = 'https://www.nyc.gov/content/planning/pages/planning/nyc-population-2020-census'


def main():
    print('· demografía')
    t = Tema('demografia', 'Gente: Censo 2020 y ACS 2020–2024')
    # F09: la página del DCP es dinámica; se comprueba que responde y las cinco cifras se transcriben
    r = get(URL_DCP); r.raise_for_status()
    t.fuente('F09', 'Censo 2020 (1-abr-2020)', url=URL_DCP, estado='transcrito')
    t.cifra('poblacion_2020', sum(CENSO_2020.values()), 'personas', 'Censo 2020', 'F09', 'transcrito',
            'Población total de la Ciudad de Nueva York en el Censo 2020 (suma de los 5 boroughs)', pregunta='P8')

    geo_b = {f['properties']['borough']: f['properties']['area_mi2'] for f in leer('geo/boroughs.geojson')['features']}
    est = collections.Counter(f['properties']['borough'] for f in leer('geo/estaciones.geojson')['features'])
    t.fuente('F20', 'vigente', estado='vivo'); t.fuente('F18', 'vigente', estado='vivo')

    j, url = acs.descargar(','.join(CONDADOS.values()))
    t.fuente('F10', ACS_VIGENCIA, url=url, consulta=f'table_ids={acs.TABLAS}')
    filas = []
    for b in BOROUGHS:
        area = geo_b[b]
        fila = {'borough': b, 'condado': j['geography'][CONDADOS[b]]['name'].replace(' County, NY', ''), 'poblacion_2020': CENSO_2020[b],
                'superficie_mi2': area, 'densidad_hab_mi2': round(CENSO_2020[b] / area), 'estaciones': est[b], 'estaciones_por_mi2': round(est[b] / area, 2)}
        fila.update(acs.indicadores(j['data'][CONDADOS[b]]))
        filas.append(fila)
    cols = {
        'borough': COL_BORO('F09', pregunta='P8'),
        'condado': C('Condado equivalente al borough', 'nombre', 'Texto', 'medido', 'NAME (ACS)', 'Se quita el sufijo " County, NY"', fuente='F10', pregunta='P8'),
        'poblacion_2020': C('Población residente el 1-abr-2020', 'personas', 'Entero', 'transcrito', 'Total population (Census 2020)', 'Transcrita de la tabla oficial del DCP', fuente='F09', vigencia='Censo 2020', pregunta='P8'),
        'superficie_mi2': C('Superficie terrestre del borough', 'millas²', 'Decimal', 'derivado', 'shape_area', 'pies² → mi²', fuente='F20', vigencia='vigente', pregunta='P8', decimales=2),
        'densidad_hab_mi2': C('Habitantes por milla² de tierra', 'hab/mi²', 'Entero', 'derivado', '(calculado)', 'poblacion_2020 ÷ superficie_mi2', fuente=['F09', 'F20'], vigencia='Censo 2020', pregunta='P1'),
        'estaciones': C('Paradas de subte (y del ferrocarril de Staten Island) en el dataset MTA', 'paradas', 'Entero', 'medido', 'count(stop_name)', 'Conteo por borough', fuente='F18', vigencia='vigente', pregunta='P5'),
        'estaciones_por_mi2': C('Paradas por milla² de tierra', 'paradas/mi²', 'Decimal', 'derivado', '(calculado)', 'estaciones ÷ superficie', fuente=['F18', 'F20'], vigencia='vigente', pregunta='P5', decimales=2),
    }
    cols.update(acs.columnas())
    t.lista('boroughs', filas, cols, 'Censo 2020 · ACS 2020–2024', ['F09', 'F10', 'F18', 'F20'], 'Los cinco boroughs: población, superficie e indicadores sociales')

    # 55 distritos: ACS por PUMA + superficie oficial
    pumas = {f['properties']['puma']: f['properties'] for f in leer('geo/distritos_puma.geojson')['features']}
    j, url = acs.descargar('795|04000US36')
    t.fuente('F19', 'geografía 2020', estado='vivo')
    dist = []
    for gid, d in j['data'].items():
        p = pumas.get(gid[-4:])
        if not p:
            continue
        fila = {'puma': p['puma'], 'nombre': p['nombre'], 'etiqueta': p['etiqueta'], 'borough': p['borough'], 'area_km2': p['area_km2']}
        fila.update(acs.indicadores(d))
        fila['densidad_hab_km2'] = round(fila['poblacion_acs'] / p['area_km2'])
        fila['densidad_hab_km2_moe'] = round(fila['poblacion_acs_moe'] / p['area_km2'])
        dist.append(fila)
    dist.sort(key=lambda f: f['puma'])
    assert len(dist) == 55, len(dist)
    cols = {
        'puma': C('Código PUMA 2020', 'código', 'Código', 'medido', 'GEOID (últimos 4 dígitos)', 'Ninguna', fuente='F19'),
        'nombre': C('Barrios que forman el distrito', 'nombre', 'Texto', 'medido', 'NAME', 'Parte del nombre después de "--"', fuente='F10'),
        'etiqueta': C('Borough y distrito(s) comunitario(s)', 'nombre', 'Texto', 'medido', 'NAME', 'Recorte del nombre', fuente='F10'),
        'borough': C('Borough del distrito', 'nombre', 'Texto', 'derivado', 'GEOID', 'Código DCP → nombre', fuente='F19'),
        'area_km2': C('Superficie del PUMA', 'km²', 'Decimal', 'derivado', 'shape_area', 'pies² → km²', fuente='F19', vigencia='geografía 2020', decimales=2, etiqueta='Superficie'),
        'densidad_hab_km2': C('Habitantes por km²', 'hab/km²', 'Entero', 'derivado', '(calculado)', 'poblacion_acs ÷ area_km2', fuente=['F10', 'F19'], vigencia=ACS_VIGENCIA, moe='densidad_hab_km2_moe', etiqueta='Densidad'),
        'densidad_hab_km2_moe': C('Margen de error al 90 % de la densidad', 'hab/km²', 'Entero', 'derivado', '(calculado)', 'MOE de la población ÷ área', fuente=['F10', 'F19'], vigencia=ACS_VIGENCIA),
    }
    cols.update(acs.columnas())
    t.lista('distritos', dist, cols, ACS_VIGENCIA, ['F10', 'F19'], 'Indicadores del ACS en los 55 distritos (PUMA), con margen de error al 90 %')
    t.nota('El ACS es una encuesta: cada estimación trae margen de error al 90 % (columnas *_moe). Dos distritos cuya diferencia cabe en la suma de sus márgenes no se deben ordenar entre sí.')
    t.nota('La población del ACS (promedio 2020–2024) difiere del Censo 2020: las tasas por borough usan el Censo y las tasas por distrito usan el ACS, porque el Censo por PUMA no está en una API sin llave.')
    t.calidad('La API oficial del Censo exige llave desde 2026 (F21). Se usa la réplica de Census Reporter (F10) y se documenta en la bitácora.')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
