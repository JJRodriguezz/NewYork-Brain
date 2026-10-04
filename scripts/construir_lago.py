"""Construye el lago de datos de Cerebro NYC desde las APIs públicas (sin llaves).

Uso:  python scripts/construir_lago.py            # todo
      python scripts/construir_lago.py vial 311  # solo algunos temas

Cada archivo del lago lleva un bloque _meta con la fuente (id_fuente del Excel), la consulta exacta,
la licencia y la fecha en que la API respondió. Al final se escribe lago/lago.js, un paquete que
permite abrir el sitio con doble clic (file://) sin servidor.
"""
import sys, json, os, re, collections, concurrent.futures as cf
from comun import *
from catalogo import FUENTES, LICENCIA_NYC

ACS = 'https://api.censusreporter.org/1.0/data/show/acs2024_5yr'
CONDADOS = {'Manhattan': '05000US36061', 'Bronx': '05000US36005', 'Brooklyn': '05000US36047',
            'Queens': '05000US36081', 'Staten Island': '05000US36085'}
# Censo 2020 (NYC DCP, transcrito de la tabla oficial; ver F09)
CENSO_2020 = {'Manhattan': 1694251, 'Bronx': 1472654, 'Brooklyn': 2736074, 'Queens': 2405464, 'Staten Island': 495747}
FT2_A_MI2 = 1 / 27878400
FT2_A_KM2 = 0.09290304e-6

ESTADO = {}  # se comparte entre temas (geometrías, población por distrito)


# =========================================================== GEOGRAFÍA (F19, F20, F29, F30, F18)

def geo():
    print('· geografía')
    j = get(f'{NYC}/gthc-hcne.geojson').json()
    feats = []
    for f in j['features']:
        p = f['properties']; b = p['boroname']
        feats.append({'type': 'Feature', 'properties': {'borough': b, 'codigo': int(p['borocode']),
                      'area_mi2': round(float(p['shape_area']) * FT2_A_MI2, 2)}, 'geometry': simplificar(f['geometry'], 0.00025)})
    guardar('geo/boroughs.geojson', {'type': 'FeatureCollection', 'features': feats})
    ESTADO['area_boro'] = {f['properties']['borough']: f['properties']['area_mi2'] for f in feats}

    j = get(f'{NYC}/pikk-p9nv.geojson', {'$limit': 100}).json()
    feats = []
    for f in j['features']:
        puma = f['properties']['puma']
        feats.append({'type': 'Feature', 'properties': {'puma': puma, 'area_km2': round(float(f['properties']['shape_area']) * FT2_A_KM2, 2)},
                      'geometry': simplificar(f['geometry'], 0.0002)})
    ESTADO['pumas_geo'] = feats

    j = get(f'{NYC}/9nt8-h7nd.geojson', {'$limit': 400}).json()
    feats = [{'type': 'Feature', 'properties': {'nta': f['properties']['nta2020'], 'nombre': f['properties']['ntaname'],
              'borough': f['properties']['boroname'], 'tipo': f['properties'].get('ntatype')},
              'geometry': simplificar(f['geometry'], 0.0002)} for f in j['features']]
    guardar('geo/barrios_nta.geojson', {'type': 'FeatureCollection', 'features': feats})

    j = get(f'{NYC}/y76i-bdw7.geojson', {'$limit': 100}).json()
    feats = [{'type': 'Feature', 'properties': {'precinto': int(float(f['properties']['precinct']))},
              'geometry': simplificar(f['geometry'], 0.0002)} for f in j['features']]
    guardar('geo/precintos.geojson', {'type': 'FeatureCollection', 'features': feats})

    filas, url = soql(NYS, '39hk-dx4f', select='stop_name,daytime_routes,borough,complex_id,gtfs_latitude,gtfs_longitude,line,ada', limit=1000)
    bmap = {'M': 'Manhattan', 'Bx': 'Bronx', 'Bk': 'Brooklyn', 'Q': 'Queens', 'SI': 'Staten Island'}
    feats, por_boro, complejos = [], collections.Counter(), collections.defaultdict(set)
    for r in filas:
        b = bmap.get(r['borough'])
        feats.append({'type': 'Feature', 'properties': {'nombre': r['stop_name'], 'lineas': r.get('daytime_routes', ''), 'borough': b,
                      'linea': r.get('line'), 'ada': r.get('ada')},
                      'geometry': {'type': 'Point', 'coordinates': [round(float(r['gtfs_longitude']), 5), round(float(r['gtfs_latitude']), 5)]}})
        por_boro[b] += 1; complejos[b].add(r['complex_id'])
    guardar('geo/estaciones.geojson', {'type': 'FeatureCollection', 'features': feats})
    ESTADO['estaciones'] = {'url': url, 'por_boro': dict(por_boro), 'complejos': {b: len(s) for b, s in complejos.items()}, 'total': len(filas)}


# =========================================================== DEMOGRAFÍA Y ECONOMÍA (F09 + F10)

ACS_TABLAS = 'B01003,B01002,B19013,B25064,B25071,B25070,B17001,B25003,B08301,B05002,B03002,B08201'


def acs_indicadores(d):
    """d = bloque {'Bxxxx': {'estimate': {...}, 'error': {...}}} de Census Reporter → indicadores planos."""
    ent = lambda v: int(v) if isinstance(v, float) and v.is_integer() else v
    e = lambda t, c: ent(d[t]['estimate'].get(f'{t}{c:03d}'))
    m = lambda t, c: ent(d[t]['error'].get(f'{t}{c:03d}'))
    pct = lambda a, b: round(100 * a / b, 1) if a is not None and b else None
    carga = sum(e('B25070', c) or 0 for c in (7, 8, 9, 10))
    base_carga = (e('B25070', 1) or 0) - (e('B25070', 11) or 0)
    return {
        'poblacion_acs': e('B01003', 1),
        'edad_mediana': e('B01002', 1),
        'ingreso_mediano': e('B19013', 1), 'ingreso_mediano_moe': m('B19013', 1),
        'alquiler_mediano': e('B25064', 1), 'alquiler_mediano_moe': m('B25064', 1),
        'alquiler_pct_ingreso': e('B25071', 1),
        'pct_hogares_con_carga_alquiler': pct(carga, base_carga),
        'pct_pobreza': pct(e('B17001', 2), e('B17001', 1)),
        'pct_inquilinos': pct(e('B25003', 3), e('B25003', 1)),
        'pct_transporte_publico': pct(e('B08301', 10), e('B08301', 1)),
        'pct_teletrabajo': pct(e('B08301', 21), e('B08301', 1)),
        'pct_hogares_sin_auto': pct(e('B08201', 2), e('B08201', 1)),
        'pct_nacidos_extranjero': pct(e('B05002', 13), e('B05002', 1)),
        'pct_hispano': pct(e('B03002', 12), e('B03002', 1)),
        'pct_blanco_nh': pct(e('B03002', 3), e('B03002', 1)),
        'pct_negro_nh': pct(e('B03002', 4), e('B03002', 1)),
        'pct_asiatico_nh': pct(e('B03002', 6), e('B03002', 1)),
    }


def demografia():
    print('· demografía (Censo 2020 + ACS 2020–2024)')
    geo_ids = ','.join(CONDADOS.values())
    r = get(ACS, {'table_ids': ACS_TABLAS, 'geo_ids': geo_ids}).json()
    filas = []
    for b in BOROUGHS:
        ind = acs_indicadores(r['data'][CONDADOS[b]])
        area = ESTADO.get('area_boro', {}).get(b)
        fila = {'borough': b, 'condado': r['geography'][CONDADOS[b]]['name'].replace(' County, NY', ''),
                'poblacion_2020': CENSO_2020[b], 'superficie_mi2': area,
                'densidad_hab_mi2': round(CENSO_2020[b] / area) if area else None}
        fila.update(ind)
        est = ESTADO.get('estaciones', {})
        fila['estaciones_subte'] = est.get('por_boro', {}).get(b, 0)
        fila['estaciones_por_mi2'] = round(fila['estaciones_subte'] / area, 2) if area else None
        filas.append(fila)
    ESTADO['demografia'] = {f['borough']: f for f in filas}
    guardar('demografia.json', {
        '_meta': meta('F09, F10, F18, F20', 'demografia',
                      conjunto_de_datos='Censo 2020 (población) + American Community Survey 2020–2024, 5 años (indicadores sociales y de vivienda)',
                      entidad='U.S. Census Bureau, vía NYC DCP (F09) y Census Reporter (F10); superficie: NYC DCP Borough Boundaries (F20); estaciones: MTA (F18)',
                      url_api=f'{ACS}?table_ids={ACS_TABLAS}&geo_ids={geo_ids}',
                      licencia='Datos del Censo de EE.UU.: obra del gobierno federal, dominio público. NYC Open Data: ' + LICENCIA_NYC,
                      trae_personas=False, cobertura='5 boroughs (= 5 condados)', periodo='Censo: 1-abr-2020. ACS: promedio 2020–2024 (dólares de 2024).',
                      frecuencia_actualizacion='Censo: decenal. ACS 5 años: anual (diciembre).',
                      nota='El ACS es una encuesta: cada estimación trae margen de error al 90 % (campos *_moe). La población del ACS difiere del Censo 2020 porque es un promedio 2020–2024; para tasas por habitante se usa el Censo 2020. Superficie = área terrestre de los polígonos oficiales (pies² → millas²).'),
        'release_acs': r.get('release'),
        'poblacion_total_2020': sum(CENSO_2020.values()),
        'datos': filas})


# =========================================================== DISTRITOS COMUNITARIOS (PUMA) — base del atlas y correlaciones

def cds_de_puma(codigo):
    """PUMA 2020 de NYC → distritos comunitarios (DCP agrupa algunos pares)."""
    boro = int(codigo[1]); cola = codigo[2:]
    pares = {'21': (1, 2), '65': (5, 6), '63': (3, 6)}
    nums = pares.get(cola, (int(cola),))
    return [cd_codigo(boro, n) for n in nums]


def distritos_base():
    print('· distritos (55 PUMA)')
    r = get(ACS, {'table_ids': ACS_TABLAS, 'geo_ids': '795|04000US36'}).json()
    pumas = {}
    for gid, d in r['data'].items():
        nombre = r['geography'][gid]['name']
        if not nombre.startswith('NYC-'):
            continue
        codigo = gid[-4:]
        corto = re.sub(r'^NYC-[^-]+ Community Districts? ', 'CD ', nombre).replace(' PUMA, NY', '')
        barrio = corto.split('--', 1)[1] if '--' in corto else corto
        boro = BOROUGHS[int(codigo[1]) - 1]
        p = {'puma': codigo, 'nombre': barrio, 'etiqueta': f"{boro} {corto.split('--')[0]}", 'borough': boro,
             'distritos_comunitarios': cds_de_puma(codigo)}
        p.update(acs_indicadores(d))
        pumas[codigo] = p
    area = {f['properties']['puma']: f['properties']['area_km2'] for f in ESTADO['pumas_geo']}
    for c, p in pumas.items():
        p['area_km2'] = area.get(c)
        p['densidad_hab_km2'] = round(p['poblacion_acs'] / p['area_km2']) if p.get('area_km2') else None
    ESTADO['pumas'] = pumas
    ESTADO['cd_a_puma'] = {cd: c for c, p in pumas.items() for cd in p['distritos_comunitarios']}
    feats = [dict(f, properties=dict(f['properties'], nombre=pumas[f['properties']['puma']]['nombre'],
                                         etiqueta=pumas[f['properties']['puma']]['etiqueta'], borough=pumas[f['properties']['puma']]['borough']))
             for f in ESTADO['pumas_geo'] if f['properties']['puma'] in pumas]
    guardar('geo/distritos_puma.geojson', {'type': 'FeatureCollection', 'features': feats})
    ESTADO['indice_puma'] = IndicePoligonos(feats, 'puma')
    ESTADO['acs_url_puma'] = f'{ACS}?table_ids={ACS_TABLAS}&geo_ids=795|04000US36'


def a_puma(valores_por_cd):
    out = collections.Counter()
    for cd, v in valores_por_cd.items():
        c = ESTADO['cd_a_puma'].get(cd)
        if c:
            out[c] += v
    return out


def parse_cd(s, boro=None):
    """'01 BRONX' | '101' | 'QN-08' | '4' (+ borough) → 201, 101, 408…  Devuelve None si no es un CD real (p. ej. parques 55+)."""
    if s is None:
        return None
    s = str(s).strip().upper()
    m = re.match(r'^(\d{1,2})\s+([A-Z ]+)$', s)
    if m:
        b = borough_norm(m.group(2)); n = int(m.group(1))
        return cd_codigo(COD_BORO[b], n) if b and 1 <= n <= 18 else None
    m = re.match(r'^(MN|BX|BK|QN|SI)-?(\d{1,2})$', s)
    if m:
        n = int(m.group(2)); return cd_codigo(ABREV[m.group(1)], n) if 1 <= n <= 18 else None
    m = re.match(r'^([1-5])(\d{2})$', s)
    if m:
        n = int(m.group(2)); return int(s) if 1 <= n <= 18 else None
    if boro and s.isdigit() and 1 <= int(s) <= 18:
        return cd_codigo(COD_BORO[boro], int(s))
    return None


# =========================================================== SEGURIDAD VIAL (F02)

def vial():
    print('· seguridad vial 2025')
    cols = ('borough,latitude,longitude,number_of_persons_injured,number_of_persons_killed,number_of_pedestrians_injured,'
            'number_of_pedestrians_killed,number_of_cyclist_injured,number_of_cyclist_killed,number_of_motorist_injured,number_of_motorist_killed,crash_date')
    where = "crash_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
    filas = soql_paginado(NYC, 'h9gi-nx95', select=cols, where=where, order='collision_id')
    n = lambda r, k: int(float(r.get(k) or 0))
    por_boro = collections.defaultdict(collections.Counter)
    por_puma = collections.defaultdict(collections.Counter)
    por_mes = collections.defaultdict(collections.Counter)
    sin_boro_recuperados = 0
    idx = ESTADO['indice_puma']
    for r in filas:
        b = borough_norm(r.get('borough'))
        puma = None
        try:
            x, y = float(r['longitude']), float(r['latitude'])
            if -74.3 < x < -73.6 and 40.4 < y < 41.0:
                puma = idx.buscar(x, y)
        except (KeyError, ValueError, TypeError):
            pass
        if not b and puma:
            b = ESTADO['pumas'][puma]['borough']; sin_boro_recuperados += 1
        b = b or 'No especificado'
        reg = {'colisiones': 1, 'heridos': n(r, 'number_of_persons_injured'), 'fallecidos': n(r, 'number_of_persons_killed'),
               'peatones_heridos': n(r, 'number_of_pedestrians_injured'), 'peatones_fallecidos': n(r, 'number_of_pedestrians_killed'),
               'ciclistas_heridos': n(r, 'number_of_cyclist_injured'), 'ciclistas_fallecidos': n(r, 'number_of_cyclist_killed'),
               'ocupantes_heridos': n(r, 'number_of_motorist_injured'), 'ocupantes_fallecidos': n(r, 'number_of_motorist_killed')}
        por_boro[b].update(reg)
        if puma:
            por_puma[puma].update(reg)
        por_mes[r['crash_date'][:7]].update(reg)
    ESTADO['vial_puma'] = por_puma
    datos = []
    for b in BOROUGHS + ['No especificado']:
        c = por_boro.get(b, collections.Counter())
        fila = {'borough': b, **{k: c[k] for k in ('colisiones', 'heridos', 'fallecidos', 'peatones_heridos', 'peatones_fallecidos',
                                                   'ciclistas_heridos', 'ciclistas_fallecidos', 'ocupantes_heridos', 'ocupantes_fallecidos')}}
        if b in CENSO_2020:
            fila['heridos_por_100k'] = r1(c['heridos'] / CENSO_2020[b] * 1e5)
            fila['fallecidos_por_100k'] = r1(c['fallecidos'] / CENSO_2020[b] * 1e5, 2)
        datos.append(fila)
    guardar('seguridad_vial.json', {
        '_meta': meta('F02', 'seguridad_vial', conjunto_de_datos='Motor Vehicle Collisions - Crashes', entidad='NYC Police Department (NYPD) vía NYC Open Data',
                      url_api=f'{NYC}/h9gi-nx95.json', consulta_soql=f'$select={cols}&$where={where}', licencia=LICENCIA_NYC,
                      trae_personas=False, cobertura='Ciudad de Nueva York; borough y punto (lat/lon) de cada choque', periodo='2025-01-01 a 2025-12-31',
                      frecuencia_actualizacion='Diaria', unidad='colisiones y personas',
                      nota=f'Se descargan solo campos de conteo y coordenadas ({len(filas)} choques). {sin_boro_recuperados} choques sin borough en la fuente se ubicaron por coordenadas (punto en polígono contra los PUMA oficiales); los que no tienen coordenadas válidas quedan como "No especificado". Fuente con reporte obligatorio solo si hay herido, fallecido o daño > USD 1.000.'),
        'total_colisiones': len(filas),
        'recuperados_por_coordenadas': sin_boro_recuperados,
        'datos': datos,
        'serie_mensual': [{'mes': m, 'colisiones': c['colisiones'], 'heridos': c['heridos'], 'fallecidos': c['fallecidos']} for m, c in sorted(por_mes.items())]})


# =========================================================== CALIDAD DE VIDA 311 (F03)

def q311():
    print('· 311 (12 consultas mensuales en paralelo)')
    meses = [(f'2025-{m:02d}-01T00:00:00', f'2026-01-01T00:00:00' if m == 12 else f'2025-{m + 1:02d}-01T00:00:00') for m in range(1, 13)]

    def mes(rango):
        a, b = rango
        filas, _ = soql(NYC, 'erm2-nwe9', select='borough,community_board,complaint_type,count(*) as n',
                        where=f"created_date >= '{a}' and created_date < '{b}'", group='borough,community_board,complaint_type', limit=100000)
        return a[:7], filas

    with cf.ThreadPoolExecutor(4) as ex:
        resultados = list(ex.map(mes, meses))
    por_boro, por_tipo, por_cd, por_mes = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
    tipo_boro = collections.defaultdict(collections.Counter)
    for m, filas in resultados:
        for r in filas:
            n = int(r['n']); b = borough_norm(r.get('borough')) or 'No especificado'
            t = r.get('complaint_type', '(sin tipo)').strip()
            t = t[:1].upper() + t[1:].lower() if t.isupper() else t
            por_boro[b] += n; por_tipo[t] += n; por_mes[m] += n; tipo_boro[b][t] += n
            cd = parse_cd(r.get('community_board'))
            if cd:
                por_cd[cd] += n
    ESTADO['311_puma'] = a_puma(por_cd)
    total = sum(por_boro.values())
    consulta = "$select=borough,community_board,complaint_type,count(*) as n&$where=created_date >= 'AAAA-MM-01' and created_date < 'mes siguiente'&$group=borough,community_board,complaint_type"
    guardar('calidad_de_vida_311.json', {
        '_meta': meta('F03', 'calidad_de_vida_311', conjunto_de_datos='311 Service Requests from 2010 to Present',
                      entidad='NYC Office of Technology and Innovation (OTI) / NYC311 vía NYC Open Data', url_api=f'{NYC}/erm2-nwe9.json',
                      consulta_soql=consulta + '  (12 consultas, una por mes de 2025)', licencia=LICENCIA_NYC, trae_personas=False,
                      cobertura='Ciudad de Nueva York; borough, distrito comunitario y tipo de solicitud', periodo='2025-01-01 a 2025-12-31',
                      frecuencia_actualizacion='Diaria', unidad='solicitudes de servicio',
                      nota='El dataset tiene más de 40 millones de filas: una sola consulta anual agregada agota el tiempo de la API, por eso se consulta mes a mes. Las solicitudes en distritos "Unspecified" o parques (CD 55+) cuentan para el borough pero no para el atlas de distritos. Los nombres de tipo en MAYÚSCULAS se pasan a tipo oración para no duplicar categorías visualmente.'),
        'total_2025': total,
        'por_borough': [{'borough': b, 'solicitudes': por_boro[b], 'por_1000_hab': r1(por_boro[b] / CENSO_2020[b] * 1000) if b in CENSO_2020 else None}
                        for b in BOROUGHS + ['No especificado']],
        'top_tipos': [{'tipo': t, 'solicitudes': n} for t, n in por_tipo.most_common(15)],
        'top_tipos_por_borough': {b: [{'tipo': t, 'solicitudes': n} for t, n in tipo_boro[b].most_common(5)] for b in BOROUGHS},
        'serie_mensual': [{'mes': m, 'solicitudes': por_mes[m]} for m in sorted(por_mes)]})


# =========================================================== DELITOS (F04 histórico 2025 + F14 año en curso)

def delitos():
    print('· delitos 2025 (+ comparación primer semestre 2026)')
    w25 = "rpt_dt between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
    filas, url = soql(NYC, 'qgea-i56i', select='boro_nm,law_cat_cd,count(*) as n', where=w25, group='boro_nm,law_cat_cd', limit=1000)
    por_boro = collections.defaultdict(collections.Counter)
    for r in filas:
        b = borough_norm(r.get('boro_nm')) or 'No especificado'
        por_boro[b][(r.get('law_cat_cd') or 'SIN CATEGORÍA').upper()] += int(r['n'])
    ofensas, _ = soql(NYC, 'qgea-i56i', select='boro_nm,ofns_desc,count(*) as n', where=w25, group='boro_nm,ofns_desc', order='n DESC', limit=5000)
    top = collections.defaultdict(list)
    for r in ofensas:
        b = borough_norm(r.get('boro_nm'))
        if b and len(top[b]) < 5 and r.get('ofns_desc'):
            top[b].append({'ofensa': r['ofns_desc'].title(), 'denuncias': int(r['n'])})
    # ubicación agregada por coordenada → distrito (nunca se guarda el punto)
    # una consulta por mes y sin $order: la versión anual paginada y ordenada tardaba más de 20 minutos
    def mes(m):
        a = f'2025-{m:02d}-01T00:00:00'; b = '2026-01-01T00:00:00' if m == 12 else f'2025-{m + 1:02d}-01T00:00:00'
        return soql(NYC, 'qgea-i56i', select='latitude,longitude,law_cat_cd,count(*) as n', where=f"rpt_dt >= '{a}' AND rpt_dt < '{b}' AND latitude IS NOT NULL",
                    group='latitude,longitude,law_cat_cd', limit=200000)[0]
    with cf.ThreadPoolExecutor(4) as ex:
        pts = [r for lote in ex.map(mes, range(1, 13)) for r in lote]
    idx, por_puma = ESTADO['indice_puma'], collections.defaultdict(collections.Counter)
    for r in pts:
        try:
            p = idx.buscar(float(r['longitude']), float(r['latitude']))
        except (TypeError, ValueError):
            continue
        if p:
            por_puma[p]['total'] += int(r['n'])
            if r.get('law_cat_cd') == 'FELONY':
                por_puma[p]['graves'] += int(r['n'])
    ESTADO['delitos_puma'] = por_puma
    # primer semestre: 2025 (histórico) vs 2026 (año en curso, F14)
    h = lambda y: f"rpt_dt between '{y}-01-01T00:00:00' and '{y}-06-30T23:59:59'"
    s25, _ = soql(NYC, 'qgea-i56i', select='boro_nm,count(*) as n', where=h(2025), group='boro_nm')
    s26, url26 = soql(NYC, '5uac-w243', select='boro_nm,count(*) as n', where=h(2026), group='boro_nm')
    rango26, _ = soql(NYC, '5uac-w243', select='max(rpt_dt) as hasta')
    a = {borough_norm(r.get('boro_nm')): int(r['n']) for r in s25}
    b = {borough_norm(r.get('boro_nm')): int(r['n']) for r in s26}
    datos = []
    for bo in BOROUGHS + ['No especificado']:
        c = por_boro.get(bo, collections.Counter()); tot = sum(c.values())
        fila = {'borough': bo, 'denuncias': tot, 'graves': c['FELONY'], 'menos_graves': c['MISDEMEANOR'], 'infracciones': c['VIOLATION']}
        if bo in CENSO_2020:
            fila['por_1000_hab'] = r1(tot / CENSO_2020[bo] * 1000)
            fila['graves_por_1000_hab'] = r1(c['FELONY'] / CENSO_2020[bo] * 1000)
        datos.append(fila)
    guardar('seguridad_delitos.json', {
        '_meta': meta('F04, F14', 'seguridad_delitos', conjunto_de_datos='NYPD Complaint Data Historic (2025) + NYPD Complaint Data Current (Year To Date, 2026)',
                      entidad='NYC Police Department (NYPD) vía NYC Open Data', url_api=f'{NYC}/qgea-i56i.json ; {NYC}/5uac-w243.json',
                      consulta_soql=f'$select=boro_nm,law_cat_cd,count(*)&$where={w25}&$group=boro_nm,law_cat_cd', licencia=LICENCIA_NYC,
                      trae_personas=True, campos_personales_excluidos=['susp_age_group', 'susp_race', 'susp_sex', 'vic_age_group', 'vic_race', 'vic_sex', 'latitude/longitude (solo se usan para asignar distrito, no se guardan)'],
                      cobertura='Ciudad de Nueva York; borough y distrito', periodo='Año de reporte 2025; comparación enero–junio 2025 vs 2026',
                      frecuencia_actualizacion='Trimestral', unidad='denuncias (delitos reportados, no condenas)',
                      nota='Se cuenta por fecha de reporte (rpt_dt), como en las estadísticas del NYPD. La fuente trae edad, raza y sexo de víctima y sospechoso por fila: nada de eso entra al lago. Delitos sexuales vienen sin coordenadas por protección de víctimas, así que el conteo por distrito es algo menor que el del borough. En el dataset de año en curso hay fechas de inicio imposibles (año 1016): por eso se filtra por rpt_dt y no por cmplnt_fr_dt.'),
        'total_2025': sum(sum(c.values()) for c in por_boro.values()),
        'datos': datos,
        'top_ofensas_por_borough': top,
        'primer_semestre': {'disponible_hasta': (rango26[0].get('hasta') or '')[:10],
                            'datos': [{'borough': bo, 'denuncias_2025': a.get(bo, 0), 'denuncias_2026': b.get(bo, 0),
                                       'variacion_pct': r1((b.get(bo, 0) / a[bo] - 1) * 100) if a.get(bo) else None} for bo in BOROUGHS]}})


# =========================================================== VIVIENDA (F05 DOB NOW + F16 Housing New York)

def vivienda():
    print('· vivienda')
    w = "job_type='New Building' AND job_filing_number like '%-I1' AND filing_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
    filas, url = soql(NYC, 'w9ak-ipjd', select='upper(borough) as b,commmunity_board as cd,count(*) as n,sum(proposed_dwelling_units::number) as u', where=w, group='b,cd', limit=5000)
    nb_boro, nb_cd, u_boro = collections.Counter(), collections.Counter(), collections.Counter()
    for r in filas:
        b = borough_norm(r.get('b'))
        if not b:
            continue
        nb_boro[b] += int(r['n']); u_boro[b] += int(float(r.get('u') or 0))
        cd = parse_cd(r.get('cd'), b)
        if cd:
            nb_cd[cd] += int(float(r.get('u') or 0))
    inflado, _ = soql(NYC, 'w9ak-ipjd', select='count(*) as n,sum(proposed_dwelling_units::number) as u',
                      where="job_type='New Building' AND filing_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'")
    hny, url_h = soql(NYC, 'hg8x-zxpr', select='borough,community_board,sum(all_counted_units) as u,sum(extremely_low_income_units) as eli,sum(very_low_income_units) as vli,sum(low_income_units) as li,sum(moderate_income_units) as mi,sum(middle_income_units) as mid',
                      group='borough,community_board', limit=5000)
    hb = collections.defaultdict(collections.Counter); hcd = collections.Counter()
    for r in hny:
        b = borough_norm(r.get('borough'))
        if not b:
            continue
        for k in ('u', 'eli', 'vli', 'li', 'mi', 'mid'):
            hb[b][k] += int(float(r.get(k) or 0))
        cd = parse_cd(r.get('community_board'))
        if cd:
            hcd[cd] += int(float(r.get('u') or 0))
    anual, _ = soql(NYC, 'hg8x-zxpr', select='date_extract_y(project_start_date) as y,sum(all_counted_units) as u', group='y', order='y', limit=100)
    ESTADO['nb_puma'] = a_puma(nb_cd); ESTADO['hny_puma'] = a_puma(hcd)
    guardar('vivienda.json', {
        '_meta': meta('F05, F16', 'vivienda', conjunto_de_datos='DOB NOW: Build – Job Application Filings (obra nueva 2025) + Housing New York Units by Building',
                      entidad='NYC Department of Buildings (F05); NYC Dept. of Housing Preservation and Development, HPD (F16)',
                      url_api=f'{NYC}/w9ak-ipjd.json ; {NYC}/hg8x-zxpr.json', consulta_soql=f'$select=upper(borough),commmunity_board,count(*),sum(proposed_dwelling_units::number)&$where={w}',
                      licencia=LICENCIA_NYC, trae_personas=True,
                      campos_personales_excluidos=['owner_first_name', 'owner_last_name', 'owner_s_business_name', 'applicant_first_name', 'applicant_last_name', 'applicant_license', 'filing_representative_first_name', 'filing_representative_last_name', 'filing_representative_street_name'],
                      cobertura='Ciudad de Nueva York; borough y distrito comunitario', periodo='DOB: radicaciones de 2025. HPD: acumulado desde 2014 (planes Housing New York / Housing Our Neighbors).',
                      frecuencia_actualizacion='DOB: diaria. HPD: trimestral', unidad='solicitudes, viviendas',
                      nota=f'Calidad: cada obra nueva genera varias filas (radicación inicial -I1 y trámites posteriores -P1, -S8, -Z1…) que repiten las viviendas propuestas. Sin filtrar, 2025 suma {int(float(inflado[0]["u"])):,} viviendas en {int(inflado[0]["n"]):,} filas; contando solo -I1 quedan {sum(u_boro.values()):,}. Además el campo de distrito se llama "commmunity_board" (con triple m) en la fuente. Los nombres de propietarios y solicitantes no se descargan.'),
        'obra_nueva_2025': [{'borough': b, 'solicitudes_obra_nueva': nb_boro[b], 'viviendas_propuestas': u_boro[b],
                             'viviendas_por_1000_hab': r1(u_boro[b] / CENSO_2020[b] * 1000)} for b in BOROUGHS],
        'filas_sin_filtrar_2025': {'filas': int(inflado[0]['n']), 'viviendas': int(float(inflado[0]['u']))},
        'asequible_hpd': [{'borough': b, 'viviendas_asequibles': hb[b]['u'], 'ingreso_extremadamente_bajo': hb[b]['eli'], 'ingreso_muy_bajo': hb[b]['vli'],
                           'ingreso_bajo': hb[b]['li'], 'ingreso_moderado': hb[b]['mi'], 'ingreso_medio': hb[b]['mid']} for b in BOROUGHS],
        'asequible_por_anio_inicio': [{'anio': int(r['y']), 'viviendas': int(float(r['u']))} for r in anual if r.get('y')]})


# =========================================================== RODAJES (F06)

def rodajes():
    print('· rodajes 2025')
    w = "startdatetime between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
    filas, _ = soql(NYC, 'tg4x-b46p', select='borough,category,count(*) as n', where=w, group='borough,category', limit=1000)
    mes, _ = soql(NYC, 'tg4x-b46p', select='date_trunc_ym(startdatetime) as m,count(*) as n', where=w, group='m', order='m')
    por_b, por_cat, malos = collections.Counter(), collections.Counter(), collections.Counter()
    for r in filas:
        b = borough_norm(r.get('borough')); n = int(r['n'])
        if b:
            por_b[b] += n; por_cat[r.get('category') or '(sin categoría)'] += n
        else:
            malos[r.get('borough') or '(vacío)'] += n
    guardar('economia_rodajes.json', {
        '_meta': meta('F06', 'economia_rodajes', conjunto_de_datos='Film Permits', entidad="NYC Mayor's Office of Media and Entertainment (MOME) vía NYC Open Data",
                      url_api=f'{NYC}/tg4x-b46p.json', consulta_soql=f'$select=borough,category,count(*)&$where={w}&$group=borough,category', licencia=LICENCIA_NYC,
                      trae_personas=False, cobertura='Ciudad de Nueva York; borough', periodo='Permisos con inicio en 2025', frecuencia_actualizacion='Diaria',
                      unidad='permisos de rodaje y eventos', nota='Las filas cuyo campo borough trae un valor que no es un borough (errores de captura en la fuente) se cuentan aparte y no se suman.'),
        'por_borough': [{'borough': b, 'permisos': por_b[b]} for b in BOROUGHS],
        'por_categoria': [{'categoria': c, 'permisos': n} for c, n in por_cat.most_common()],
        'serie_mensual': [{'mes': r['m'][:7], 'permisos': int(r['n'])} for r in mes],
        'filas_descartadas_por_codificacion': [{'valor_borough': k, 'conteo': v} for k, v in malos.items()]})


# =========================================================== AMBIENTE (F07 árboles + F15 aire)

def ambiente():
    print('· ambiente')
    salud, url = soql(NYC, 'uvpi-gqnh', select='boroname,health,count(*) as n', group='boroname,health', limit=100)
    cds, _ = soql(NYC, 'uvpi-gqnh', select='cb_num,count(*) as n', group='cb_num', limit=200)
    arb = collections.defaultdict(collections.Counter)
    for r in salud:
        arb[borough_norm(r['boroname'])][r.get('health') or 'Sin registro (tocón o muerto)'] += int(r['n'])
    por_cd = collections.Counter({parse_cd(r['cb_num']): int(r['n']) for r in cds if parse_cd(r.get('cb_num'))})
    ESTADO['arboles_puma'] = a_puma(por_cd)
    pm, url_aq = soql(NYC, 'c3uy-2p5r', select='name,geo_type_name,geo_join_id,geo_place_name,time_period,data_value',
                      where="measure='Annual mean' AND (name like 'Fine particles%' OR name like 'Nitrogen dioxide%') AND geo_type_name in ('Borough','Citywide','CD')", limit=20000)
    serie = collections.defaultdict(dict); cd24 = collections.defaultdict(dict); ultimo = max(r['time_period'] for r in pm if r['time_period'].isdigit())
    for r in pm:
        if not r['time_period'].isdigit():
            continue
        k = 'pm25' if r['name'].startswith('Fine') else 'no2'
        if r['geo_type_name'] in ('Borough', 'Citywide'):
            lugar = 'Ciudad' if r['geo_type_name'] == 'Citywide' else borough_norm(r['geo_place_name'])
            serie[(lugar, r['time_period'])][k] = round(float(r['data_value']), 2)
        elif r['time_period'] == ultimo:
            cd24[int(r['geo_join_id'])][k] = float(r['data_value'])
    # promedio de los CD que forman cada PUMA
    acc = collections.defaultdict(list)
    for cd, v in cd24.items():
        if cd in ESTADO['cd_a_puma']:
            acc[ESTADO['cd_a_puma'][cd]].append(v)
    ESTADO['aire_puma'] = {p: {k: round(sum(x[k] for x in vs) / len(vs), 2) for k in ('pm25', 'no2')} for p, vs in acc.items()}
    guardar('ambiente.json', {
        '_meta': meta('F07, F15', 'ambiente', conjunto_de_datos='2015 Street Tree Census - Tree Data + NYC Air Quality (NYCCAS)',
                      entidad='NYC Parks (F07); NYC Department of Health and Mental Hygiene, NYC Community Air Survey (F15)',
                      url_api=f'{NYC}/uvpi-gqnh.json ; {NYC}/c3uy-2p5r.json', licencia=LICENCIA_NYC, trae_personas=False,
                      consulta_soql="F07: $select=boroname,health,count(*)&$group=boroname,health · F15: $where=measure='Annual mean' AND name like 'Fine particles%' OR 'Nitrogen dioxide%'",
                      cobertura='Árboles de calle (no parques); aire por borough y distrito comunitario', periodo=f'Árboles: censo 2015. Aire: serie anual hasta {ultimo}.',
                      frecuencia_actualizacion='Árboles: única vez (censo decenal; el de 2025 aún no está publicado). Aire: anual.', unidad='árboles; µg/m³ (PM2,5); ppb (NO2)',
                      nota='El censo de árboles es de 2015: sirve como referencia estructural, no como estado actual. "Sin registro" son tocones o árboles muertos, que no tienen estado de salud. La fuente de aire trae para cada año tres filas por lugar (media anual, verano e invierno) con la misma etiqueta de periodo; aquí se filtra measure = "Annual mean" para no mezclarlas.'),
        'arboles_por_borough': [{'borough': b, 'arboles': sum(arb[b].values()), 'buena': arb[b]['Good'], 'regular': arb[b]['Fair'], 'mala': arb[b]['Poor'],
                                 'sin_registro': arb[b]['Sin registro (tocón o muerto)'],
                                 'arboles_por_km2': r1(sum(arb[b].values()) / (ESTADO['area_boro'][b] * 2.589988))} for b in BOROUGHS],
        'aire_ultimo_anio': ultimo,
        'aire_serie': [{'lugar': l, 'anio': int(y), **v} for (l, y), v in sorted(serie.items(), key=lambda kv: (kv[0][0], kv[0][1]))]})


# =========================================================== ESCUCHA (F08)

def escucha():
    print('· escucha (Wikipedia)')
    arts = [('en', 'New_York_City', 'Nueva York (inglés)'), ('es', 'Nueva_York', 'Nueva York (español)'), ('en', 'Manhattan', 'Manhattan'),
            ('en', 'Brooklyn', 'Brooklyn'), ('en', 'Queens', 'Queens'), ('en', 'The_Bronx', 'Bronx'), ('en', 'Staten_Island', 'Staten Island')]
    base = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{}.wikipedia/all-access/user/{}/monthly/2024100100/2026093000'
    series = []
    for lang, art, etiqueta in arts:
        j = get(base.format(lang, art)).json()
        series.append({'articulo': f'{lang}:{art}', 'etiqueta': etiqueta,
                       'puntos': [{'mes': f"{i['timestamp'][:4]}-{i['timestamp'][4:6]}", 'vistas': i['views']} for i in j['items']]})
    guardar('escucha_interes.json', {
        '_meta': meta('F08', 'escucha_interes', conjunto_de_datos='Wikimedia Pageviews API (vistas mensuales por artículo)', entidad='Wikimedia Foundation',
                      url_api=base.format('en', 'New_York_City'), licencia='CC0 (dominio público)', trae_personas=False,
                      cobertura='Artículos de la ciudad y de los 5 boroughs (interés global, no geolocalizado)', periodo='2024-10 a 2026-09',
                      frecuencia_actualizacion='Mensual', unidad="vistas de página hechas por personas (agente 'user', excluye bots)",
                      nota='Proxy de interés externo, no de opinión: una vista no dice si el lector piensa bien o mal de la ciudad. Los picos suelen coincidir con noticias (elecciones, eventos, clima).'),
        'series': series})


# =========================================================== MOVILIDAD (F17 + F18)

def movilidad():
    print('· movilidad (MTA)')
    filas, url = soql(NYS, 'sayj-mze2', select='date_trunc_ym(date) as m,mode,sum(count) as n,count(count) as dias',
                      where="date >= '2020-03-01T00:00:00'", group='m,mode', order='m', limit=5000)
    modos = {'Subway': 'subte', 'Bus': 'bus', 'LIRR': 'lirr', 'MNR': 'metro_north', 'SIR': 'ferrocarril_staten', 'BT': 'puentes_tuneles', 'CRZ Entries': 'ingresos_zona_congestion', 'CBD Entries': 'ingresos_cbd', 'AAR': 'access_a_ride'}
    serie = collections.defaultdict(dict)
    for r in filas:
        k = modos.get(r['mode'])
        if k and r.get('n'):
            serie[r['m'][:7]][k] = round(float(r['n']) / int(r['dias']))   # promedio diario del mes
    mes_actual = HOY[:7]
    serie.pop(mes_actual, None)   # el mes en curso llega incompleto (p. ej. LIRR en 0 el día 1): se descarta
    ultimo = max(serie)
    est = ESTADO['estaciones']
    guardar('movilidad.json', {
        '_meta': meta('F17, F18', 'movilidad', conjunto_de_datos='MTA Daily Ridership and Traffic: Beginning 2020 + MTA Subway Stations',
                      entidad='Metropolitan Transportation Authority (MTA) vía Open NY (data.ny.gov)', url_api=f'{NYS}/sayj-mze2.json ; {NYS}/39hk-dx4f.json',
                      consulta_soql="$select=date_trunc_ym(date),mode,sum(count),count(count)&$where=date >= '2020-03-01'&$group=m,mode",
                      licencia='Open NY: términos de uso de datos del Estado de Nueva York (uso libre con atribución; ver data.ny.gov/download/77gx-ii52)', trae_personas=False,
                      cobertura='Red MTA (subte, bus, trenes, puentes y túneles); estaciones con borough y coordenadas', periodo=f'2020-03 a {ultimo}',
                      frecuencia_actualizacion='Diaria', unidad='promedio diario de viajes del mes',
                      nota='Se publica el promedio diario por mes (suma/días con dato) para que meses de distinta duración sean comparables. El conjunto anterior (vxuj-8kew) dejó de actualizarse en enero de 2025 y se reemplazó por este. "ingresos_zona_congestion" existe desde el peaje de congestión (5-ene-2025). Estaciones: filas del dataset MTA (una por andén/línea); la MTA comunica 472 estaciones porque cuenta complejos de otra forma.'),
        'serie_mensual': [{'mes': m, **v} for m, v in sorted(serie.items())],
        'estaciones': {'filas_dataset': est['total'], 'por_borough': est['por_boro'], 'complejos_por_borough': est['complejos']}})


# =========================================================== FUENTES CANDIDATAS / DESCARTADAS (verificación)

def verificaciones():
    print('· verificación de candidatas y descartadas')
    v = {}
    def prueba(clave, fn):
        try:
            v[clave] = fn()
        except Exception as e:
            v[clave] = {'error': str(e)[:200]}
    prueba('F11_acris', lambda: soql(NYC, 'bnx9-e6tj', select="recorded_borough,count(*) as n,sum(case(document_amt::number > 0, 1, true, 0)) as con_monto",
                                     where="doc_type='DEED' AND recorded_datetime between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'", group='recorded_borough')[0])
    prueba('F12_calls', lambda: soql(NYC, 'n2zq-pubd', select='count(*) as n')[0])
    prueba('F21_census_api', lambda: (lambda r: {'status': r.status_code, 'location': r.headers.get('Location')})(
        requests.get('https://api.census.gov/data/2024/acs/acs5?get=NAME,B19013_001E&for=county:061&in=state:36', allow_redirects=False, timeout=60)))
    prueba('F22_mta_viejo', lambda: soql(NYS, 'vxuj-8kew', select='max(date) as ultima')[0])
    prueba('F23_dob_bis', lambda: soql(NYC, 'ic3t-wcy2', select='count(*) as n', where="pre__filing_date like '%/2025'")[0])
    prueba('F32_dob_permisos', lambda: soql(NYC, 'ipu4-2q9a', select='count(*) as n', where="issuance_date like '%/2025'")[0])
    prueba('F25_pob_proyeccion', lambda: soql(NYC, 'xywu-7bv9', select='borough,_2020', where="age_group='Total Population'")[0])
    guardar('verificaciones.json', {'_meta': meta('F11, F12, F21, F22, F23, F25, F32', 'verificaciones',
                                                   nota='Pruebas de vida de las fuentes que NO alimentan el tablero, para dejar evidencia de por qué quedaron fuera.'), 'resultados': v})


# =========================================================== ATLAS DE DISTRITOS (une todo por PUMA)

def atlas():
    print('· atlas de 55 distritos')
    filas = []
    for c, p in sorted(ESTADO['pumas'].items()):
        pob = p['poblacion_acs'] or 0
        por1k = lambda x: r1(x / pob * 1000) if pob else None
        v = ESTADO.get('vial_puma', {}).get(c, collections.Counter()); d = ESTADO.get('delitos_puma', {}).get(c, collections.Counter())
        aire = ESTADO.get('aire_puma', {}).get(c, {})
        fila = dict(p)
        fila.update({
            'solicitudes_311_por_1000': por1k(ESTADO.get('311_puma', {}).get(c, 0)),
            'delitos_por_1000': por1k(d['total']), 'delitos_graves_por_1000': por1k(d['graves']),
            'heridos_transito_por_10000': r1(v['heridos'] / pob * 1e4) if pob else None,
            'peatones_heridos_por_10000': r1(v['peatones_heridos'] / pob * 1e4) if pob else None,
            'arboles_calle_por_km2': r1(ESTADO.get('arboles_puma', {}).get(c, 0) / p['area_km2']) if p.get('area_km2') else None,
            'pm25': aire.get('pm25'), 'no2': aire.get('no2'),
            'viviendas_obra_nueva_por_1000': por1k(ESTADO.get('nb_puma', {}).get(c, 0)),
            'viviendas_asequibles_por_1000': por1k(ESTADO.get('hny_puma', {}).get(c, 0)),
        })
        filas.append(fila)
    guardar('distritos.json', {
        '_meta': meta('F10, F02, F03, F04, F05, F07, F15, F16, F19', 'distritos',
                      conjunto_de_datos='Atlas de los 55 distritos comunitarios (PUMA 2020) de NYC',
                      entidad='Construido por el equipo a partir de las fuentes citadas', url_api=ESTADO['acs_url_puma'], licencia='Hereda las licencias de sus fuentes (dominio público / NYC Open Data)',
                      trae_personas=False, cobertura='55 PUMA = 59 distritos comunitarios (DCP agrupa 4 pares: MN 1&2, MN 5&6, BX 1&2, BX 3&6)',
                      periodo='ACS 2020–2024; 311, choques y delitos 2025; aire último año; árboles 2015; vivienda asequible acumulada desde 2014',
                      frecuencia_actualizacion='Se reconstruye al correr scripts/construir_lago.py', unidad='ver diccionario',
                      nota='Las tasas por habitante usan la población del ACS del propio PUMA. 311, árboles, obra nueva y vivienda asequible llegan por distrito comunitario y se suman al PUMA que lo contiene; choques y delitos se asignan por coordenadas (punto en polígono) y la coordenada no se guarda. Aire: promedio simple de los distritos comunitarios del PUMA. Midtown (MN 5&6) tiene muy pocos residentes y mucha población flotante: sus tasas por 1.000 habitantes se disparan y deben leerse con cuidado.'),
        'datos': filas})


# =========================================================== CATÁLOGO + PAQUETE

def catalogo():
    guardar('catalogo.json', {'_meta': {'tabla': 'catalogo', 'fecha_prueba': HOY, 'nota': 'Espejo de la hoja "1. Fuentes" del diccionario. Una fila por fuente encontrada, entre o no al lago.'},
                              'fuentes': FUENTES})


def paquete():
    datos = {}
    for n in sorted(os.listdir(LAGO)):
        if n.endswith('.json'):
            datos[n[:-5]] = json.load(open(os.path.join(LAGO, n), encoding='utf-8'))
    geo = {}
    for n in sorted(os.listdir(os.path.join(LAGO, 'geo'))):
        geo[n.replace('.geojson', '')] = json.load(open(os.path.join(LAGO, 'geo', n), encoding='utf-8'))
    with open(os.path.join(LAGO, 'lago.js'), 'w', encoding='utf-8') as f:
        f.write('// Paquete generado por scripts/construir_lago.py — no editar a mano.\n')
        f.write('window.LAGO_PAQUETE=' + json.dumps({'generado': HOY, 'datos': datos, 'geo': geo}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'  ✓ lago.js ({os.path.getsize(os.path.join(LAGO, "lago.js")) / 1024:.0f} KB)')


TEMAS = {'vial': vial, '311': q311, 'delitos': delitos, 'vivienda': vivienda, 'rodajes': rodajes, 'ambiente': ambiente,
         'escucha': escucha, 'movilidad': movilidad, 'verificaciones': verificaciones}

if __name__ == '__main__':
    pedidos = sys.argv[1:] or list(TEMAS)
    geo(); demografia(); distritos_base()
    for t in pedidos:
        TEMAS[t]()
    if not sys.argv[1:]:
        atlas()
    catalogo(); paquete()
