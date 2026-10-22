"""American Community Survey (F10) vía Census Reporter: estimaciones y margen de error al 90 %.

Las medianas vienen con su MOE publicado. Los porcentajes los calculamos nosotros, y su MOE sale de las
fórmulas del Census Bureau para proporciones (comun.moe_proporcion) y sumas (comun.moe_suma).
"""
from comun import C, get, moe_suma, moe_proporcion, ACS, ACS_VIGENCIA

TABLAS = 'B01003,B01002,B19013,B25064,B25071,B25070,B17001,B25003,B08301,B05002,B03002,B08201'


def descargar(geo_ids):
    r = get(ACS, {'table_ids': TABLAS, 'geo_ids': geo_ids})
    r.raise_for_status()
    j = r.json()
    if 'data' not in j:
        raise RuntimeError(f'Census Reporter no devolvió datos: {str(j)[:200]}')
    return j, f'{ACS}?table_ids={TABLAS}&geo_ids={geo_ids}'


def _ent(v):
    return int(v) if isinstance(v, float) and v.is_integer() else v


def indicadores(d):
    e = lambda t, c: _ent(d[t]['estimate'].get(f'{t}{c:03d}'))
    m = lambda t, c: _ent(d[t]['error'].get(f'{t}{c:03d}')) or 0

    def pct(t, num, den=1):
        x, y = e(t, num), e(t, den)
        if x is None or not y:
            return None, None
        return round(100 * x / y, 1), round(100 * moe_proporcion(x, y, m(t, num), m(t, den)), 1)

    out = {
        'poblacion_acs': e('B01003', 1), 'poblacion_acs_moe': m('B01003', 1),
        'edad_mediana': e('B01002', 1), 'edad_mediana_moe': m('B01002', 1),
        'ingreso_mediano': e('B19013', 1), 'ingreso_mediano_moe': m('B19013', 1),
        'alquiler_mediano': e('B25064', 1), 'alquiler_mediano_moe': m('B25064', 1),
        'alquiler_pct_ingreso': e('B25071', 1), 'alquiler_pct_ingreso_moe': m('B25071', 1),
    }
    # carga de alquiler: tramos 30–34,9 / 35–39,9 / 40–49,9 / 50+ sobre los hogares con cálculo posible
    x = sum(e('B25070', c) or 0 for c in (7, 8, 9, 10)); mx = moe_suma(*(m('B25070', c) for c in (7, 8, 9, 10)))
    y = (e('B25070', 1) or 0) - (e('B25070', 11) or 0); my = moe_suma(m('B25070', 1), m('B25070', 11))
    out['pct_hogares_con_carga_alquiler'] = round(100 * x / y, 1) if y else None
    out['pct_hogares_con_carga_alquiler_moe'] = round(100 * moe_proporcion(x, y, mx, my), 1) if y else None
    for clave, (t, num, den) in {'pct_pobreza': ('B17001', 2, 1), 'pct_inquilinos': ('B25003', 3, 1), 'pct_transporte_publico': ('B08301', 10, 1),
                                 'pct_teletrabajo': ('B08301', 21, 1), 'pct_hogares_sin_auto': ('B08201', 2, 1), 'pct_nacidos_extranjero': ('B05002', 13, 1),
                                 'pct_hispano': ('B03002', 12, 1), 'pct_blanco_nh': ('B03002', 3, 1), 'pct_negro_nh': ('B03002', 4, 1),
                                 'pct_asiatico_nh': ('B03002', 6, 1)}.items():
        out[clave], out[clave + '_moe'] = pct(t, num, den)
    return out


ETIQUETAS = {'poblacion_acs': 'Población', 'edad_mediana': 'Edad mediana', 'ingreso_mediano': 'Ingreso mediano del hogar', 'alquiler_mediano': 'Alquiler mediano', 'alquiler_pct_ingreso': 'Alquiler como % del ingreso', 'pct_hogares_con_carga_alquiler': 'Hogares con carga de alquiler', 'pct_pobreza': 'Pobreza', 'pct_inquilinos': 'Hogares inquilinos', 'pct_transporte_publico': 'Van al trabajo en transporte público', 'pct_teletrabajo': 'Trabajan desde casa', 'pct_hogares_sin_auto': 'Hogares sin auto', 'pct_nacidos_extranjero': 'Nacidos en el extranjero', 'pct_hispano': 'Hispanos o latinos', 'pct_blanco_nh': 'Blancos no hispanos', 'pct_negro_nh': 'Negros no hispanos', 'pct_asiatico_nh': 'Asiáticos no hispanos'}


def _par(clave, desc, unidad, tipo_dato, tipo, original, transf, preg, dec=None):
    """Columna + su columna de margen de error."""
    return {clave: C(desc, unidad, tipo_dato, tipo, original, transf, pregunta=preg, fuente='F10', vigencia=ACS_VIGENCIA, moe=clave + '_moe', decimales=dec, etiqueta=ETIQUETAS[clave]),
            clave + '_moe': C(f'Margen de error al 90 % de «{desc.lower()}»', unidad, tipo_dato, tipo, original.replace('E', 'M') if original.startswith('B') else 'error',
                              'Medianas: publicado por el ACS. Porcentajes: fórmula de proporción del Census Bureau', pregunta=preg, fuente='F10', vigencia=ACS_VIGENCIA, decimales=dec)}


def columnas():
    cols = {}
    P = 'Cociente ×100, 1 decimal; MOE con la fórmula de proporción del ACS'
    for args in [
        ('poblacion_acs', 'Población estimada por el ACS (promedio 2020–2024)', 'personas', 'Entero', 'medido', 'B01003_001E', 'Ninguna', 'P8'),
        ('edad_mediana', 'Edad mediana', 'años', 'Decimal', 'medido', 'B01002_001E', 'Ninguna', 'P8', 1),
        ('ingreso_mediano', 'Ingreso mediano anual del hogar', 'US$ de 2024', 'Entero', 'medido', 'B19013_001E', 'Ninguna', 'P2'),
        ('alquiler_mediano', 'Alquiler bruto mediano mensual (renta + servicios)', 'US$/mes', 'Entero', 'medido', 'B25064_001E', 'Ninguna', 'P2'),
        ('alquiler_pct_ingreso', 'Alquiler bruto mediano como porcentaje del ingreso del hogar', '%', 'Decimal', 'medido', 'B25071_001E', 'Ninguna', 'P2', 1),
        ('pct_hogares_con_carga_alquiler', 'Hogares inquilinos que pagan 30 % o más de su ingreso en alquiler', '%', 'Decimal', 'derivado', 'B25070_007E..010E / (B25070_001E − B25070_011E)', 'Suma de tramos ≥30 % (MOE por suma) sobre hogares con cálculo posible; ' + P, 'P2', 1),
        ('pct_pobreza', 'Personas bajo la línea de pobreza federal', '%', 'Decimal', 'derivado', 'B17001_002E / B17001_001E', P, 'P2', 1),
        ('pct_inquilinos', 'Hogares que alquilan su vivienda', '%', 'Decimal', 'derivado', 'B25003_003E / B25003_001E', P, 'P2', 1),
        ('pct_transporte_publico', 'Trabajadores que van al trabajo en transporte público', '%', 'Decimal', 'derivado', 'B08301_010E / B08301_001E', P, 'P5', 1),
        ('pct_teletrabajo', 'Trabajadores que trabajan desde casa', '%', 'Decimal', 'derivado', 'B08301_021E / B08301_001E', P, 'P5', 1),
        ('pct_hogares_sin_auto', 'Hogares sin vehículo disponible', '%', 'Decimal', 'derivado', 'B08201_002E / B08201_001E', P, 'P5', 1),
        ('pct_nacidos_extranjero', 'Población nacida fuera de EE. UU.', '%', 'Decimal', 'derivado', 'B05002_013E / B05002_001E', P, 'P8', 1),
        ('pct_hispano', 'Población hispana o latina (de cualquier raza)', '%', 'Decimal', 'derivado', 'B03002_012E / B03002_001E', P + '. Dato agregado y autodeclarado; nunca a nivel de persona', 'P8', 1),
        ('pct_blanco_nh', 'Población blanca no hispana', '%', 'Decimal', 'derivado', 'B03002_003E / B03002_001E', P, 'P8', 1),
        ('pct_negro_nh', 'Población negra o afroamericana no hispana', '%', 'Decimal', 'derivado', 'B03002_004E / B03002_001E', P, 'P8', 1),
        ('pct_asiatico_nh', 'Población asiática no hispana', '%', 'Decimal', 'derivado', 'B03002_006E / B03002_001E', P, 'P8', 1),
    ]:
        cols.update(_par(*args))
    return cols
