"""Catálogo: una fila por fuente encontrada, entre o no al lago, con la fecha REAL de la última prueba.
La fecha sale de los archivos del lago (cada pull_*.py registra el día en que su fuente respondió). Si una fuente
del catálogo no tiene prueba, la verificación falla: no se publica una fecha inventada."""
import glob, os, json
from comun import *
from catalogo import FUENTES
from preguntas import PREGUNTAS, HUECOS


def main():
    print('· catálogo')
    probado, estado = {}, {}
    for ruta in glob.glob(os.path.join(LAGO, '*.json')) + glob.glob(os.path.join(LAGO, 'geo', '*.geojson')):
        if ruta.endswith('catalogo.json'):
            continue
        d = json.load(open(ruta, encoding='utf-8'))
        for f in d.get('fuentes', []):
            if f.get('probado') and f['probado'] >= probado.get(f['id'], ''):
                probado[f['id']], estado[f['id']] = f['probado'], f.get('estado')
    filas = []
    for f in FUENTES:
        fila = dict(f)
        fila['fecha_prueba'] = probado.get(f['id'])
        fila['respuesta'] = estado.get(f['id'])
        filas.append(fila)
    sin = [f['id'] for f in filas if not f['fecha_prueba']]
    if sin:
        print('  ⚠ fuentes sin prueba en esta corrida:', ', '.join(sin))
    guardar_json('catalogo.json', {
        'tema': 'catalogo', 'titulo': 'Catálogo de fuentes', 'probado': HOY,
        'fuentes': [{'id': f['id'], 'nombre': f['nombre'], 'entidad': f['entidad'], 'url': f['url'], 'estado': f['respuesta'] or 'sin prueba',
                     'licencia': f['licencia'], 'personas': f['personas'], 'vigencia': f['periodo'], 'probado': f['fecha_prueba'],
                     'tipo_publicador': f['tipo_publicador'], 'formato': f['formato'], 'como_se_obtiene': f['como_se_obtiene'], 'cobertura': f['cobertura'],
                     'frecuencia': f['frecuencia'], 'estado_catalogo': f['estado'], 'como_la_encontraron': f['como_la_encontraron'],
                     'observaciones': f['observaciones'], 'alimenta': f['lago']} for f in filas],
        'preguntas': PREGUNTAS, 'huecos': [{'quien': q, 'por_que': r} for q, r in HUECOS],
        'cifras': {}, 'series': {}, 'listas': {}, 'notas': ['Espejo de la hoja «1. Fuentes» del diccionario. La fecha de prueba es el último día en que la fuente respondió al correr la ingesta.'],
        'calidad': [], 'excluido': []})


if __name__ == '__main__':
    ejecutar(main)
