"""Ingesta · pruebas de vida de las fuentes que NO alimentan cifras del tablero (candidatas, descartadas y capas
visuales en vivo). Deja evidencia, con fecha, de por qué cada una quedó donde quedó."""
import requests
from comun import *


def main():
    print('· pruebas de vida')
    t = Tema('verificaciones', 'Pruebas de vida de candidatas, descartadas y capas en vivo')
    filas = []

    def prueba(fid, que, fn):
        try:
            estado, resultado = fn()
        except Exception as e:
            estado, resultado = 'error', str(e)[:180]
        filas.append({'fuente': fid, 'prueba': que, 'respuesta': str(estado), 'resultado': resultado, 'probado': HOY})
        if estado not in ('error',):
            from catalogo import POR_ID
            t.fuente(fid, 'prueba de vida', url=POR_ID[fid]['url'], estado='vivo' if str(estado).startswith(('2', '3')) else 'caido')

    def http(url, **kw):
        r = requests.get(url, timeout=60, allow_redirects=False, headers={'User-Agent': 'CerebroNYC/2.0'}, **kw)
        return r.status_code, r

    def acris():
        f = soql(NYC, 'bnx9-e6tj', select='recorded_borough,count(*) as n,sum(case(document_amt::number > 0, 1, true, 0)) as con_monto',
                 where="doc_type='DEED' AND recorded_datetime between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'", group='recorded_borough')
        n = sum(int(x['n']) for x in f); m = sum(int(float(x['con_monto'] or 0)) for x in f); mn = sum(int(x['n']) for x in f if x['recorded_borough'] == '1')
        return 200, f'{n} escrituras (DEED) en 2025; {m} con monto > 0; {100 * mn / n:.1f} % aparecen en Manhattan'
    prueba('F11', 'Escrituras de 2025 y cuántas traen monto', acris)
    prueba('F12', 'Filas del año en curso', lambda: (200, f"{soql(NYC, 'n2zq-pubd', select='count(*) as n')[0]['n']} llamadas registradas"))
    prueba('F21', 'Pedir el ACS sin llave', lambda: (lambda s, r: (s, f"redirige a {r.headers.get('Location')}"))(
        *http('https://api.census.gov/data/2024/acs/acs5?get=NAME,B19013_001E&for=county:061&in=state:36')))
    prueba('F22', 'Última fecha publicada', lambda: (200, f"última fecha: {soql(NYS, 'vxuj-8kew', select='max(date) as u')[0]['u'][:10]}"))
    def conteo(ds, where, texto):
        n = soql(NYC, ds, select='count(*) as n', where=where)[0]['n']
        return 200, f'{n} {texto}'
    prueba('F23', 'Radicaciones de 2025 (fecha guardada como texto)', lambda: conteo('ic3t-wcy2', "pre__filing_date like '%/2025'", 'radicaciones con filtro de texto'))
    prueba('F25', 'Valor de la columna 2020', lambda: (200, 'NYC Total = ' + next(x['_2020'] for x in soql(NYC, 'xywu-7bv9', select='borough,_2020', where="age_group='Total Population'") if 'Total' in x['borough']) + ' (el Censo 2020 dice 8.804.190)'))
    prueba('F32', 'Permisos de 2025 (fecha guardada como texto)', lambda: conteo('ipu4-2q9a', "issuance_date like '%/2025'", 'permisos con filtro de texto'))
    prueba('F24', 'Tiempo actual en Central Park', lambda: (lambda s, r: (s, f"{r.json()['current']['temperature_2m']} °C al probar"))(
        *http('https://api.open-meteo.com/v1/forecast?latitude=40.7831&longitude=-73.9712&current=temperature_2m')))
    prueba('F28', 'Estilo del mapa base', lambda: (lambda s, r: (s, f"estilo con {len(r.json().get('layers', []))} capas"))(*http('https://tiles.openfreemap.org/styles/liberty')))
    prueba('F31', 'Una tesela satelital de Manhattan', lambda: (lambda s, r: (s, f"{r.headers.get('Content-Type')} de {len(r.content)} bytes"))(
        *http('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1539/1205')))
    t.lista('pruebas', filas, {
        'fuente': C('ID de la fuente probada', 'código F##', 'Código', 'medido', '(propio)', 'Ninguna', pregunta='G', fuente=None),
        'prueba': C('Qué se le pidió a la fuente', 'texto', 'Texto', 'medido', '(propio)', 'Ninguna', pregunta='G'),
        'respuesta': C('Código HTTP de la respuesta (o «error»)', 'código HTTP', 'Código', 'medido', '(respuesta HTTP)', 'Ninguna', pregunta='G'),
        'resultado': C('Lo que devolvió, resumido', 'texto', 'Texto', 'medido', '(respuesta)', 'Recortado a 180 caracteres', pregunta='G'),
        'probado': C('Día de la prueba', 'AAAA-MM-DD', 'Fecha', 'medido', '(sistema)', 'Fecha del día en que corrió el script', pregunta='G'),
    }, HOY, [f['fuente'] for f in filas], 'Pruebas de vida de las fuentes que no alimentan cifras del tablero')
    for c in t.d['listas']['pruebas']['columnas'].values():
        c['fuente'] = 'cada fila'
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
