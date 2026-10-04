"""Regla del taller: «si un campo del lago no está en el diccionario, no existe».
Este script recorre cada JSON/GeoJSON del lago, normaliza las rutas y falla si encuentra un campo sin documentar."""
import json, os, sys
from comun import LAGO, BOROUGHS
from diccionario import DIC, META

DINAMICAS = set(BOROUGHS) | {'No especificado'}


def rutas(obj, base=''):
    """Devuelve {ruta_normalizada: [valores hoja]}."""
    out = {}
    def go(o, p):
        if isinstance(o, dict):
            if p.endswith('geometry') and 'type' in o and 'coordinates' in o:
                out.setdefault(p, []).append(o['type']); return
            claves = list(o)
            if claves and all(k in DINAMICAS for k in claves):
                for k in claves:
                    go(o[k], p + '{borough}')
                return
            for k, v in o.items():
                go(v, f'{p}.{k}' if p else k)
        elif isinstance(o, list):
            if not o:
                out.setdefault(p + '[]', [])
            for v in o:
                go(v, p + '[]')
        else:
            out.setdefault(p, []).append(o)
    go(obj, base)
    return out


def archivos():
    for n in sorted(os.listdir(LAGO)):
        if n.endswith('.json'):
            yield n, os.path.join(LAGO, n)
    for n in sorted(os.listdir(os.path.join(LAGO, 'geo'))):
        yield 'geo/' + n, os.path.join(LAGO, 'geo', n)


def campos_del_lago():
    for nombre, ruta in archivos():
        datos = json.load(open(ruta, encoding='utf-8'))
        for r, vals in rutas(datos).items():
            if r in ('type', 'features[].type'):
                continue
            yield nombre, r, vals


if __name__ == '__main__':
    faltan, total = [], 0
    vistos = set()
    for archivo, r, _ in campos_del_lago():
        total += 1
        clave = r if not r.startswith('_meta.') else None
        if r.startswith('_meta.'):
            if r not in META:
                faltan.append((archivo, r))
            continue
        vistos.add((archivo, r))
        if r.endswith('[]') and any(a == archivo and k.startswith(r) for a, k in DIC):
            continue   # lista vacía en esta corrida: sus campos ya están documentados
        if (archivo, r) not in DIC:
            faltan.append((archivo, r))
    sobran = [k for k in DIC if k not in vistos]
    print(f'campos encontrados en el lago: {total}')
    print(f'entradas en el diccionario:    {len(DIC)} (+{len(META)} de _meta)')
    if sobran:
        print('\n⚠ documentados pero ausentes en esta corrida (pueden depender de la respuesta de la API):')
        for a, r in sobran:
            print(f'   {a} :: {r}')
    if faltan:
        print('\n✗ campos SIN documentar:')
        for a, r in faltan:
            print(f'   {a} :: {r}')
        sys.exit(1)
    print('\n✓ todos los campos del lago están en el diccionario')
