"""Exploración · ingesta y lago con DuckDB, sobre los MISMOS datos.
    pip install duckdb            (en un entorno aislado)
    python exploracion/duckdb_prueba.py
1) Ingesta: DuckDB lee directamente la API de NYC Open Data (httpfs) y agrega choques de 2025 por borough;
   se compara con lo que escribió ingesta/pull_03_vial.py.
2) Lago: guarda el atlas en Parquet y compara tamaño con el JSON del contrato."""
import json, os, pathlib, time
import duckdb

RAIZ = pathlib.Path(__file__).resolve().parents[1]
con = duckdb.connect()
con.execute('INSTALL httpfs; LOAD httpfs;')

# 1) ingesta: SoQL agrega en el servidor; DuckDB lee el JSON que devuelve
# las comillas simples de SoQL chocan con las del literal SQL de DuckDB (se codifican como %27), y el * de count(*) DuckDB lo toma como comodín de archivos
url = ("https://data.cityofnewyork.us/resource/h9gi-nx95.json?$select=borough,count(collision_id)%20as%20n"
       "&$where=crash_date%20between%20%272025-01-01T00:00:00%27%20and%20%272025-12-31T23:59:59%27&$group=borough")
t = time.time()
filas = con.execute(f"SELECT coalesce(borough, '(sin borough)') AS borough, CAST(n AS INTEGER) AS n FROM read_json_auto('{url}') ORDER BY n DESC").fetchall()
print(f'DuckDB leyó la API en {time.time() - t:.1f} s:', filas)
lago = {f['borough']: f['colisiones'] for f in json.loads((RAIZ / 'lago' / 'seguridad_vial.json').read_text(encoding='utf-8'))['listas']['boroughs']['filas']}
print('Lago (pull_03_vial.py, que además ubica por coordenadas los choques sin borough):', lago)

# 2) lago en Parquet
atlas = json.loads((RAIZ / 'lago' / 'distritos.json').read_text(encoding='utf-8'))['listas']['distritos']['filas']
tmp = pathlib.Path(os.environ.get('TEMP', '/tmp')) / 'atlas_prueba.json'
tmp.write_text('\n'.join(json.dumps(f) for f in atlas), encoding='utf-8')
salida = RAIZ / 'exploracion' / 'salidas'; salida.mkdir(parents=True, exist_ok=True)
con.execute(f"COPY (SELECT * FROM read_json_auto('{tmp.as_posix()}', format='newline_delimited')) TO '{(salida / 'atlas.parquet').as_posix()}' (FORMAT PARQUET)")
print(f"JSON del contrato (lago/distritos.json): {(RAIZ / 'lago' / 'distritos.json').stat().st_size / 1024:.0f} KB con metadatos · filas solas: {tmp.stat().st_size / 1024:.0f} KB · Parquet: {(salida / 'atlas.parquet').stat().st_size / 1024:.0f} KB")
print(con.execute(f"SELECT borough, round(avg(pct_pobreza),1) AS pobreza_media, count(*) AS n FROM '{(salida / 'atlas.parquet').as_posix()}' GROUP BY 1 ORDER BY 2 DESC").fetchall())
