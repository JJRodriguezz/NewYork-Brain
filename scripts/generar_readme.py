"""Rellena las tablas del README que salen del código: «¿Se puede usar?» (lago/catalogo.json) y «Bitácora de IA»
(scripts/bitacora.py). Reemplaza solo lo que está entre los marcadores <!-- tabla-… --> y <!-- /tabla-… -->.
Uso: python scripts/generar_readme.py  (después de python ingesta/construir.py)"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'scripts'))
from bitacora import BITACORA  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')

NYC = 'Citar fuente y fecha; Local Law 11 de 2012 y Términos de Uso de NYC.gov (el dataset no declara licencia)'
NYS = 'Citar fuente y fecha; Términos de Uso de Open NY (data.ny.gov; el dataset no declara licencia)'
# Condiciones que no salen de una regla por portal. Lo que no está aquí se decide por el dominio de la URL.
CONDICION = {
    'F03': NYC + '. Solo conteos por tipo y zona: no se piden dirección ni texto libre',
    'F04': NYC + '. Solo conteos por tipo, mes y zona: edad, raza, sexo y punto del hecho no se publican',
    'F14': NYC + '. Igual que F04',
    'F05': NYC + '. Solo viviendas propuestas por zona: nombres, licencias y teléfonos no se piden',
    'F08': 'Ninguna (CC0); se cita igual',
    'F09': 'Dominio público (obra del gobierno federal, 17 U.S.C. §105); citar al DCP, que la publica',
    'F10': 'Ninguna; citar Census Reporter y el ACS, y mostrar el margen de error (90 %)',
    'F24': 'Atribución CC BY 4.0: «(F24) Open-Meteo» junto al clima',
    'F28': 'Atribución a OpenFreeMap y © OpenStreetMap (ODbL) en el mapa',
    'F29': 'Cifra declarada por la entidad: se muestra marcada «declarado», separada de lo medido',
    'F30': 'Cifra declarada por la entidad: se muestra marcada «declarado», separada de lo medido',
    'F31': 'Exige atribución a Esri y sus proveedores: «Imágenes © Esri, Maxar, Earthstar Geographics» en el mapa; solo capa visual',
    'F11': 'No se usa todavía: montos en 0 y distribución inverosímil (ver catálogo)',
    'F12': 'No se usa: mide llamadas al 911, no delitos, y sumarla a F04 y al 311 contaría doble',
    'F21': 'No se usa: pide llave con registro (sin llave, HTTP 302); la reemplaza F10',
    'F22': 'No se usa: su último dato es del 9-ene-2025; la reemplaza F17',
    'F23': 'No se usa: sistema en retiro (hoy se radica en F05) y trae nombres de propietarios',
    'F25': 'No se usa: la columna «2020» es una proyección de 2013',
    'F32': 'No se usa: residual frente a F05 y trae nombre, dirección y teléfono de personas',
}


def celda(t):
    return ' '.join(str(t).split()).replace('|', '\\|')


def condicion(f):
    if f['id'] in CONDICION:
        return CONDICION[f['id']]
    if 'data.cityofnewyork.us' in f['url']:
        return NYC
    if 'data.ny.gov' in f['url']:
        return NYS
    raise SystemExit(f"{f['id']}: falta su condición de uso en CONDICION")


def tabla_uso():
    cat = json.loads((RAIZ / 'lago' / 'catalogo.json').read_text(encoding='utf-8'))
    filas = ['| Fuente | Licencia (literal, o «no declara») | Personas | Estado | Condición |', '|---|---|---|---|---|']
    for f in cat['fuentes']:
        estado = f"{f['estado_catalogo']} · {f['estado']} · probado {f['probado']}"
        filas.append(f"| {f['id']} · [{celda(f['nombre'])}]({f['url']}) | {celda(f['licencia'])} | {celda(f['personas'])} | {estado} | {celda(condicion(f))} |")
    return '\n'.join(filas)


def tabla_ia():
    filas = ['| # | Tramo | Herramienta | Qué le encargamos | Qué entregó | Qué le corregimos |', '|---|---|---|---|---|---|']
    for i, b in enumerate(BITACORA, 1):
        corr = f"**{b['resultado']}.** {b['comprobacion']} → {b['correccion']}"
        filas.append(f"| {i} | {b['tramo']} | {celda(b['herramienta'])} | {celda(b['encargo'])} | {celda(b['respuesta'])} | {celda(corr)} |")
    return '\n'.join(filas)


def reemplazar(texto, marca, tabla):
    patron = re.compile(rf'(<!-- {marca}:[^\n]*-->\n).*?(<!-- /{marca} -->)', re.S)
    if not patron.search(texto):
        raise SystemExit(f'README sin el marcador {marca}')
    return patron.sub(lambda m: m.group(1) + tabla + '\n' + m.group(2), texto)


if __name__ == '__main__':
    ruta = RAIZ / 'README.md'
    texto = ruta.read_text(encoding='utf-8')
    texto = reemplazar(texto, 'tabla-uso', tabla_uso())
    texto = reemplazar(texto, 'tabla-ia', tabla_ia())
    ruta.write_text(texto, encoding='utf-8', newline='\n')
    print(f'README: {len(BITACORA)} episodios de IA y las fuentes de lago/catalogo.json')
