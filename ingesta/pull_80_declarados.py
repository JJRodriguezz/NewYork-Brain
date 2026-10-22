"""Ingesta · cifras DECLARADAS (F29 NYC Tourism + Conventions, F30 Concejo Municipal).
No vienen de una API: se transcriben de comunicados oficiales y quedan con tipo «declarado». El script comprueba que
cada comunicado sigue respondiendo y que el texto todavía contiene la cifra; si no, falla y no se publica."""
import re
from comun import *

TURISMO = 'https://www.business.nyctourism.com/press-media/press-releases/NYC-Tourism-Annual-Report-March-2026'
CONCEJO = 'https://council.nyc.gov/press/2026/06/30/3166/'


def texto(url):
    r = get(url, timeout=60); r.raise_for_status()
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', r.text))


def exige(t, *frases):
    for f in frases:
        assert f in t, f'el comunicado ya no contiene «{f}»: revisar la cifra antes de publicar'


def main():
    print('· cifras declaradas')
    t = Tema('declarados', 'Cifras declaradas en comunicados oficiales')
    tur = texto(TURISMO)
    exige(tur, '65 million', '52.4', '12.5', '84.7', '55.6', '7.5')
    t.fuente('F29', '2025 (publicado el 24-mar-2026)', url=TURISMO, estado='declarado')
    for clave, v, u, d in [('visitantes_2025', 65e6, 'visitantes', 'Visitantes a la ciudad en 2025'),
                           ('visitantes_nacionales_2025', 52.4e6, 'visitantes', 'Visitantes nacionales en 2025 (+1,7 %)'),
                           ('visitantes_internacionales_2025', 12.5e6, 'visitantes', 'Visitantes internacionales en 2025 (−3,2 %)'),
                           ('gasto_directo_2025', 55.6e9, 'US$', 'Gasto directo de los visitantes en 2025'),
                           ('impacto_economico_2025', 84.7e9, 'US$', 'Impacto económico total del turismo en 2025'),
                           ('impuestos_turismo_2025', 7.5e9, 'US$', 'Recaudo tributario atribuido al turismo en 2025')]:
        t.cifra(clave, v, u, '2025', 'F29', 'declarado', d, pregunta='P9')
    con = texto(CONCEJO)
    exige(con, '125.8 billion')
    t.fuente('F30', 'año fiscal 2027 (adoptado el 30-jun-2026)', url=CONCEJO, estado='declarado')
    t.cifra('presupuesto_fy2027', 125.8e9, 'US$', 'FY2027 (jul-2026 a jun-2027)', 'F30', 'declarado', 'Presupuesto municipal adoptado para el año fiscal 2027', pregunta='G')
    t.nota('Cifras declaradas: las afirma la entidad que las publica y no se pueden verificar con microdatos abiertos. El script solo comprueba que el comunicado sigue diciendo lo mismo.')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
