"""Reconstruye el lago completo: corre cada ingesta (ingesta/pull_*.py, en orden), verifica y solo si la
verificación pasa escribe lago/lago.js, el paquete que lee el sitio. Con un FAIL no se publica.

    python ingesta/construir.py            # todo
    python ingesta/construir.py 03 05      # solo algunas ingestas (por número), luego catálogo, verificación y paquete
"""
import glob, os, subprocess, sys, time

for _flujo in (sys.stdout, sys.stderr):   # consolas de Windows (cp1252) no imprimen ✓
    try:
        _flujo.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)


def correr(cmd):
    print(f'\n$ {" ".join(cmd)}', flush=True)
    return subprocess.run(cmd, cwd=RAIZ, env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}).returncode


def main():
    t = time.time()
    scripts = sorted(glob.glob(os.path.join(AQUI, 'pull_*.py')))
    pedidos = sys.argv[1:]
    if pedidos:
        scripts = [s for s in scripts if any(os.path.basename(s).startswith(f'pull_{p}') for p in pedidos) or 'pull_99' in s]
    for s in scripts:
        if correr([sys.executable, s]):
            sys.exit(f'✗ falló {os.path.basename(s)}: el lago anterior queda como estaba en lago/lago.js')
    if correr(['node', 'verificacion/verificar.mjs', '--sin-paquete']):
        sys.exit('✗ la verificación falló: NO se escribe lago/lago.js y no se publica')
    if correr([sys.executable, os.path.join(AQUI, 'empaquetar.py')]) or correr(['node', 'verificacion/verificar.mjs']):
        sys.exit('✗ el paquete no coincide con el lago')
    print(f'\n✓ lago reconstruido, verificado y empaquetado en {time.time() - t:.0f} s')


if __name__ == '__main__':
    main()
