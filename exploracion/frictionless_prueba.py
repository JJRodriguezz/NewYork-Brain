"""Exploración · verificación con Frictionless, sobre los MISMOS datos (el atlas de distritos).
    pip install frictionless      (en un entorno aislado)
    python exploracion/frictionless_prueba.py
Escribe el atlas como CSV con un esquema (tipos y rangos), lo valida, y luego lo rompe a propósito para ver si lo atrapa."""
import csv, json, pathlib
from frictionless import Resource, Schema, validate

RAIZ = pathlib.Path(__file__).resolve().parents[1]
salida = RAIZ / 'exploracion' / 'salidas'; salida.mkdir(parents=True, exist_ok=True)
atlas = json.loads((RAIZ / 'lago' / 'distritos.json').read_text(encoding='utf-8'))['listas']['distritos']
campos = ['puma', 'borough', 'pct_pobreza', 'pct_hogares_con_carga_alquiler', 'delitos_graves_por_1000', 'pm25']
esquema = Schema.from_descriptor({'fields': [
    {'name': 'puma', 'type': 'string', 'constraints': {'required': True, 'unique': True, 'pattern': '^4[1-5][0-9]{2}$'}},
    {'name': 'borough', 'type': 'string', 'constraints': {'enum': ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']}},
    {'name': 'pct_pobreza', 'type': 'number', 'constraints': {'minimum': 0, 'maximum': 100}},
    {'name': 'pct_hogares_con_carga_alquiler', 'type': 'number', 'constraints': {'minimum': 0, 'maximum': 100}},
    {'name': 'delitos_graves_por_1000', 'type': 'number', 'constraints': {'minimum': 0}},
    {'name': 'pm25', 'type': 'number', 'constraints': {'minimum': 2, 'maximum': 20}},
]})


def escribir(nombre, filas):
    ruta = salida / nombre
    with open(ruta, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=campos); w.writeheader()
        for x in filas:
            w.writerow({k: x[k] for k in campos})
    return ruta


sano = escribir('atlas.csv', atlas['filas'])
# Frictionless rechaza rutas absolutas por seguridad («path ... is not safe»): se valida con basepath
r = validate(Resource(path=sano.name, basepath=str(salida), schema=esquema))
print('sano  →', 'válido' if r.valid else 'INVÁLIDO')
roto = [dict(x) for x in atlas['filas']]
roto[3]['pct_pobreza'] = 140
roto[7]['puma'] = roto[8]['puma']
roto[9]['borough'] = 'Long Island'
rr = validate(Resource(path=escribir('atlas_roto.csv', roto).name, basepath=str(salida), schema=esquema))
print('roto  →', 'válido' if rr.valid else 'INVÁLIDO')
for e in rr.flatten(['rowNumber', 'fieldName', 'type']):
    print('   ', e)
