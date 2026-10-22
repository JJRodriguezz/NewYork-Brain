"""Atlas de los 55 distritos: une el lago por PUMA y define CADA métrica una sola vez (columnas del contrato).

Tasas: conteo administrativo (sin error muestral) ÷ población del ACS (con MOE). Su MOE al 90 % es
    MOE_tasa = tasa × MOE_población ÷ población
y queda en la columna <métrica>_moe. Con eso las vistas no ordenan dos distritos cuya diferencia cabe en el error."""
from comun import *
import acs


def main():
    print('· atlas de 55 distritos')
    t = Tema('distritos', 'Atlas de los 55 distritos (PUMA)')
    base = leer('demografia.json')['listas']['distritos']['filas']
    temas = {k: {f['puma']: f for f in filas(k, 'distritos')} for k in ('calidad_de_vida_311', 'seguridad_delitos', 'seguridad_vial', 'vivienda', 'ambiente')}
    for tema in ('demografia', 'calidad_de_vida_311', 'seguridad_delitos', 'seguridad_vial', 'vivienda', 'ambiente'):
        for f in leer(tema + '.json')['fuentes']:
            if f['id'] in ('F02', 'F03', 'F04', 'F05', 'F07', 'F10', 'F15', 'F16', 'F19'):
                t.d['fuentes'] = [x for x in t.d['fuentes'] if x['id'] != f['id']] + [f]

    TASAS = {   # métrica: (tema, campo, por cuántos, descripción, fuente, vigencia, pregunta)
        'solicitudes_311_por_1000': ('calidad_de_vida_311', 'solicitudes', 1000, 'Solicitudes 311 por cada 1.000 residentes', 'F03', '2025', 'P1', 'Solicitudes 311'),
        'delitos_por_1000': ('seguridad_delitos', 'denuncias', 1000, 'Denuncias de delitos por cada 1.000 residentes', 'F04', '2025', 'P1', 'Delitos denunciados'),
        'delitos_graves_por_1000': ('seguridad_delitos', 'graves', 1000, 'Delitos graves (felony) por cada 1.000 residentes', 'F04', '2025', 'P1', 'Delitos graves'),
        'heridos_transito_por_10000': ('seguridad_vial', 'heridos', 10000, 'Personas heridas en choques por cada 10.000 residentes', 'F02', '2025', 'P4', 'Heridos de tránsito'),
        'peatones_heridos_por_10000': ('seguridad_vial', 'peatones_heridos', 10000, 'Peatones heridos por cada 10.000 residentes', 'F02', '2025', 'P4', 'Peatones heridos'),
        'viviendas_obra_nueva_por_1000': ('vivienda', 'viviendas_propuestas', 1000, 'Viviendas propuestas en obra nueva 2025 por cada 1.000 residentes', 'F05', 'radicaciones de 2025', 'P2', 'Viviendas propuestas 2025'),
        'viviendas_asequibles_por_1000': ('vivienda', 'viviendas_asequibles', 1000, 'Viviendas asequibles HPD (desde 2014) por cada 1.000 residentes', 'F16', 'acumulado desde 2014', 'P2', 'Viviendas asequibles HPD'),
    }
    out = []
    for b in base:
        p, pob, mp = b['puma'], b['poblacion_acs'], b['poblacion_acs_moe']
        f = dict(b)
        for k, (tema, campo, por, *_r) in TASAS.items():
            n = temas[tema][p][campo]
            tasa = n / pob * por if pob else None
            f[k] = r1(tasa); f[k + '_moe'] = r1(moe_tasa(tasa, pob, mp), 2)
        amb = temas['ambiente'][p]
        f['arboles_calle_por_km2'] = r1(amb['arboles'] / b['area_km2'], 0)
        f['pm25'], f['no2'] = amb['pm25'], amb['no2']
        out.append(f)

    cols = {k: v for k, v in leer('demografia.json')['listas']['distritos']['columnas'].items()}
    for k, (tema, campo, por, desc, fuente, vig, preg, etq) in TASAS.items():
        cols[k] = C(desc, f'por {por:,} hab.'.replace(',', '.'), 'Decimal', 'derivado', f'{campo} ({tema}) ÷ poblacion_acs',
                    f'{campo} ÷ poblacion_acs × {por:,}'.replace(',', '.'), fuente=[fuente, 'F10'], vigencia=f'{vig} · población {ACS_VIGENCIA}',
                    moe=k + '_moe', pregunta=preg, decimales=1, etiqueta=etq)
        cols[k + '_moe'] = C(f'Margen de error al 90 % de «{desc.lower()}»', f'por {por:,} hab.'.replace(',', '.'), 'Decimal', 'derivado', '(calculado)',
                             'tasa × MOE de la población ÷ población (el conteo es administrativo y no tiene error muestral)', fuente=[fuente, 'F10'],
                             vigencia=f'{vig} · población {ACS_VIGENCIA}', pregunta=preg, decimales=2)
    a = leer('ambiente.json')['listas']['distritos']['columnas']
    cols['arboles_calle_por_km2'] = C('Árboles de calle (censo 2015) por km²', 'árboles/km²', 'Decimal', 'derivado', 'count(tree_id) ÷ area_km2', 'árboles ÷ superficie del PUMA',
                                      fuente=['F07', 'F19'], vigencia='censo 2015', pregunta='P6', decimales=0, etiqueta='Árboles de calle (2015)')
    cols['pm25'], cols['no2'] = a['pm25'], a['no2']
    t.lista('distritos', out, cols, f'{ACS_VIGENCIA}; 311, choques y delitos 2025; aire {a["pm25"]["vigencia"]}; árboles 2015',
            ['F02', 'F03', 'F04', 'F05', 'F07', 'F10', 'F15', 'F16', 'F19'], 'Atlas de los 55 distritos comunitarios (PUMA 2020)')
    t.nota('Cada métrica se define una sola vez en estas columnas: las vistas leen de aquí nombre, unidad, fuente, vigencia y margen de error.')
    t.nota('Midtown (MN 5&6) tiene muchos más usuarios de paso que residentes: sus tasas por residente se disparan y se leen como carga de servicio.')
    t.nota('PM2,5, NO₂ y árboles no traen margen de error en su fuente: se tratan como fijos, y se dice.')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
