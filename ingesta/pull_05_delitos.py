"""Ingesta · delitos denunciados (F04 histórico 2025; F14 año en curso para comparar enero–junio).
La fuente trae edad, raza y sexo de víctima y sospechoso, y coordenadas: nada de eso se escribe en el lago."""
import collections, concurrent.futures as cf
from comun import *

W25 = "rpt_dt between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"


def main():
    print('· delitos')
    props, idx, _ = pumas()
    t = Tema('seguridad_delitos', 'Delitos denunciados')
    filas = soql(NYC, 'qgea-i56i', select='boro_nm,law_cat_cd,count(*) as n', where=W25, group='boro_nm,law_cat_cd', limit=1000)
    t.fuente('F04', '2025 (fecha de reporte)', url=f'{NYC}/qgea-i56i.json', consulta=consulta_legible(select='boro_nm,law_cat_cd,count(*)', where=W25, group='boro_nm,law_cat_cd'))
    por_boro = collections.defaultdict(collections.Counter)
    for r in filas:
        por_boro[borough_norm(r.get('boro_nm')) or 'No especificado'][(r.get('law_cat_cd') or 'SIN CATEGORÍA').upper()] += int(r['n'])
    ofensas = soql(NYC, 'qgea-i56i', select='boro_nm,ofns_desc,count(*) as n', where=W25, group='boro_nm,ofns_desc', order='n DESC', limit=5000)
    top = collections.defaultdict(list)
    for r in ofensas:
        b = borough_norm(r.get('boro_nm'))
        if b and len(top[b]) < 5 and r.get('ofns_desc'):
            top[b].append((r['ofns_desc'].title(), int(r['n'])))

    # coordenadas agrupadas por mes, sin $order (la versión anual ordenada tardaba más de 20 minutos)
    def mes(m):
        a = f'2025-{m:02d}-01T00:00:00'; b = '2026-01-01T00:00:00' if m == 12 else f'2025-{m + 1:02d}-01T00:00:00'
        return soql(NYC, 'qgea-i56i', select='latitude,longitude,law_cat_cd,count(*) as n',
                    where=f"rpt_dt >= '{a}' AND rpt_dt < '{b}' AND latitude IS NOT NULL", group='latitude,longitude,law_cat_cd', limit=200000)
    with cf.ThreadPoolExecutor(4) as ex:
        puntos = [r for lote in ex.map(mes, range(1, 13)) for r in lote]
    por_puma = collections.defaultdict(collections.Counter)
    for r in puntos:
        try:
            x, y = float(r['longitude']), float(r['latitude'])
        except (TypeError, ValueError, KeyError):
            continue
        p = idx.buscar(x, y) if en_nyc(x, y) else None
        if p:
            por_puma[p]['total'] += int(r['n'])
            if r.get('law_cat_cd') == 'FELONY':
                por_puma[p]['graves'] += int(r['n'])
    del puntos   # las coordenadas no salen de la memoria

    h = lambda y: f"rpt_dt between '{y}-01-01T00:00:00' and '{y}-06-30T23:59:59'"
    s25 = soql(NYC, 'qgea-i56i', select='boro_nm,count(*) as n', where=h(2025), group='boro_nm')
    s26 = soql(NYC, '5uac-w243', select='boro_nm,count(*) as n', where=h(2026), group='boro_nm')
    hasta = (soql(NYC, '5uac-w243', select='max(rpt_dt) as hasta')[0].get('hasta') or '')[:10]
    t.fuente('F14', f'2026 hasta {hasta}', url=f'{NYC}/5uac-w243.json', consulta=consulta_legible(select='boro_nm,count(*)', where=h(2026), group='boro_nm'))
    a = {borough_norm(r.get('boro_nm')): int(r['n']) for r in s25}
    b = {borough_norm(r.get('boro_nm')): int(r['n']) for r in s26}

    lista = []
    for bo in BOROUGHS + ['No especificado']:
        c = por_boro[bo]; tot = sum(c.values())
        f = {'borough': bo, 'denuncias': tot, 'graves': c['FELONY'], 'menos_graves': c['MISDEMEANOR'], 'infracciones': c['VIOLATION']}
        if bo in CENSO_2020:
            for k, v in (('por_1000_hab', tot), ('graves_por_1000_hab', c['FELONY']), ('menos_graves_por_1000_hab', c['MISDEMEANOR']), ('infracciones_por_1000_hab', c['VIOLATION'])):
                f[k] = r1(v / CENSO_2020[bo] * 1000)
        lista.append(f)
    tasa = lambda d: C(d + ' por cada 1.000 habitantes (Censo 2020)', 'por 1.000 hab.', 'Decimal', 'derivado', '(calculado)', 'conteo ÷ poblacion_2020 × 1.000', fuente=['F04', 'F09'], pregunta='P3', decimales=1)
    t.lista('boroughs', lista, {
        'borough': COL_BORO('F04', 'boro_nm', 'P3', otros=True),
        'denuncias': C('Denuncias con fecha de reporte en 2025', 'denuncias', 'Entero', 'medido', 'count(*)', 'COUNT por boro_nm', pregunta='P3'),
        'graves': C('Delitos graves (felony)', 'denuncias', 'Entero', 'medido', "law_cat_cd = 'FELONY'", 'COUNT por categoría legal', pregunta='P3'),
        'menos_graves': C('Delitos menos graves (misdemeanor)', 'denuncias', 'Entero', 'medido', "law_cat_cd = 'MISDEMEANOR'", 'COUNT por categoría legal', pregunta='P3'),
        'infracciones': C('Infracciones (violation)', 'denuncias', 'Entero', 'medido', "law_cat_cd = 'VIOLATION'", 'COUNT por categoría legal', pregunta='P3'),
        'por_1000_hab': tasa('Denuncias'), 'graves_por_1000_hab': tasa('Delitos graves'),
        'menos_graves_por_1000_hab': tasa('Delitos menos graves'), 'infracciones_por_1000_hab': tasa('Infracciones'),
    }, '2025', 'F04', 'Denuncias por borough y categoría legal')
    t.lista('distritos', [{'puma': p, 'denuncias': por_puma[p]['total'], 'graves': por_puma[p]['graves']} for p in sorted(props)], {
        'puma': C('Código PUMA del distrito', 'código', 'Código', 'derivado', 'latitude, longitude', 'Punto en polígono contra F19; la coordenada se descarta', pregunta='P1'),
        'denuncias': C('Denuncias con coordenadas dentro del distrito', 'denuncias', 'Entero', 'medido', 'count(*)', 'COUNT por PUMA', pregunta='P1'),
        'graves': C('Delitos graves con coordenadas dentro del distrito', 'denuncias', 'Entero', 'medido', "law_cat_cd = 'FELONY'", 'COUNT por PUMA', pregunta='P1'),
    }, '2025', 'F04', 'Denuncias asignadas a los 55 distritos por coordenadas')
    t.lista('ofensas', [{'borough': bo, 'puesto': i + 1, 'ofensa': o, 'denuncias': n} for bo in BOROUGHS for i, (o, n) in enumerate(top[bo])], {
        'borough': COL_BORO('F04', 'boro_nm', 'P3'),
        'puesto': C('Puesto de la ofensa dentro del borough', 'puesto', 'Entero', 'derivado', '(calculado)', 'Orden por número de denuncias', pregunta='P3'),
        'ofensa': C('Descripción de la ofensa (catálogo NYPD)', 'categoría', 'Texto', 'medido', 'ofns_desc', 'Pasada a tipo título', pregunta='P3'),
        'denuncias': C('Denuncias de esa ofensa en el borough', 'denuncias', 'Entero', 'medido', 'count(*)', 'COUNT por boro_nm y ofns_desc', pregunta='P3'),
    }, '2025', 'F04', 'Las 5 ofensas más denunciadas en cada borough')
    t.lista('primer_semestre', [{'borough': bo, 'denuncias_2025': a.get(bo, 0), 'denuncias_2026': b.get(bo, 0),
                                 'variacion_pct': r1((b.get(bo, 0) / a[bo] - 1) * 100) if a.get(bo) else None} for bo in BOROUGHS], {
        'borough': COL_BORO('F04', 'boro_nm', 'P3'),
        'denuncias_2025': C('Denuncias enero–junio de 2025', 'denuncias', 'Entero', 'medido', 'count(*)', 'COUNT por rpt_dt', fuente='F04', vigencia='ene–jun 2025', pregunta='P3'),
        'denuncias_2026': C('Denuncias enero–junio de 2026', 'denuncias', 'Entero', 'medido', 'count(*)', 'COUNT por rpt_dt', fuente='F14', vigencia=f'ene–jun 2026 (datos hasta {hasta})', pregunta='P3'),
        'variacion_pct': C('Cambio porcentual 2026 frente a 2025', '%', 'Decimal', 'derivado', '(calculado)', '(2026 ÷ 2025 − 1) × 100', fuente=['F04', 'F14'], pregunta='P3', decimales=1),
    }, 'enero–junio 2025 y 2026', ['F04', 'F14'], 'Comparación del primer semestre')
    t.cifra('denuncias_2025', sum(sum(c.values()) for c in por_boro.values()), 'denuncias', '2025', 'F04', 'medido', 'Delitos denunciados en 2025', pregunta='P3')
    s_a, s_b = sum(a.get(x, 0) for x in BOROUGHS), sum(b.get(x, 0) for x in BOROUGHS)
    t.cifra('denuncias_ene_jun_2025', s_a, 'denuncias', 'ene–jun 2025', 'F04', 'medido', 'Denuncias de enero a junio de 2025', pregunta='P3')
    t.cifra('denuncias_ene_jun_2026', s_b, 'denuncias', 'ene–jun 2026', 'F14', 'medido', 'Denuncias de enero a junio de 2026', pregunta='P3')
    t.cifra('variacion_ene_jun', r1((s_b / s_a - 1) * 100), '%', 'ene–jun 2026 vs 2025', ['F04', 'F14'], 'derivado', 'Cambio de las denuncias del primer semestre de 2026 frente a 2025', formula='(2026 ÷ 2025 − 1) × 100', pregunta='P3')
    t.cifra('datos_2026_hasta', hasta, 'fecha', hasta, 'F14', 'medido', 'Última fecha de reporte publicada en el dataset del año en curso', pregunta='G')
    t.nota('Una denuncia no es una condena, y no todos los delitos se denuncian por igual: estas cifras miden lo reportado.')
    t.nota('Se cuenta por fecha de reporte (rpt_dt), como en las estadísticas del NYPD.')
    t.calidad('El dataset del año en curso trae fechas de inicio del delito en el año 1016: por eso se filtra por rpt_dt y no por cmplnt_fr_dt.')
    t.calidad('Los delitos sexuales vienen sin coordenadas para proteger a las víctimas: el conteo por distrito es algo menor que el del borough.')
    t.excluir('vic_age_group, vic_race, vic_sex, susp_age_group, susp_race, susp_sex', 'F04', 'Con la coordenada pueden reidentificar a una víctima: no se piden en la consulta')
    t.excluir('latitude, longitude', 'F04', 'Se usan en memoria para asignar el distrito y se descartan')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
