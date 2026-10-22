"""Ingesta · interés externo (F08 Wikimedia Pageviews): vistas mensuales de personas, sin bots.
Es un PROXY de atención, no de opinión. Se exige que cada título sea un artículo (no una desambiguación ni una redirección)."""
import datetime, urllib.parse
from comun import *

ARTICULOS = [('en', 'New_York_City', 'Nueva York (inglés)'), ('es', 'Nueva_York', 'Nueva York (español)'), ('en', 'Manhattan', 'Manhattan'),
             ('en', 'Brooklyn', 'Brooklyn'), ('en', 'Queens', 'Queens'), ('en', 'The_Bronx', 'Bronx'), ('en', 'Staten_Island', 'Staten Island')]


def ventana():
    """24 meses completos que terminan en el mes anterior al actual."""
    hoy = datetime.date.today().replace(day=1)
    fin = hoy - datetime.timedelta(days=1)
    ini = (fin.replace(day=1) - datetime.timedelta(days=700)).replace(day=1)
    return ini.strftime('%Y%m0100'), fin.strftime('%Y%m%d00'), ini.strftime('%Y-%m'), fin.strftime('%Y-%m')


def main():
    print('· escucha (Wikipedia)')
    desde, hasta, d_txt, h_txt = ventana()
    t = Tema('escucha_interes', 'Interés externo por la ciudad')
    base = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{}.wikipedia/all-access/user/{}/monthly/{}/{}'
    for lang, art, etiqueta in ARTICULOS:
        res = get(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(art)}').json()
        assert res.get('type') == 'standard', f'«{art}» no es un artículo: {res.get("type")}'
        canon = urllib.parse.quote(res['titles']['canonical'])
        r = get(base.format(lang, canon, desde, hasta)); r.raise_for_status()
        puntos = [[f"{i['timestamp'][:4]}-{i['timestamp'][4:6]}", i['views']] for i in r.json()['items']]
        clave = f'vistas_{lang}_{art}'.lower()
        t.serie(clave, puntos, 'vistas de personas', f'{d_txt} a {h_txt}', 'F08', 'proxy',
                f'Vistas mensuales del artículo «{etiqueta}» ({lang}.wikipedia), agente user', pregunta='P7')
        t.d['series'][clave]['etiqueta'] = etiqueta
    t.fuente('F08', f'{d_txt} a {h_txt}', url=base.format('en', 'New_York_City', desde, hasta))
    s = t.d['series']['vistas_en_new_york_city']['puntos']
    ult12 = sum(v for _, v in s[-12:])
    pico = max(s, key=lambda p: p[1])
    t.cifra('vistas_12_meses', ult12, 'vistas de personas', f'{s[-12][0]} a {s[-1][0]}', 'F08', 'proxy', 'Vistas del artículo «New York City» en los últimos 12 meses', pregunta='P7')
    t.cifra('mes_pico', pico[0], 'mes', f'{d_txt} a {h_txt}', 'F08', 'derivado', f'Mes de mayor interés ({pico[1]} vistas)', pregunta='P7')
    t.nota('Proxy de atención externa: una vista no dice si quien lee piensa bien o mal de la ciudad. Los picos suelen coincidir con noticias.')
    t.guardar()


if __name__ == '__main__':
    ejecutar(main)
