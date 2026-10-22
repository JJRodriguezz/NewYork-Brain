"""Ingesta · vivienda (F05 DOB NOW obra nueva 2025, depurada; F16 vivienda asequible HPD desde 2014).
DOB NOW trae nombres de dueños, solicitantes y gestores: no se piden en la consulta."""
import collections
from comun import *

W_NB = "job_type='New Building' AND job_filing_number like '%-I1' AND filing_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
W_TODO = "job_type='New Building' AND filing_date between '2025-01-01T00:00:00' and '2025-12-31T23:59:59'"
BANDAS = {'eli': ('extremely_low_income_units', 'ingreso_extremadamente_bajo', 'Unidades para hogares con ≤30 % del AMI'),
          'vli': ('very_low_income_units', 'ingreso_muy_bajo', 'Unidades para hogares con 31–50 % del AMI'),
          'li': ('low_income_units', 'ingreso_bajo', 'Unidades para hogares con 51–80 % del AMI'),
          'mi': ('moderate_income_units', 'ingreso_moderado', 'Unidades para hogares con 81–120 % del AMI'),
          'mid': ('middle_income_units', 'ingreso_medio', 'Unidades para hogares con 121–165 % del AMI')}


def main():
    print('· vivienda')
    props, _, cd_a_puma = pumas()
    t = Tema('vivienda', 'Vivienda: obra nueva y vivienda asequible')
    sel = 'upper(borough) as b,commmunity_board as cd,count(*) as n,sum(proposed_dwelling_units::number) as u'
    filas = soql(NYC, 'w9ak-ipjd', select=sel, where=W_NB, group='b,cd', limit=5000)
    inflado = soql(NYC, 'w9ak-ipjd', select='count(*) as n,sum(proposed_dwelling_units::number) as u', where=W_TODO)[0]
    t.fuente('F05', 'radicaciones de 2025', url=f'{NYC}/w9ak-ipjd.json', consulta=consulta_legible(select=sel, where=W_NB, group='b,cd'))
    nb, u, u_cd = collections.Counter(), collections.Counter(), collections.Counter()
    for r in filas:
        b = borough_norm(r.get('b'))
        if not b:
            continue
        nb[b] += int(r['n']); u[b] += int(float(r.get('u') or 0))
        cd = parse_cd(r.get('cd'), b)
        if cd:
            u_cd[cd] += int(float(r.get('u') or 0))
    sel_h = 'borough,community_board,sum(all_counted_units) as u,' + ','.join(f'sum({v[0]}) as {k}' for k, v in BANDAS.items())
    hny = soql(NYC, 'hg8x-zxpr', select=sel_h, group='borough,community_board', limit=5000)
    anual = soql(NYC, 'hg8x-zxpr', select='date_extract_y(project_start_date) as y,sum(all_counted_units) as u', group='y', order='y', limit=100)
    t.fuente('F16', 'acumulado desde 2014', url=f'{NYC}/hg8x-zxpr.json', consulta=consulta_legible(select=sel_h, group='borough,community_board'))
    hb, h_cd = collections.defaultdict(collections.Counter), collections.Counter()
    for r in hny:
        b = borough_norm(r.get('borough'))
        if not b:
            continue
        for k in ['u', *BANDAS]:
            hb[b][k] += int(float(r.get(k) or 0))
        cd = parse_cd(r.get('community_board'))
        if cd:
            h_cd[cd] += int(float(r.get('u') or 0))
    pu_nb, pu_h = sumar_por_puma(u_cd, cd_a_puma), sumar_por_puma(h_cd, cd_a_puma)

    t.lista('obra_nueva', [{'borough': b, 'obras_nuevas': nb[b], 'viviendas_propuestas': u[b], 'viviendas_por_1000_hab': r1(u[b] / CENSO_2020[b] * 1000)} for b in BOROUGHS], {
        'borough': COL_BORO('F05', pregunta='P2'),
        'obras_nuevas': C('Obras nuevas radicadas en 2025 (solo radicación inicial -I1)', 'obras', 'Entero', 'medido', "count(*) job_type='New Building'", 'Filtro -I1 para no contar trámites repetidos', pregunta='P2'),
        'viviendas_propuestas': C('Viviendas propuestas en esas obras', 'viviendas', 'Entero', 'medido', 'sum(proposed_dwelling_units)', 'Texto convertido a número (::number) y sumado', pregunta='P2'),
        'viviendas_por_1000_hab': C('Viviendas propuestas por cada 1.000 habitantes (Censo 2020)', 'por 1.000 hab.', 'Decimal', 'derivado', '(calculado)', 'viviendas ÷ poblacion_2020 × 1.000', fuente=['F05', 'F09'], pregunta='P2', decimales=1),
    }, 'radicaciones de 2025', 'F05', 'Obra nueva radicada en 2025, por borough')
    cols_h = {'borough': COL_BORO('F16', pregunta='P2'),
              'viviendas_asequibles': C('Viviendas asequibles contadas por HPD desde 2014', 'viviendas', 'Entero', 'medido', 'sum(all_counted_units)', 'SUM por borough', pregunta='P2')}
    cols_h.update({v[1]: C(v[2], 'viviendas', 'Entero', 'medido', v[0], 'SUM por borough', pregunta='P2') for v in BANDAS.values()})
    t.lista('asequible', [{'borough': b, 'viviendas_asequibles': hb[b]['u'], **{v[1]: hb[b][k] for k, v in BANDAS.items()}} for b in BOROUGHS],
            cols_h, 'acumulado desde 2014', 'F16', 'Vivienda asequible por borough y nivel de ingreso (AMI = ingreso mediano del área, HUD)')
    t.lista('distritos', [{'puma': p, 'viviendas_propuestas': pu_nb.get(p, 0), 'viviendas_asequibles': pu_h.get(p, 0)} for p in sorted(props)], {
        'puma': C('Código PUMA del distrito', 'código', 'Código', 'derivado', 'commmunity_board / community_board', 'Distrito comunitario → PUMA', pregunta='P2'),
        'viviendas_propuestas': C('Viviendas propuestas en obra nueva radicada en 2025', 'viviendas', 'Entero', 'medido', 'sum(proposed_dwelling_units)', 'Solo -I1; SUM por PUMA', fuente='F05', vigencia='radicaciones de 2025', pregunta='P2'),
        'viviendas_asequibles': C('Viviendas asequibles HPD desde 2014', 'viviendas', 'Entero', 'medido', 'sum(all_counted_units)', 'SUM por PUMA', fuente='F16', vigencia='acumulado desde 2014', pregunta='P2'),
    }, '2025 y acumulado desde 2014', ['F05', 'F16'], 'Vivienda por distrito (PUMA)')
    t.serie('asequibles_por_anio', [[int(r['y']), int(float(r['u']))] for r in anual if r.get('y')], 'viviendas', 'desde 2014', 'F16', 'medido',
            'Viviendas asequibles HPD por año de inicio de obra (el año en curso está incompleto)', x='año', pregunta='P2')
    t.cifra('viviendas_propuestas_2025', sum(u.values()), 'viviendas', 'radicaciones de 2025', 'F05', 'medido', 'Viviendas propuestas en obras nuevas radicadas en 2025 (solo -I1)', pregunta='P2')
    t.cifra('viviendas_sin_depurar_2025', int(float(inflado['u'])), 'viviendas', 'radicaciones de 2025', 'F05', 'medido', 'Lo que sumaría la misma consulta sin filtrar los trámites repetidos', pregunta='G')
    t.cifra('filas_sin_depurar_2025', int(inflado['n']), 'filas', 'radicaciones de 2025', 'F05', 'medido', 'Filas de obra nueva de 2025 sin filtrar los trámites repetidos', pregunta='G')
    t.cifra('viviendas_asequibles_total', sum(hb[b]['u'] for b in BOROUGHS), 'viviendas', 'acumulado desde 2014', 'F16', 'medido', 'Viviendas asequibles financiadas por HPD desde 2014', pregunta='P2')
    t.calidad('Cada obra nueva aparece varias veces en DOB NOW (radicación inicial -I1 y trámites -P1, -S8, -Z1…) repitiendo sus viviendas; se cuenta solo -I1.')
    t.calidad('El campo de distrito de DOB NOW se llama "commmunity_board" (con triple m).')
    t.excluir('owner_first_name, owner_last_name, owner_s_business_name, applicant_first_name, applicant_last_name, applicant_license, filing_representative_*', 'F05',
              'Nombres y licencias de personas: no responden ninguna pregunta del sistema y no se piden en la consulta')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
