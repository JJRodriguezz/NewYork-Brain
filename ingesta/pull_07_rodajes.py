"""Ingesta · permisos de rodaje y eventos de 2025 (F06 Film Permits)."""
import collections
from comun import *

W = "startdatetime between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"


def main():
    print('· rodajes')
    t = Tema('economia_rodajes', 'Permisos de rodaje 2025')
    filas = soql(NYC, 'tg4x-b46p', select='borough,category,count(*) as n', where=W, group='borough,category', limit=1000)
    mes = soql(NYC, 'tg4x-b46p', select='date_trunc_ym(startdatetime) as m,count(*) as n', where=W, group='m', order='m')
    t.fuente('F06', '2025', url=f'{NYC}/tg4x-b46p.json', consulta=consulta_legible(select='borough,category,count(*)', where=W, group='borough,category'))
    por_b, por_cat, malos = collections.Counter(), collections.Counter(), collections.Counter()
    for r in filas:
        b, n = borough_norm(r.get('borough')), int(r['n'])
        if b:
            por_b[b] += n; por_cat[r.get('category') or '(sin categoría)'] += n
        else:
            malos[r.get('borough') or '(vacío)'] += n
    t.lista('boroughs', [{'borough': b, 'permisos': por_b[b]} for b in BOROUGHS], {
        'borough': COL_BORO('F06', pregunta='P9'),
        'permisos': C('Permisos de rodaje o evento con inicio en 2025', 'permisos', 'Entero', 'medido', 'count(*)', 'COUNT; filas con borough inválido se excluyen', pregunta='P9'),
    }, '2025', 'F06', 'Permisos por borough')
    t.lista('categorias', [{'categoria': c, 'permisos': n} for c, n in por_cat.most_common()], {
        'categoria': C('Categoría del permiso (televisión, cine, publicidad…)', 'categoría', 'Texto', 'medido', 'category', 'Ninguna', pregunta='P9'),
        'permisos': C('Permisos de esa categoría', 'permisos', 'Entero', 'medido', 'count(*)', 'COUNT', pregunta='P9'),
    }, '2025', 'F06', 'Permisos por categoría')
    t.serie('permisos_mensual', [[r['m'][:7], int(r['n'])] for r in mes], 'permisos', '2025', 'F06', 'medido', 'Permisos por mes de inicio', pregunta='P9')
    t.cifra('permisos_2025', sum(por_b.values()), 'permisos', '2025', 'F06', 'medido', 'Permisos de rodaje y eventos con inicio en 2025', pregunta='P9')
    t.cifra('filas_borough_invalido', sum(malos.values()), 'filas', '2025', 'F06', 'medido', 'Permisos cuyo campo borough no es un borough (se excluyen)', pregunta='G')
    if malos:
        t.calidad('Valores no válidos en "borough": ' + ', '.join(f'"{k}" ({v})' for k, v in malos.items()))
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
