"""Ingesta · solicitudes 311 de 2025 (F03).
Más de 40 millones de filas: la consulta anual agota el tiempo de la API, por eso se pide mes a mes (12 consultas en paralelo)."""
import collections, concurrent.futures as cf
from comun import *

SELECT = 'borough,community_board,complaint_type,count(*) as n'


def main():
    print('· 311 (12 consultas mensuales)')
    props, _, cd_a_puma = pumas()
    meses = [(f'2025-{m:02d}-01T00:00:00', '2026-01-01T00:00:00' if m == 12 else f'2025-{m + 1:02d}-01T00:00:00') for m in range(1, 13)]

    def mes(rango):
        a, b = rango
        return a[:7], soql(NYC, 'erm2-nwe9', select=SELECT, where=f"created_date >= '{a}' and created_date < '{b}'",
                          group='borough,community_board,complaint_type', limit=100000)

    with cf.ThreadPoolExecutor(4) as ex:
        resultados = list(ex.map(mes, meses))
    t = Tema('calidad_de_vida_311', 'Solicitudes al 311 en 2025')
    t.fuente('F03', '2025', url=f'{NYC}/erm2-nwe9.json',
             consulta=consulta_legible(select=SELECT, where="created_date >= 'AAAA-MM-01' and created_date < 'mes siguiente'", group='borough,community_board,complaint_type') + ' (12 consultas)')
    por_boro, por_tipo, por_cd, por_mes = (collections.Counter() for _ in range(4))
    tipo_boro = collections.defaultdict(collections.Counter)
    for m, filas_mes in resultados:
        for r in filas_mes:
            n = int(r['n']); b = borough_norm(r.get('borough')) or 'No especificado'
            tp = (r.get('complaint_type') or '(sin tipo)').strip()
            tp = tp[:1].upper() + tp[1:].lower() if tp.isupper() else tp
            por_boro[b] += n; por_tipo[tp] += n; por_mes[m] += n; tipo_boro[b][tp] += n
            cd = parse_cd(r.get('community_board'))
            if cd:
                por_cd[cd] += n
    por_puma = sumar_por_puma(por_cd, cd_a_puma)
    total = sum(por_boro.values())
    t.cifra('solicitudes_2025', total, 'solicitudes', '2025', 'F03', 'medido', 'Solicitudes recibidas por el 311 en 2025', pregunta='P1')
    t.cifra('tipo_mas_frecuente', por_tipo.most_common(1)[0][0], 'categoría', '2025', 'F03', 'medido', 'Tipo de solicitud más frecuente en 2025', pregunta='P1')
    t.lista('boroughs', [{'borough': b, 'solicitudes': por_boro[b], 'por_1000_hab': r1(por_boro[b] / CENSO_2020[b] * 1000) if b in CENSO_2020 else None}
                         for b in BOROUGHS + ['No especificado']], {
        'borough': COL_BORO('F03', otros=True),
        'solicitudes': C('Solicitudes del borough en 2025', 'solicitudes', 'Entero', 'medido', 'count(*)', 'Suma de 12 consultas mensuales'),
        'por_1000_hab': C('Solicitudes por cada 1.000 habitantes (Censo 2020)', 'por 1.000 hab.', 'Decimal', 'derivado', '(calculado)', 'solicitudes ÷ poblacion_2020 × 1.000', fuente=['F03', 'F09'], decimales=1),
    }, '2025', 'F03', 'Solicitudes 311 por borough')
    t.lista('distritos', [{'puma': p, 'solicitudes': por_puma.get(p, 0)} for p in sorted(props)], {
        'puma': C('Código PUMA del distrito', 'código', 'Código', 'derivado', 'community_board', 'Distrito comunitario → PUMA (F19)'),
        'solicitudes': C('Solicitudes 311 de 2025 en el distrito', 'solicitudes', 'Entero', 'medido', 'count(*)', 'Suma por distrito comunitario y luego por PUMA; parques y "Unspecified" quedan fuera'),
    }, '2025', 'F03', 'Solicitudes 311 por distrito (PUMA)')
    t.lista('tipos', [{'tipo': k, 'solicitudes': v} for k, v in por_tipo.most_common(15)], {
        'tipo': C('Tipo de solicitud', 'categoría', 'Texto', 'medido', 'complaint_type', 'MAYÚSCULAS → tipo oración'),
        'solicitudes': C('Solicitudes de ese tipo en 2025', 'solicitudes', 'Entero', 'medido', 'count(*)', 'COUNT por tipo; 15 más frecuentes'),
    }, '2025', 'F03', 'Los 15 tipos de solicitud más frecuentes')
    t.lista('tipos_por_borough', [{'borough': b, 'puesto': i + 1, 'tipo': k, 'solicitudes': v} for b in BOROUGHS for i, (k, v) in enumerate(tipo_boro[b].most_common(5))], {
        'borough': COL_BORO('F03'),
        'puesto': C('Puesto del tipo dentro del borough', 'puesto', 'Entero', 'derivado', '(calculado)', 'Orden por número de solicitudes'),
        'tipo': C('Tipo de solicitud', 'categoría', 'Texto', 'medido', 'complaint_type', 'MAYÚSCULAS → tipo oración'),
        'solicitudes': C('Solicitudes de ese tipo en el borough', 'solicitudes', 'Entero', 'medido', 'count(*)', 'COUNT por borough y tipo'),
    }, '2025', 'F03', 'Los 5 tipos más frecuentes en cada borough')
    t.serie('solicitudes_mensual', [[m, por_mes[m]] for m in sorted(por_mes)], 'solicitudes', '2025', 'F03', 'medido', 'Solicitudes 311 por mes', pregunta='P1')
    t.nota('El 311 mide demanda de servicio, no la gravedad de un problema: un mismo ruido puede generar decenas de llamadas.')
    t.calidad('Las solicitudes en parques (distritos 55+) o sin distrito cuentan para el borough pero no para el atlas de distritos.')
    t.excluir('incident_address, descriptor, latitude, longitude', 'F03', 'Dirección exacta y texto libre pueden identificar a quien reporta: no se piden en la consulta')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
