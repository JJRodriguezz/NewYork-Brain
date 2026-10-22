"""Llena la plantilla EN BLANCO del diccionario de datos leyendo el lago (que trae su propio diccionario: cada cifra,
serie y columna declara su significado, unidad, tipo, fuente y vigencia). Así el Excel no puede tener campos que no
están en el lago, ni le pueden faltar.

Ajustes de la entrega 2 (retroalimentación): sin la fila de ejemplo de Medellín, y la hoja Resumen con sus fórmulas
y con el valor ya calculado dentro de cada celda (se ve en cualquier visor, también sin recalcular).

Uso: python scripts/generar_excel.py [plantilla] [salida]
"""
import copy, glob, json, os, re, shutil, sys, tempfile, zipfile
import openpyxl
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'ingesta')); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from preguntas import PREGUNTAS          # noqa: E402
from bitacora import BITACORA, GRUPO     # noqa: E402

LAGO = os.path.join(RAIZ, 'lago')
PADRE = os.path.dirname(RAIZ)
PLANTILLA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PADRE, 'Diccionario_de_datos_TallerDatos.xlsx')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(PADRE, 'Diccionario_de_datos_TallerDatos_NuevaYork.xlsx')
TEXTO_P = {p['id']: p['texto'] for p in PREGUNTAS}
PRIMERA = 4          # ya no hay fila de ejemplo: los datos empiezan en la fila 4
ORDEN = ['demografia', 'distritos', 'calidad_de_vida_311', 'seguridad_delitos', 'seguridad_vial', 'vivienda', 'economia_rodajes', 'ambiente',
         'movilidad', 'escucha_interes', 'declarados', 'verificaciones', 'catalogo']


# ------------------------------------------------------------------ utilidades
def fmt(v):
    if isinstance(v, bool):
        return 'Sí' if v else 'No'
    if isinstance(v, int):
        return f'{v:,}'.replace(',', '.')
    if isinstance(v, float):
        return f'{v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.').rstrip('0').rstrip(',')
    if isinstance(v, (list, dict)):
        return json.dumps(v, ensure_ascii=False)[:120]
    return str(v)


def tipo_de(vals):
    vs = [v for v in vals if v is not None]
    if not vs:
        return 'Texto'
    if all(isinstance(v, bool) for v in vs):
        return 'Booleano'
    if all(isinstance(v, int) and not isinstance(v, bool) for v in vs):
        return 'Entero'
    if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in vs):
        return 'Decimal'
    if all(isinstance(v, str) and re.fullmatch(r'\d{4}-\d{2}(-\d{2})?', v) for v in vs):
        return 'Fecha'
    return 'Texto'


def ejemplo_rango(vals):
    vs = [v for v in vals if v is not None]
    if not vs:
        return '(sin valores)', '—'
    nums = [v for v in vs if isinstance(v, (int, float)) and not isinstance(v, bool)]
    ej = vs[len(vs) // 2]
    if nums and len(nums) == len(vs):
        return fmt(ej), (f'valor único: {fmt(nums[0])}' if min(nums) == max(nums) else f'{fmt(min(nums))} a {fmt(max(nums))}')
    distintos = sorted({fmt(v) for v in vs})
    return fmt(ej)[:120], (' / '.join(distintos)[:250] if len(distintos) <= 7 else f'texto ({len(distintos)} valores distintos)')


ids = lambda f: ', '.join(f) if isinstance(f, list) else (f or '—')


# ------------------------------------------------------------------ filas del diccionario, leídas del lago
def diccionario():
    filas = []

    def fila(fid, archivo, campo, original, significado, tipo_dato, unidad, vals, clas, transf, preg):
        ej, rango = ejemplo_rango(vals)
        filas.append([fid, archivo, campo, original or '—', significado, tipo_dato, unidad or '—', ej,
                      'Sí' if any(v is None for v in vals) or not vals else 'No', rango, clas, transf or 'Ninguna', TEXTO_P.get(preg, TEXTO_P['G'])])

    temas = {os.path.basename(r)[:-5]: json.load(open(r, encoding='utf-8')) for r in glob.glob(os.path.join(LAGO, '*.json'))}
    # 1) la envoltura del contrato: la misma en todos los archivos
    TODOS = 'lago/*.json (todos los temas)'
    env = [('tema', 'Nombre del tema (archivo)', 'Texto', 'nombre'), ('titulo', 'Título legible del tema', 'Texto', 'texto'),
           ('probado', 'Día en que se corrió la ingesta del tema', 'Fecha', 'AAAA-MM-DD'),
           ('fuentes[].id', 'ID de la fuente en la hoja «1. Fuentes»', 'Código', 'código F##'), ('fuentes[].nombre', 'Nombre del conjunto de datos', 'Texto', 'nombre'),
           ('fuentes[].entidad', 'Entidad que lo publica', 'Texto', 'nombre'), ('fuentes[].url', 'URL exacta consultada', 'Texto', 'URL'),
           ('fuentes[].consulta', 'Consulta SoQL o parámetros usados, para reproducir la cifra', 'Texto', 'texto'),
           ('fuentes[].estado', 'Respuesta de la fuente al probarla (vivo, transcrito, declarado, caído)', 'Texto', 'categoría'),
           ('fuentes[].licencia', 'Licencia tal como la declara la fuente («no declara» si no trae)', 'Texto', 'texto'),
           ('fuentes[].personas', '¿La fuente original trae datos de personas?', 'Texto', 'categoría'),
           ('fuentes[].vigencia', 'Periodo que cubren los datos usados de esa fuente', 'Texto', 'texto'),
           ('fuentes[].probado', 'Día en que esa fuente respondió', 'Fecha', 'AAAA-MM-DD'),
           ('cifras.<clave>.valor / unidad / vigencia / fuente / tipo / descripcion / pregunta / moe / formula', 'Forma de toda cifra suelta del lago (ver filas «cifras.» de cada tema)', 'Texto', '—'),
           ('series.<clave>.puntos[]', 'Forma de toda serie: pares [periodo, valor], con unidad, vigencia, fuente y tipo', 'Texto', '—'),
           ('listas.<clave>.columnas.<campo>', 'Diccionario incrustado: descripción, unidad, tipo de dato, tipo, fuente, vigencia, campo original, transformación, clasificación y pregunta de cada columna', 'Texto', '—'),
           ('notas[]', 'Advertencias de lectura del tema', 'Texto', 'texto'), ('calidad[]', 'Defectos de la fuente encontrados al construir el tema', 'Texto', 'texto'),
           ('excluido[].campo / fuente / razon', 'Campos que existen en la fuente y NO entran al lago, con la razón', 'Texto', 'texto')]
    muestra = temas['seguridad_vial']
    for campo, sig, td, u in env:
        clave = campo.split('[')[0].split('.')[0]
        v = muestra.get(clave)
        vals = [v] if not isinstance(v, (list, dict)) else ([x.get(campo.split('.')[-1].split(' ')[0]) for x in v] if isinstance(v, list) and v and isinstance(v[0], dict) else [fmt(v)])
        fila('(todas)', TODOS, campo, '(contrato del taller)', sig, td, u, vals, 'Pública', 'La escribe ingesta/comun.py (clase Tema)', 'G')

    # 2) cada tema: cifras, series y columnas de sus listas
    for t in ORDEN:
        d = temas.get(t)
        if not d or t == 'catalogo':
            continue
        arch = f'lago/{t}.json'
        for k, c in d['cifras'].items():
            fila(ids(c['fuente']), arch, f'cifras.{k}', c.get('formula') and '(calculada)' or '(agregado de la fuente)', c['descripcion'],
                 tipo_de([c['valor']]), c['unidad'], [c['valor']], 'Pública', c.get('formula') or f"Tipo «{c['tipo']}»", c.get('pregunta', 'G'))
        for k, s in d['series'].items():
            fila(ids(s['fuente']), arch, f'series.{k}.puntos[]', s.get('x', 'periodo') + ', valor', s['descripcion'] + f" (tipo «{s['tipo']}»)",
                 tipo_de([p[1] for p in s['puntos']]), s['unidad'], [p[1] for p in s['puntos']], 'Pública', f"Pares [{s.get('x', 'periodo')}, valor]; vigencia {s['vigencia']}", s.get('pregunta', 'G'))
        for l, lista in d['listas'].items():
            for c, defi in lista['columnas'].items():
                vals = [f.get(c) for f in lista['filas']]
                fila(ids(defi.get('fuente')), arch, f'listas.{l}.filas[].{c}', defi.get('original'), defi['descripcion'] + f" (tipo «{defi['tipo']}»)",
                     defi.get('tipo_dato') or tipo_de(vals), defi.get('unidad'), vals, defi.get('clasificacion', 'Pública'), defi.get('transformacion'), defi.get('pregunta', 'G'))
    # 3) el catálogo
    cat = temas['catalogo']
    for campo, sig in [('fuentes[].*', 'Una fila por fuente encontrada, entre o no al lago (espejo de la hoja «1. Fuentes», con la fecha real de prueba)'),
                       ('preguntas[].id / texto / estado / seccion / limite / entrega1', 'Preguntas del sistema, su estado (respondida, parcial, pendiente) y su límite'),
                       ('huecos[].quien / por_que', 'Quién no aparece, o aparece mal, en las fuentes del lago')]:
        clave = campo.split('[')[0]
        fila('(todas)', 'lago/catalogo.json', campo, '(propio)', sig, 'Texto', 'texto', [len(cat[clave])], 'Pública', 'ingesta/pull_99_catalogo.py', 'G')
    # 4) las capas geográficas
    for r in sorted(glob.glob(os.path.join(LAGO, 'geo', '*.geojson'))):
        g = json.load(open(r, encoding='utf-8'))
        arch = 'lago/geo/' + os.path.basename(r)
        for c, defi in g['columnas'].items():
            vals = [f['geometry']['type'] for f in g['features']] if c == 'geometry' else [f['properties'].get(c) for f in g['features']]
            campo = 'features[].geometry' if c == 'geometry' else f'features[].properties.{c}'
            fila(ids(defi.get('fuente') or [f['id'] for f in g['fuentes']]), arch, campo, defi.get('original'), defi['descripcion'], defi.get('tipo_dato', 'Texto'),
                 defi.get('unidad'), [json.dumps(v) if isinstance(v, list) else v for v in vals], defi.get('clasificacion', 'Pública'), defi.get('transformacion'), defi.get('pregunta', 'G'))
    return filas


# ------------------------------------------------------------------ hojas
def estilo_filas(ws, desde, hasta, modelo):
    est = [copy.copy(ws.cell(modelo, c)._style) for c in range(1, ws.max_column + 1)]
    for r in range(desde, hasta + 1):
        for c, st in enumerate(est, 1):
            ws.cell(r, c)._style = copy.copy(st)
    alto = ws.row_dimensions[modelo].height
    for r in range(desde, hasta + 1):
        ws.row_dimensions[r].height = alto


def ampliar_validaciones(ws, ultima):
    for dv in ws.data_validations.dataValidation:
        dv.sqref = openpyxl.worksheet.cell_range.MultiCellRange(re.sub(r'([A-Z])5:([A-Z])44', rf'\g<1>{PRIMERA}:\g<2>{ultima}', str(dv.sqref)))


def escribir(ws, filas, ultima):
    for i in range(PRIMERA, ultima + 1):
        for j in range(1, ws.max_column + 1):
            ws.cell(i, j).value = None
    for i, f in enumerate(filas):
        for j, v in enumerate(f, 1):
            ws.cell(PRIMERA + i, j, v)


def main():
    wb = openpyxl.load_workbook(PLANTILLA)
    cat = json.load(open(os.path.join(LAGO, 'catalogo.json'), encoding='utf-8'))
    fuentes = [[f['id'], f['nombre'], f['entidad'], f['tipo_publicador'], f['url'], f['formato'], f['como_se_obtiene'], f['licencia'], f['personas'],
                f['cobertura'], f['vigencia'], f['frecuencia'], f['probado'], f['estado_catalogo'], f['como_la_encontraron'],
                f"{f['observaciones']} → Alimenta: {f['alimenta']}"] for f in cat['fuentes']]
    dic = diccionario()
    bit = [[i + 1, b['herramienta'], b['encargo'], b['respuesta'], b['comprobacion'], b['resultado'], b['fuente'], b['aprendizaje']] for i, b in enumerate(BITACORA)]
    ultima = max(44, PRIMERA + max(len(fuentes), len(dic), len(bit)) + 10)

    ins = wb['Instrucciones']
    ins['B1'] = ins['B1'].value + ' · actualizado para la Entrega 2 (solo lo que hay en el lago; probado el ' + max(f[12] for f in fuentes if f[12]) + ')'
    ins['B5'] = f"Ciudad elegida: {GRUPO['ciudad']}"
    ins['B6'] = f"Integrantes: {GRUPO['integrantes']}"
    ins['B7'] = f"Enlace al repositorio o a la carpeta del lago: {GRUPO['repo']} · Sistema publicado: {GRUPO['sitio']}"
    ins['B16'] = ins['B16'].value + ' (Entrega 2: se retiró la fila de ejemplo de Medellín, según la retroalimentación; los datos empiezan en la fila 4 y las fórmulas del Resumen se ajustaron a esa fila.)'

    for nombre, filas in (('1. Fuentes', fuentes), ('2. Diccionario', dic), ('3. Bitácora IA', bit)):
        ws = wb[nombre]
        estilo_filas(ws, PRIMERA, ultima, 5)        # la fila 4 (gris, de ejemplo) toma el estilo amarillo de las filas de datos
        ampliar_validaciones(ws, ultima)
        escribir(ws, filas, ultima)

    res = wb['Resumen']
    res['A2'] = 'Se calcula solo desde las otras hojas, desde la fila 4 (la fila de ejemplo se retiró). Cada celda guarda su fórmula y el último valor calculado.'
    for fila in res.iter_rows():
        for c in fila:
            if isinstance(c.value, str) and c.value.startswith('='):
                c.value = re.sub(r"(\$?[A-Z]\$?)5:(\$?[A-Z]\$?)44\b", rf'\g<1>{PRIMERA}:\g<2>{ultima}', c.value)
    wb.calculation.fullCalcOnLoad = True      # Excel recalcula al abrir
    wb.save(SALIDA)

    # valores calculados (los mismos que darían las fórmulas), guardados dentro de cada celda del Resumen
    N = [f[13] for f in fuentes]; H = [f[7] for f in fuentes]; I = [f[8] for f in fuentes]
    K = [f[10] for f in dic]; M = [f[12] for f in dic]; R = [b[5] for b in bit]
    valores = {'B4': len(fuentes), 'B5': N.count('Integrada al lago'), 'B6': N.count('Candidata'), 'B7': N.count('No responde'),
               'B8': N.count('No existe (la inventó la IA)'), 'B9': N.count('Descartada'), 'B10': H.count('no declara') + sum(1 for h in H if not h),
               'B11': I.count('Personas identificables') + I.count('Texto libre sin revisar'), 'B12': len(dic),
               'B13': K.count('Sensible') + K.count('Dato personal'), 'B14': sum(1 for m in M if not m), 'B15': len(bit),
               'B16': R.count('Incorrecto') + R.count('Inventado'), 'B17': (R.count('Correcto') / len(bit)) if bit else 0}
    hoja = 'xl/worksheets/sheet%d.xml' % (wb.sheetnames.index('Resumen') + 1)
    tmp = tempfile.mktemp(suffix='.xlsx')
    with zipfile.ZipFile(SALIDA) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == hoja:
                xml = data.decode('utf-8')
                for ref, v in valores.items():
                    xml = re.sub(rf'(<c r="{ref}"[^>]*>)(<f>.*?</f>)(<v>.*?</v>)?', lambda m: m.group(1) + m.group(2) + f'<v>{v}</v>', xml, count=1)
                data = xml.encode('utf-8')
            zout.writestr(item, data)
    shutil.move(tmp, SALIDA)
    print(f'✓ {SALIDA}\n  fuentes: {len(fuentes)} · campos del diccionario: {len(dic)} · bitácora: {len(bit)} · Resumen: {valores}')


if __name__ == '__main__':
    main()
