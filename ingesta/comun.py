"""Base común de la ingesta: consultas con reintentos, geometría ligera y el contrato del lago.

Contrato (ver contrato/CONTRATO.md): cada tema es un JSON con la misma forma
  tema, titulo, probado, fuentes[], cifras{}, series{}, listas{}, notas[], calidad[], excluido[]
y toda cifra, serie o columna declara valor/unidad, vigencia, fuente (ID del catálogo) y tipo:
  medido     sale de una API o descarga y no se transformó más allá de contar o sumar
  derivado   se calculó a partir de cifras medidas (tasas, porcentajes, diferencias)
  transcrito se copió a mano de una tabla oficial que no tiene API
  declarado  la afirma un comunicado; no se puede verificar con microdatos
  proxy      aproxima algo que no se mide directamente (y la nota dice qué)
"""
import json, math, os, re, sys, time, datetime, urllib.parse
import requests

for _flujo in (sys.stdout, sys.stderr):   # consolas de Windows (cp1252) no imprimen ✓
    try:
        _flujo.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAGO = os.path.join(RAIZ, 'lago')
HOY = datetime.date.today().isoformat()

NYC = 'https://data.cityofnewyork.us/resource'
NYS = 'https://data.ny.gov/resource'
ACS = 'https://api.censusreporter.org/1.0/data/show/acs2024_5yr'
ACS_VIGENCIA = 'ACS 2020–2024 (5 años)'

BOROUGHS = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']   # orden = código DCP 1..5
COD_BORO = {b: i + 1 for i, b in enumerate(BOROUGHS)}
ABREV = {'MN': 1, 'BX': 2, 'BK': 3, 'QN': 4, 'SI': 5}
# Censo 2020 (NYC DCP). La página oficial es dinámica y no se deja descargar: se transcribe (F09).
CENSO_2020 = {'Manhattan': 1694251, 'Bronx': 1472654, 'Brooklyn': 2736074, 'Queens': 2405464, 'Staten Island': 495747}
TIPOS = ('medido', 'derivado', 'transcrito', 'declarado', 'proxy')

_S = requests.Session()
_S.headers['User-Agent'] = 'CerebroNYC/2.0 (taller universitario de gobernanza de datos)'


# ------------------------------------------------------------------ red

def get(url, params=None, intentos=4, timeout=240, **kw):
    for i in range(intentos):
        try:
            r = _S.get(url, params=params, timeout=timeout, **kw)
            if r.status_code < 400 or r.status_code in (400, 403, 404):
                return r
        except requests.RequestException:
            if i == intentos - 1:
                raise
        time.sleep(3 * (i + 1))
    raise RuntimeError('sin respuesta: ' + url)


def soql(base, dataset, **params):
    p = {('$' + k if not k.startswith('$') else k): v for k, v in params.items()}
    r = get(f'{base}/{dataset}.json', p)
    r.raise_for_status()
    return r.json()


def consulta_legible(**params):
    return '&'.join(f'${k}={v}' for k, v in params.items())


def soql_paginado(base, dataset, pagina=50000, **params):
    filas, off = [], 0
    while True:
        lote = soql(base, dataset, limit=pagina, offset=off, **params)
        filas += lote
        if len(lote) < pagina:
            return filas
        off += pagina


# ------------------------------------------------------------------ normalización

def borough_norm(v):
    if v is None:
        return None
    s = str(v).strip().upper()
    tabla = {'MANHATTAN': 'Manhattan', 'NEW YORK': 'Manhattan', 'MN': 'Manhattan', '1': 'Manhattan', 'M': 'Manhattan',
             'BRONX': 'Bronx', 'THE BRONX': 'Bronx', 'BX': 'Bronx', '2': 'Bronx',
             'BROOKLYN': 'Brooklyn', 'KINGS': 'Brooklyn', 'BK': 'Brooklyn', '3': 'Brooklyn',
             'QUEENS': 'Queens', 'QN': 'Queens', '4': 'Queens', 'Q': 'Queens',
             'STATEN ISLAND': 'Staten Island', 'RICHMOND': 'Staten Island', 'SI': 'Staten Island', '5': 'Staten Island'}
    return tabla.get(s)


def cd_codigo(boro_cod, num):
    return int(boro_cod) * 100 + int(num)


def parse_cd(s, boro=None):
    """'01 BRONX' | '101' | 'QN-08' | '4' (+borough) → código DCP (201, 101, 408…). None si no es un distrito real (p. ej. parques 55+)."""
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


def r1(v, d=1):
    return None if v is None else round(v, d)


# ------------------------------------------------------------------ margen de error (ACS, nivel de confianza 90 %)
# Fórmulas del manual del ACS («Understanding and Using ACS Data», cap. 8).

def moe_suma(*moes):
    return math.sqrt(sum((m or 0) ** 2 for m in moes))


def moe_proporcion(x, y, mx, my):
    """X subconjunto de Y. Devuelve el MOE de X/Y (proporción, no porcentaje)."""
    if not y:
        return None
    p = x / y
    rad = mx ** 2 - p ** 2 * my ** 2
    if rad < 0:                       # el manual indica usar la fórmula de razón en ese caso
        rad = mx ** 2 + p ** 2 * my ** 2
    return math.sqrt(rad) / y


def moe_tasa(tasa, pob, moe_pob):
    """Tasa = conteo administrativo (sin error muestral) / población ACS (con MOE)."""
    if tasa is None or not pob:
        return None
    return tasa * (moe_pob or 0) / pob


# ------------------------------------------------------------------ geometría

def _dp(pts, tol):
    if len(pts) < 5:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    pila = [(0, len(pts) - 1)]
    while pila:
        a, b = pila.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n = math.hypot(dx, dy) or 1e-12
        dmax, idx = 0, None
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / n
            if d > dmax:
                dmax, idx = d, i
        if idx is not None and dmax > tol:
            keep[idx] = True
            pila += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def simplificar(geom, tol=0.0003, dec=5):
    def anillo(r):
        m = len(r) // 2       # un anillo cerrado tiene extremos iguales: se simplifica en dos mitades
        s = _dp(r[:m + 1], tol) + _dp(r[m:], tol)[1:]
        s = [[round(x, dec), round(y, dec)] for x, y in s]
        return s if len(s) >= 4 else None
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    out = []
    for p in polys:
        anillos = [a for a in (anillo(r) for r in p) if a]
        if anillos:
            out.append(anillos)
    return {'type': 'MultiPolygon', 'coordinates': out}


def _en_anillo(x, y, r):
    dentro, j = False, len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi:
            dentro = not dentro
        j = i
    return dentro


class IndicePoligonos:
    """Punto-en-polígono con prefiltro por caja."""

    def __init__(self, features, clave):
        self.items = []
        for f in features:
            g = f['geometry']
            for p in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
                xs = [c[0] for c in p[0]]; ys = [c[1] for c in p[0]]
                self.items.append((min(xs), min(ys), max(xs), max(ys), p, f['properties'][clave]))

    def buscar(self, x, y):
        for x0, y0, x1, y1, p, k in self.items:
            if x0 <= x <= x1 and y0 <= y <= y1 and _en_anillo(x, y, p[0]) and not any(_en_anillo(x, y, h) for h in p[1:]):
                return k
        return None


# ------------------------------------------------------------------ contrato

def C(descripcion, unidad, tipo_dato='Entero', tipo='medido', original='', transformacion='Ninguna',
      clasificacion='Pública', pregunta='P1', fuente=None, vigencia=None, moe=None, decimales=None, etiqueta=None):
    """Definición de una columna: se escribe UNA vez, en el script que la produce, y viaja dentro del lago."""
    d = {'descripcion': descripcion, 'unidad': unidad, 'tipo_dato': tipo_dato, 'tipo': tipo, 'original': original,
         'transformacion': transformacion, 'clasificacion': clasificacion, 'pregunta': pregunta}
    for k, v in (('fuente', fuente), ('vigencia', vigencia), ('moe', moe), ('decimales', decimales), ('etiqueta', etiqueta)):
        if v is not None:
            d[k] = v
    return d


def COL_BORO(fuente, original='borough', pregunta='P1', otros=False):
    return C('Borough (distrito) de la Ciudad de Nueva York' + (' o "No especificado"' if otros else ''), 'nombre', 'Texto', 'medido', original,
             'Mayúsculas, códigos 1–5 y nombres de condado se unifican al nombre del borough', pregunta=pregunta, fuente=fuente)


class Tema:
    def __init__(self, tema, titulo):
        self.d = {'tema': tema, 'titulo': titulo, 'probado': HOY, 'fuentes': [], 'cifras': {}, 'series': {}, 'listas': {},
                  'notas': [], 'calidad': [], 'excluido': []}

    def fuente(self, fid, vigencia, url=None, consulta=None, estado='vivo'):
        """Se llama DESPUÉS de que la fuente respondió: registra el día de la prueba."""
        from catalogo import POR_ID
        c = POR_ID[fid]
        self.d['fuentes'] = [f for f in self.d['fuentes'] if f['id'] != fid]
        self.d['fuentes'].append({'id': fid, 'nombre': c['nombre'], 'entidad': c['entidad'], 'url': url or c['url'],
                                  'consulta': consulta, 'estado': estado, 'licencia': c['licencia'], 'personas': c['personas'],
                                  'vigencia': vigencia, 'probado': HOY})

    def cifra(self, clave, valor, unidad, vigencia, fuente, tipo, descripcion, moe=None, formula=None, pregunta='P1', decimales=None):
        assert tipo in TIPOS, tipo
        c = {'valor': valor, 'unidad': unidad, 'vigencia': vigencia, 'fuente': fuente, 'tipo': tipo, 'descripcion': descripcion, 'pregunta': pregunta}
        if moe is not None:
            c['moe'] = moe
        if formula:
            c['formula'] = formula
        if decimales is not None:
            c['decimales'] = decimales
        self.d['cifras'][clave] = c

    def serie(self, clave, puntos, unidad, vigencia, fuente, tipo, descripcion, x='mes', pregunta='P1'):
        assert tipo in TIPOS, tipo
        self.d['series'][clave] = {'descripcion': descripcion, 'unidad': unidad, 'vigencia': vigencia, 'fuente': fuente,
                                   'tipo': tipo, 'x': x, 'pregunta': pregunta, 'puntos': [[p[0], p[1]] for p in puntos]}

    def lista(self, clave, filas, columnas, vigencia, fuente, descripcion, tipo='medido'):
        sobran = {k for f in filas for k in f} - set(columnas)
        assert not sobran, f'{clave}: columnas sin definir {sobran}'
        for k, c in columnas.items():
            c.setdefault('fuente', fuente)
            c.setdefault('vigencia', vigencia)
        self.d['listas'][clave] = {'descripcion': descripcion, 'vigencia': vigencia, 'fuente': fuente, 'tipo': tipo,
                                   'columnas': columnas, 'filas': filas}

    def nota(self, t):
        self.d['notas'].append(t)

    def calidad(self, t):
        self.d['calidad'].append(t)

    def excluir(self, campo, fuente, razon):
        self.d['excluido'].append({'campo': campo, 'fuente': fuente, 'razon': razon})

    def guardar(self, nombre=None):
        guardar_json(nombre or self.d['tema'] + '.json', self.d)
        return self.d


def guardar_json(nombre, obj):
    ruta = os.path.join(LAGO, nombre)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    geo = nombre.startswith('geo/')
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=None if geo else 1, separators=(',', ':') if geo else None)
    print(f'  ✓ {nombre}  ({os.path.getsize(ruta) / 1024:.0f} KB)')


def leer(nombre):
    with open(os.path.join(LAGO, nombre), encoding='utf-8') as f:
        return json.load(f)


def filas(tema, lista):
    return leer(tema + '.json')['listas'][lista]['filas']


def pumas():
    """Propiedades de los 55 PUMA, índice punto-en-polígono y tabla distrito comunitario → PUMA (salen de pull_01_geo)."""
    feats = leer('geo/distritos_puma.geojson')['features']
    props = {f['properties']['puma']: f['properties'] for f in feats}
    cd = {c: p['puma'] for p in props.values() for c in p['distritos_comunitarios']}
    return props, IndicePoligonos(feats, 'puma'), cd


def sumar_por_puma(valores_por_cd, cd_a_puma):
    out = {}
    for cd, v in valores_por_cd.items():
        p = cd_a_puma.get(cd)
        if p:
            out[p] = out.get(p, 0) + v
    return out


def en_nyc(x, y):
    return -74.3 < x < -73.6 and 40.4 < y < 41.0


def geo_meta(tema, titulo, fuentes, columnas, vigencia):
    """Miembros extra del contrato dentro de un GeoJSON (los GeoJSON admiten «foreign members»)."""
    from catalogo import POR_ID
    return {'tema': tema, 'titulo': titulo, 'probado': HOY, 'vigencia': vigencia,
            'fuentes': [{'id': f, 'nombre': POR_ID[f]['nombre'], 'entidad': POR_ID[f]['entidad'], 'url': POR_ID[f]['url'],
                         'estado': 'vivo', 'licencia': POR_ID[f]['licencia'], 'personas': POR_ID[f]['personas'],
                         'vigencia': vigencia, 'probado': HOY} for f in fuentes],
            'columnas': columnas}


def ejecutar(main):
    """Punto de entrada común: cada pull_*.py se puede correr solo."""
    t = time.time()
    try:
        main()
    except Exception as e:
        print(f'✗ {os.path.basename(sys.argv[0])}: {e}', file=sys.stderr)
        raise
    print(f'  ({time.time() - t:.0f} s)')
