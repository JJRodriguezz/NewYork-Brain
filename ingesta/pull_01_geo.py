"""Ingesta · geografía oficial (F19 PUMA, F20 boroughs, F26 barrios NTA, F27 precintos, F18 estaciones; nombres de PUMA de F10).
Escribe lago/geo/*.geojson simplificados a ~20–25 m, con los miembros del contrato (tema, probado, fuentes, columnas)."""
import re, collections
from comun import *
import acs

FT2_A_MI2 = 1 / 27878400
FT2_A_KM2 = 0.09290304e-6


def cds_de_puma(codigo):
    """PUMA 2020 de NYC → distritos comunitarios DCP (cuatro PUMA agrupan pares de distritos)."""
    boro = int(codigo[1]); cola = codigo[2:]
    nums = {'21': (1, 2), '65': (5, 6), '63': (3, 6)}.get(cola, (int(cola),))
    return [cd_codigo(boro, n) for n in nums]


def main():
    print('· geografía')
    r = get(f'{NYC}/gthc-hcne.geojson'); r.raise_for_status()
    feats = [{'type': 'Feature', 'properties': {'borough': f['properties']['boroname'], 'codigo': int(f['properties']['borocode']),
              'area_mi2': round(float(f['properties']['shape_area']) * FT2_A_MI2, 2)}, 'geometry': simplificar(f['geometry'], 0.00025)}
             for f in r.json()['features']]
    guardar_json('geo/boroughs.geojson', {'type': 'FeatureCollection', **geo_meta('boroughs', 'Límites de los 5 boroughs', ['F20'], {
        'borough': COL_BORO('F20', 'boroname', 'P8'),
        'codigo': C('Código DCP del borough (1 Manhattan … 5 Staten Island)', 'código', 'Código', 'medido', 'borocode', 'Texto → entero', pregunta='P8'),
        'area_mi2': C('Superficie terrestre del borough (polígono recortado a la costa)', 'millas²', 'Decimal', 'derivado', 'shape_area', 'pies² ÷ 27.878.400, 2 decimales', pregunta='P8', decimales=2),
        'geometry': C('Polígono del borough', 'WGS84 lon/lat', 'Coordenada / geometría', 'medido', 'the_geom', 'Douglas-Peucker ~25 m, 5 decimales', pregunta='P8'),
    }, 'vigente'), 'features': feats})

    # nombres oficiales de los PUMA (vienen con cualquier tabla del ACS)
    j, _ = acs.descargar('795|04000US36')
    nombres = {gid[-4:]: j['geography'][gid]['name'] for gid in j['data'] if j['geography'][gid]['name'].startswith('NYC-')}
    r = get(f'{NYC}/pikk-p9nv.geojson', {'$limit': 100}); r.raise_for_status()
    feats = []
    for f in r.json()['features']:
        puma = f['properties']['puma']
        if puma not in nombres:
            continue
        nombre = nombres[puma]
        corto = re.sub(r'^NYC-[^-]+ Community Districts? ', 'CD ', nombre).replace(' PUMA, NY', '')
        boro = BOROUGHS[int(puma[1]) - 1]
        feats.append({'type': 'Feature', 'properties': {
            'puma': puma, 'nombre': corto.split('--', 1)[1] if '--' in corto else corto, 'etiqueta': f"{boro} {corto.split('--')[0]}",
            'borough': boro, 'distritos_comunitarios': cds_de_puma(puma),
            'area_km2': round(float(f['properties']['shape_area']) * FT2_A_KM2, 2)}, 'geometry': simplificar(f['geometry'], 0.0002)})
    assert len(feats) == 55, f'se esperaban 55 PUMA de NYC y llegaron {len(feats)}'
    guardar_json('geo/distritos_puma.geojson', {'type': 'FeatureCollection', **geo_meta('distritos_puma', '55 distritos (PUMA 2020)', ['F19', 'F10'], {
        'puma': C('Código PUMA 2020 (el 2.º dígito es el borough)', 'código', 'Código', 'medido', 'puma', 'Ninguna', fuente='F19'),
        'nombre': C('Barrios que forman el distrito', 'nombre', 'Texto', 'medido', 'NAME (ACS)', 'Parte del nombre oficial después de "--"', fuente='F10'),
        'etiqueta': C('Borough y distrito(s) comunitario(s)', 'nombre', 'Texto', 'medido', 'NAME (ACS)', 'Recorte del nombre oficial', fuente='F10'),
        'borough': C('Borough del distrito', 'nombre', 'Texto', 'derivado', 'puma (2.º dígito)', 'Código DCP → nombre', fuente='F19'),
        'distritos_comunitarios': C('Distritos comunitarios DCP que forman el PUMA', 'código BCC', 'Código', 'derivado', 'NAME (ACS)', 'MN 1&2, MN 5&6, BX 1&2 y BX 3&6 comparten PUMA; la regla se comprobó contra los 55 nombres', fuente='F19'),
        'area_km2': C('Superficie del PUMA', 'km²', 'Decimal', 'derivado', 'shape_area', 'pies² × 0,0929 ÷ 10⁶, 2 decimales', fuente='F19', decimales=2),
        'geometry': C('Polígono del distrito', 'WGS84 lon/lat', 'Coordenada / geometría', 'medido', 'the_geom', 'Douglas-Peucker ~20 m', fuente='F19'),
    }, 'geografía 2020'), 'features': feats})

    r = get(f'{NYC}/9nt8-h7nd.geojson', {'$limit': 400}); r.raise_for_status()
    feats = [{'type': 'Feature', 'properties': {'nta': f['properties']['nta2020'], 'nombre': f['properties']['ntaname'],
              'borough': f['properties']['boroname'], 'tipo': f['properties'].get('ntatype')},
              'geometry': simplificar(f['geometry'], 0.0002)} for f in r.json()['features']]
    guardar_json('geo/barrios_nta.geojson', {'type': 'FeatureCollection', **geo_meta('barrios_nta', 'Barrios NTA 2020', ['F26'], {
        'nta': C('Código del barrio NTA 2020', 'código', 'Código', 'medido', 'nta2020', 'Ninguna', pregunta='P8'),
        'nombre': C('Nombre del barrio', 'nombre', 'Texto', 'medido', 'ntaname', 'Ninguna', pregunta='P8'),
        'borough': COL_BORO('F26', 'boroname', 'P8'),
        'tipo': C('Tipo de NTA (0 residencial; 5–9 parques, aeropuertos, cementerios…)', 'código', 'Código', 'medido', 'ntatype', 'Ninguna', pregunta='P8'),
        'geometry': C('Polígono del barrio', 'WGS84 lon/lat', 'Coordenada / geometría', 'medido', 'the_geom', 'Douglas-Peucker ~20 m', pregunta='P8'),
    }, 'geografía 2020'), 'features': feats})

    r = get(f'{NYC}/y76i-bdw7.geojson', {'$limit': 100}); r.raise_for_status()
    feats = [{'type': 'Feature', 'properties': {'precinto': int(float(f['properties']['precinct']))}, 'geometry': simplificar(f['geometry'], 0.0002)}
             for f in r.json()['features']]
    guardar_json('geo/precintos.geojson', {'type': 'FeatureCollection', **geo_meta('precintos', 'Precintos del NYPD', ['F27'], {
        'precinto': C('Número de precinto del NYPD', 'código', 'Código', 'medido', 'precinct', 'Texto → entero', pregunta='P3'),
        'geometry': C('Polígono del precinto', 'WGS84 lon/lat', 'Coordenada / geometría', 'medido', 'the_geom', 'Douglas-Peucker ~20 m', pregunta='P3'),
    }, 'vigente'), 'features': feats})

    filas = soql(NYS, '39hk-dx4f', select='stop_name,daytime_routes,borough,gtfs_latitude,gtfs_longitude,line,ada', limit=1000)
    bmap = {'M': 'Manhattan', 'Bx': 'Bronx', 'Bk': 'Brooklyn', 'Q': 'Queens', 'SI': 'Staten Island'}
    feats = [{'type': 'Feature', 'properties': {'nombre': x['stop_name'], 'lineas': x.get('daytime_routes', ''), 'borough': bmap.get(x['borough']),
              'linea': x.get('line'), 'ada': x.get('ada')},
              'geometry': {'type': 'Point', 'coordinates': [round(float(x['gtfs_longitude']), 5), round(float(x['gtfs_latitude']), 5)]}} for x in filas]
    guardar_json('geo/estaciones.geojson', {'type': 'FeatureCollection', **geo_meta('estaciones', 'Estaciones de subte y SIR', ['F18'], {
        'nombre': C('Nombre de la estación', 'nombre', 'Texto', 'medido', 'stop_name', 'Ninguna', pregunta='P5'),
        'lineas': C('Líneas que paran de día', 'códigos de línea', 'Texto', 'medido', 'daytime_routes', 'Ninguna', pregunta='P5'),
        'borough': COL_BORO('F18', 'borough (M/Bx/Bk/Q/SI)', 'P5'),
        'linea': C('Ramal o línea física', 'nombre', 'Texto', 'medido', 'line', 'Ninguna', pregunta='P5'),
        'ada': C('Accesibilidad ADA (0 no, 1 sí, 2 parcial)', 'código', 'Código', 'medido', 'ada', 'Ninguna', pregunta='P5'),
        'geometry': C('Ubicación de la estación', 'WGS84 lon/lat', 'Coordenada / geometría', 'medido', 'gtfs_latitude, gtfs_longitude', 'Redondeo a 5 decimales', pregunta='P5'),
    }, 'vigente'), 'features': feats})


if __name__ == '__main__':
    ejecutar(main)
