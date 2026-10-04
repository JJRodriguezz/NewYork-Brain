"""Utilidades compartidas: consultas SoQL con reintentos, geometría ligera y escritura del lago."""
import json, math, time, datetime, os, urllib.parse
import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAGO = os.path.join(RAIZ, 'lago')
HOY = datetime.date.today().isoformat()

NYC = 'https://data.cityofnewyork.us/resource'
NYS = 'https://data.ny.gov/resource'

BOROUGHS = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']   # orden = código 1..5
COD_BORO = {b: i + 1 for i, b in enumerate(BOROUGHS)}
ABREV = {'MN': 1, 'BX': 2, 'BK': 3, 'QN': 4, 'SI': 5}

_S = requests.Session()
_S.headers['User-Agent'] = 'CerebroNYC/1.0 (taller academico de gobernanza de datos)'


def get(url, params=None, intentos=4, timeout=240):
    for i in range(intentos):
        try:
            r = _S.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code in (400, 403, 404):
                r.raise_for_status()
        except requests.HTTPError:
            raise
        except Exception as e:  # timeouts y cortes de red: reintentar
            if i == intentos - 1:
                raise
        time.sleep(3 * (i + 1))
    raise RuntimeError('sin respuesta: ' + url)


def soql(base, dataset, **params):
    """Consulta SoQL. Devuelve (filas, url_legible)."""
    p = {('$' + k if not k.startswith('$') else k): v for k, v in params.items()}
    url = f'{base}/{dataset}.json'
    r = get(url, p)
    return r.json(), url + '?' + urllib.parse.urlencode(p, safe="$,()*'=:<>")


def soql_paginado(base, dataset, pagina=50000, **params):
    filas, off = [], 0
    while True:
        lote, _ = soql(base, dataset, limit=pagina, offset=off, **params)
        filas += lote
        if len(lote) < pagina:
            return filas
        off += pagina


def borough_norm(v):
    """Normaliza las mil formas en que las fuentes escriben un borough."""
    if v is None:
        return None
    s = str(v).strip().upper()
    tabla = {'MANHATTAN': 'Manhattan', 'NEW YORK': 'Manhattan', 'MN': 'Manhattan', '1': 'Manhattan',
             'BRONX': 'Bronx', 'THE BRONX': 'Bronx', 'BX': 'Bronx', '2': 'Bronx',
             'BROOKLYN': 'Brooklyn', 'KINGS': 'Brooklyn', 'BK': 'Brooklyn', '3': 'Brooklyn',
             'QUEENS': 'Queens', 'QN': 'Queens', '4': 'Queens',
             'STATEN ISLAND': 'Staten Island', 'RICHMOND': 'Staten Island', 'SI': 'Staten Island', '5': 'Staten Island'}
    return tabla.get(s)


def cd_codigo(boro_cod, num):
    """Código de distrito comunitario estilo DCP: 101 = Manhattan CD1, 412 = Queens CD12."""
    return int(boro_cod) * 100 + int(num)


# ---------------------------------------------------------------- geometría

def _dp(pts, tol):
    """Douglas-Peucker iterativo sobre una lista de [lon, lat]."""
    if len(pts) < 5:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
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


def simplificar(geom, tol=0.0003, dec=5, min_area=0.0):
    def anillo(r):
        # un anillo cerrado tiene extremos iguales y Douglas-Peucker lo colapsa: se simplifica en dos mitades
        m = len(r) // 2
        s = _dp(r[:m + 1], tol) + _dp(r[m:], tol)[1:]
        s = [[round(x, dec), round(y, dec)] for x, y in s]
        return s if len(s) >= 4 else None

    def poligono(p):
        anillos = [a for a in (anillo(r) for r in p) if a]
        if not anillos:
            return None
        if min_area and abs(area_anillo(anillos[0])) < min_area:
            return None
        return anillos

    if geom['type'] == 'Polygon':
        polys = [geom['coordinates']]
    else:
        polys = geom['coordinates']
    out = [q for q in (poligono(p) for p in polys) if q]
    return {'type': 'MultiPolygon', 'coordinates': out}


def area_anillo(r):
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2


def _en_anillo(x, y, r):
    dentro = False
    j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi:
            dentro = not dentro
        j = i
    return dentro


class IndicePoligonos:
    """Punto-en-polígono con prefiltro por caja: suficiente para ~10^5 puntos en Python puro."""

    def __init__(self, features, clave):
        self.items = []
        for f in features:
            g = f['geometry']
            polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
            for p in polys:
                xs = [c[0] for c in p[0]]; ys = [c[1] for c in p[0]]
                self.items.append((min(xs), min(ys), max(xs), max(ys), p, f['properties'][clave]))

    def buscar(self, x, y):
        for x0, y0, x1, y1, p, k in self.items:
            if x0 <= x <= x1 and y0 <= y <= y1 and _en_anillo(x, y, p[0]) and not any(_en_anillo(x, y, h) for h in p[1:]):
                return k
        return None


# ---------------------------------------------------------------- escritura

def guardar(nombre, obj):
    ruta = os.path.join(LAGO, nombre)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1 if not nombre.startswith('geo/') else None,
                  separators=None if not nombre.startswith('geo/') else (',', ':'))
    print(f'  ✓ {nombre}  ({os.path.getsize(ruta) / 1024:.0f} KB)')


def meta(id_fuente, tabla, **kw):
    m = {'id_fuente': id_fuente, 'tabla': tabla, 'fecha_prueba': HOY}
    m.update(kw)
    return m


def r1(v, d=1):
    return None if v is None else round(v, d)
