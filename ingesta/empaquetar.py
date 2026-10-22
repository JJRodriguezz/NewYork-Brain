"""Escribe lago/lago.js: todo el lago en un solo archivo, para que el sitio abra también con doble clic (file://).
Lo llama construir.py solo después de que la verificación pasó."""
import glob, json, os
from comun import LAGO, HOY


def main():
    datos = {os.path.basename(r)[:-5]: json.load(open(r, encoding='utf-8')) for r in sorted(glob.glob(os.path.join(LAGO, '*.json')))}
    geo = {os.path.basename(r)[:-8]: json.load(open(r, encoding='utf-8')) for r in sorted(glob.glob(os.path.join(LAGO, 'geo', '*.geojson')))}
    ruta = os.path.join(LAGO, 'lago.js')
    with open(ruta, 'w', encoding='utf-8') as f:
        f.write('// Paquete generado por ingesta/empaquetar.py después de pasar la verificación. No editar a mano.\n')
        f.write('window.LAGO_PAQUETE=' + json.dumps({'generado': HOY, 'datos': datos, 'geo': geo}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'  ✓ lago.js ({os.path.getsize(ruta) / 1024:.0f} KB, {len(datos)} temas, {len(geo)} capas)')


if __name__ == '__main__':
    main()
