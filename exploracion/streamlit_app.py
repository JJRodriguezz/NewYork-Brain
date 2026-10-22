"""Exploración · vistas con Streamlit, sobre los MISMOS datos del lago (lago/distritos.json y la geometría de los PUMA).
    pip install streamlit        (en un entorno aislado)
    streamlit run exploracion/streamlit_app.py
Resultado y decisión: ver README, «Bitácora de exploración»."""
import json, pathlib
import pandas as pd
import pydeck as pdk
import streamlit as st

LAGO = pathlib.Path(__file__).resolve().parents[1] / 'lago'
atlas = json.loads((LAGO / 'distritos.json').read_text(encoding='utf-8'))['listas']['distritos']
geo = json.loads((LAGO / 'geo' / 'distritos_puma.geojson').read_text(encoding='utf-8'))
cols = {k: c for k, c in atlas['columnas'].items() if c.get('etiqueta') and not k.endswith('_moe')}

st.set_page_config(page_title='Cerebro NYC · prueba en Streamlit', layout='wide')
st.title('Cerebro NYC · prueba en Streamlit')
k = st.selectbox('Indicador', list(cols), format_func=lambda x: cols[x]['etiqueta'])
c = cols[k]
df = pd.DataFrame(atlas['filas'])
st.caption(f"{c['descripcion']} · {c['unidad']} · fuente {', '.join(c['fuente'] if isinstance(c['fuente'], list) else [c['fuente']])} · vigencia {c['vigencia']}")

v = df.set_index('puma')[k]
lo, hi = v.min(), v.max()
for f in geo['features']:
    x = v.get(f['properties']['puma'])
    t = 0 if x is None or hi == lo else (x - lo) / (hi - lo)
    f['properties']['color'] = [int(251 - 140 * t), int(240 - 196 * t), int(217 - 203 * t), 170]
    f['properties']['valor'] = None if x is None else round(float(x), 2)
st.pydeck_chart(pdk.Deck(layers=[pdk.Layer('GeoJsonLayer', geo, get_fill_color='properties.color', get_line_color=[255, 255, 255], pickable=True)],
                         initial_view_state=pdk.ViewState(latitude=40.70, longitude=-73.94, zoom=9.3),
                         tooltip={'text': '{nombre}\n{valor}'}))
moe = c.get('moe')
tabla = df[['nombre', 'borough', k] + ([moe] if moe else [])].sort_values(k, ascending=False)
st.dataframe(tabla, use_container_width=True, hide_index=True)
st.caption('Prueba de exploración: no reemplaza al sitio. El margen de error se ve como columna, pero ordenar la tabla sigue sugiriendo un orden que el error no sostiene.')
