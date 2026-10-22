"""Exploración · mapa con kepler.gl sobre los MISMOS datos del lago.
    pip install keplergl          (en un entorno aislado)
    python exploracion/kepler_mapa.py   → exploracion/salidas/kepler_distritos.html
El HTML exportado LLEVA ADENTRO los datos: lo que se publique ya no vive solo en el navegador de quien lo abrió."""
import json, pathlib
from keplergl import KeplerGl

RAIZ = pathlib.Path(__file__).resolve().parents[1]
atlas = json.loads((RAIZ / 'lago' / 'distritos.json').read_text(encoding='utf-8'))['listas']['distritos']['filas']
geo = json.loads((RAIZ / 'lago' / 'geo' / 'distritos_puma.geojson').read_text(encoding='utf-8'))
por = {f['puma']: f for f in atlas}
for f in geo['features']:
    a = por.get(f['properties']['puma'], {})
    for k in ('pct_pobreza', 'pct_pobreza_moe', 'pct_hogares_con_carga_alquiler', 'delitos_graves_por_1000', 'pm25'):
        f['properties'][k] = a.get(k)
geo_limpio = {'type': 'FeatureCollection', 'features': geo['features']}   # sin los miembros extra del contrato
mapa = KeplerGl(height=700, data={'distritos': geo_limpio})
salida = RAIZ / 'exploracion' / 'salidas'; salida.mkdir(parents=True, exist_ok=True)
mapa.save_to_html(file_name=str(salida / 'kepler_distritos.html'), read_only=False)
print('✓', salida / 'kepler_distritos.html')
