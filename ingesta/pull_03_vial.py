"""Ingesta · seguridad vial 2025 (F02 Motor Vehicle Collisions).
Baja solo conteos y coordenadas; asigna cada choque a su PUMA por punto en polígono y descarta la coordenada."""
import collections
from comun import *

CAMPOS = ('colisiones', 'heridos', 'fallecidos', 'peatones_heridos', 'peatones_fallecidos', 'ciclistas_heridos', 'ciclistas_fallecidos',
          'ocupantes_heridos', 'ocupantes_fallecidos')
ORIG = {'colisiones': 'count(collision_id)', 'heridos': 'number_of_persons_injured', 'fallecidos': 'number_of_persons_killed',
        'peatones_heridos': 'number_of_pedestrians_injured', 'peatones_fallecidos': 'number_of_pedestrians_killed',
        'ciclistas_heridos': 'number_of_cyclist_injured', 'ciclistas_fallecidos': 'number_of_cyclist_killed',
        'ocupantes_heridos': 'number_of_motorist_injured', 'ocupantes_fallecidos': 'number_of_motorist_killed'}
DESC = {'colisiones': 'Choques reportados', 'heridos': 'Personas heridas', 'fallecidos': 'Personas fallecidas', 'peatones_heridos': 'Peatones heridos',
        'peatones_fallecidos': 'Peatones fallecidos', 'ciclistas_heridos': 'Ciclistas heridos', 'ciclistas_fallecidos': 'Ciclistas fallecidos',
        'ocupantes_heridos': 'Ocupantes de vehículos heridos', 'ocupantes_fallecidos': 'Ocupantes de vehículos fallecidos'}


def main():
    print('· seguridad vial 2025')
    props, idx, _ = pumas()
    cols_api = 'borough,latitude,longitude,' + ','.join(v for k, v in ORIG.items() if k != 'colisiones') + ',crash_date'
    where = "crash_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
    datos = soql_paginado(NYC, 'h9gi-nx95', select=cols_api, where=where, order='collision_id')
    t = Tema('seguridad_vial', 'Seguridad vial 2025')
    t.fuente('F02', '2025', url=f'{NYC}/h9gi-nx95.json', consulta=consulta_legible(select=cols_api, where=where))
    n = lambda r, k: int(float(r.get(k) or 0))
    por_boro, por_puma, por_mes = (collections.defaultdict(collections.Counter) for _ in range(3))
    recuperados = 0
    for r in datos:
        b, puma = borough_norm(r.get('borough')), None
        try:
            x, y = float(r['longitude']), float(r['latitude'])
            puma = idx.buscar(x, y) if en_nyc(x, y) else None
        except (KeyError, ValueError, TypeError):
            pass
        if not b and puma:
            b = props[puma]['borough']; recuperados += 1
        reg = {'colisiones': 1, **{k: n(r, ORIG[k]) for k in CAMPOS if k != 'colisiones'}}
        por_boro[b or 'No especificado'].update(reg)
        if puma:
            por_puma[puma].update(reg)
        por_mes[r['crash_date'][:7]].update(reg)

    filas = []
    for b in BOROUGHS + ['No especificado']:
        c = por_boro[b]
        f = {'borough': b, **{k: c[k] for k in CAMPOS}}
        if b in CENSO_2020:
            f['heridos_por_100k'] = r1(c['heridos'] / CENSO_2020[b] * 1e5)
            f['fallecidos_por_100k'] = r1(c['fallecidos'] / CENSO_2020[b] * 1e5, 2)
        filas.append(f)
    cols = {'borough': COL_BORO('F02', otros=True, pregunta='P4')}
    cols.update({k: C(DESC[k], 'choques' if k == 'colisiones' else 'personas', 'Entero', 'medido', ORIG[k], 'COUNT/SUM por borough', pregunta='P4') for k in CAMPOS})
    cols['heridos_por_100k'] = C('Heridos por cada 100.000 habitantes (Censo 2020)', 'por 100.000 hab.', 'Decimal', 'derivado', '(calculado)', 'heridos ÷ poblacion_2020 × 100.000', fuente=['F02', 'F09'], pregunta='P4', decimales=1)
    cols['fallecidos_por_100k'] = C('Fallecidos por cada 100.000 habitantes (Censo 2020)', 'por 100.000 hab.', 'Decimal', 'derivado', '(calculado)', 'fallecidos ÷ poblacion_2020 × 100.000', fuente=['F02', 'F09'], pregunta='P4', decimales=2)
    t.lista('boroughs', filas, cols, '2025', 'F02', 'Choques y víctimas por borough')

    dist = [{'puma': p, 'colisiones': por_puma[p]['colisiones'], 'heridos': por_puma[p]['heridos'], 'peatones_heridos': por_puma[p]['peatones_heridos']} for p in sorted(props)]
    t.lista('distritos', dist, {
        'puma': C('Código PUMA del distrito', 'código', 'Código', 'derivado', 'latitude, longitude', 'Punto en polígono contra F19; la coordenada se descarta', pregunta='P4'),
        'colisiones': C('Choques ubicados en el distrito', 'choques', 'Entero', 'medido', 'count(collision_id)', 'COUNT por PUMA', pregunta='P4'),
        'heridos': C('Personas heridas en choques del distrito', 'personas', 'Entero', 'medido', ORIG['heridos'], 'SUM por PUMA', pregunta='P4'),
        'peatones_heridos': C('Peatones heridos en choques del distrito', 'personas', 'Entero', 'medido', ORIG['peatones_heridos'], 'SUM por PUMA', pregunta='P4'),
    }, '2025', 'F02', 'Choques asignados a los 55 distritos por coordenadas')

    meses = sorted(por_mes)
    for k in ('colisiones', 'heridos', 'fallecidos'):
        t.serie(k + '_mensual', [[m, por_mes[m][k]] for m in meses], 'choques' if k == 'colisiones' else 'personas', '2025', 'F02', 'medido', DESC[k] + ' por mes', pregunta='P4')
    tot = sum((por_boro[b] for b in por_boro), collections.Counter())
    t.cifra('colisiones_2025', tot['colisiones'], 'choques', '2025', 'F02', 'medido', 'Choques reportados en 2025', pregunta='P4')
    t.cifra('fallecidos_2025', tot['fallecidos'], 'personas', '2025', 'F02', 'medido', 'Personas fallecidas en el tránsito en 2025', pregunta='P4')
    t.cifra('peatones_fallecidos_2025', tot['peatones_fallecidos'], 'personas', '2025', 'F02', 'medido', 'Peatones fallecidos en 2025', pregunta='P4')
    t.cifra('pct_fallecidos_peatones', r1(100 * tot['peatones_fallecidos'] / tot['fallecidos']) if tot['fallecidos'] else None, '%', '2025', 'F02', 'derivado',
            'Porcentaje de los fallecidos en el tránsito que eran peatones', formula='peatones_fallecidos ÷ fallecidos', pregunta='P4')
    t.cifra('recuperados_por_coordenadas', recuperados, 'choques', '2025', ['F02', 'F19'], 'derivado', 'Choques sin borough en la fuente que se ubicaron por sus coordenadas', pregunta='G')
    t.cifra('sin_ubicar', por_boro['No especificado']['colisiones'], 'choques', '2025', 'F02', 'medido', 'Choques sin borough ni coordenadas válidas', pregunta='G')
    t.nota('La fuente es obligatoria solo si hubo herido, fallecido o daño mayor a US$1.000: no cuenta todos los choques.')
    t.calidad(f'{recuperados} choques venían sin borough (sobre todo autopistas y puentes) y se ubicaron por coordenadas contra los polígonos oficiales.')
    t.excluir('fallecidos por distrito', 'F02', 'Conteos pequeños de personas por zona que ninguna vista usa: solo se publican por borough')
    t.excluir('latitude, longitude', 'F02', 'Se usan en memoria para asignar el distrito y no se escriben en el lago')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
