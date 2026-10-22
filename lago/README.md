# Lago de datos · Cerebro NYC

Lo genera `python ingesta/construir.py`: corre los `ingesta/pull_*.py` en orden, verifica con `node verificacion/verificar.mjs --sin-paquete`, **solo si pasa** escribe `lago.js` (`ingesta/empaquetar.py`) y vuelve a verificar. No se edita a mano.

## El contrato

Cada JSON de tema tiene la misma forma, la del taller:

```
{ tema, titulo, probado,                          probado = día en que corrió la ingesta
  fuentes: [{ id, nombre, entidad, url, consulta, estado, licencia, personas, vigencia, probado }],
  cifras:  { clave: { valor, unidad, vigencia, fuente, tipo, descripcion, pregunta, moe?, formula? } },
  series:  { clave: { descripcion, unidad, vigencia, fuente, tipo, x, pregunta, puntos: [[x, y], …] } },
  listas:  { clave: { descripcion, vigencia, fuente, tipo, columnas: { col: { descripcion, unidad, tipo_dato, tipo,
                      original, transformacion, clasificacion, pregunta, fuente, vigencia, moe? } }, filas: [ … ] } },
  notas, calidad, excluido: [{ campo, fuente, razon }] }
```

- `fuente` es el ID de la hoja *1. Fuentes* del diccionario (F02…F32); `consulta` es la URL exacta que se pidió, re-ejecutable.
- `estado` de la fuente: **vivo** (API probada ese día), **transcrito** (cifra copiada de una página oficial que no se deja descargar), **declarado** (cifra que la entidad afirma en un comunicado), **caído**.
- `tipo` de cada cifra o columna: **medido**, **derivado** (con `formula`), **transcrito**, **declarado**, **proxy**. El sitio lo muestra como etiqueta en cada cifra.
- `moe`: margen de error del ACS al 90 %. Para cada tasa del atlas existe la columna `<tasa>_moe`.
- Las capas `geo/*.geojson` llevan los mismos metadatos como miembros extra del GeoJSON (`tema`, `probado`, `vigencia`, `fuentes`, `columnas`).

## Archivos

| Archivo | Lo escribe | Fuentes | Contenido |
|---|---|---|---|
| `geo/boroughs.geojson`, `distritos_puma.geojson`, `barrios_nta.geojson`, `precintos.geojson`, `estaciones.geojson` | `pull_01_geo.py` | F18–F20, F26, F27 (y F10 en los PUMA) | 5 boroughs, 55 PUMA, 262 NTA, 78 precintos, 496 estaciones; polígonos simplificados |
| `demografia.json` | `pull_02_demografia.py` | F09, F10, F18–F20 | Censo 2020 (transcrito) e indicadores ACS 2020–2024 por borough y por distrito, con margen de error |
| `seguridad_vial.json` | `pull_03_vial.py` | F02 | Choques, heridos y fallecidos 2025 por borough y tipo de víctima (fallecidos solo por borough) |
| `calidad_de_vida_311.json` | `pull_04_311.py` | F03 | Solicitudes 311 de 2025 por borough, tipo y mes (12 consultas mensuales) |
| `seguridad_delitos.json` | `pull_05_delitos.py` | F04, F14 | Denuncias 2025 por borough y categoría; ene–jun 2026 frente a ene–jun 2025 |
| `vivienda.json` | `pull_06_vivienda.py` | F05, F16 | Viviendas propuestas en obra nueva 2025 (solo radicación inicial `-I1`) y vivienda asequible HPD |
| `economia_rodajes.json` | `pull_07_rodajes.py` | F06 | Permisos de rodaje 2025 por borough, categoría y mes |
| `ambiente.json` | `pull_08_ambiente.py` | F07, F15 | Árboles de calle (censo 2015) y serie anual de PM2,5 y NO₂ |
| `escucha_interes.json` | `pull_09_escucha.py` | F08 | Vistas de Wikipedia: **proxy** de interés externo, no de opinión |
| `movilidad.json` | `pull_10_movilidad.py` | F17, F18 | Viajes diarios por modo y mes (sin el mes en curso) y estaciones |
| `declarados.json` | `pull_80_declarados.py` | F29, F30 | Turismo y presupuesto: cifras **declaradas**; el script comprueba que el texto del comunicado las contiene |
| `verificaciones.json` | `pull_85_verificaciones.py` | F11, F12, F21–F25, F28, F31, F32 | Pruebas de vida de candidatas, descartadas y capas en vivo, con la respuesta obtenida |
| `distritos.json` | `pull_90_atlas.py` | F02–F05, F07, F10, F15, F16, F19 | Atlas de los 55 distritos: ACS + tasas por habitante (por 1.000 o 10.000), cada una con su margen de error |
| `catalogo.json` | `pull_99_catalogo.py` | todas | Catálogo (F02–F32), preguntas P1–P13 con su estado y huecos; `probado` real por fuente |
| `lago.js` | `empaquetar.py` | — | Todo lo anterior en un solo archivo (`window.LAGO_PAQUETE`) para abrir el sitio sin servidor |

## Reglas

- **Minimización:** de NYPD, DOB y 311 solo se guardan conteos agregados. Las coordenadas de choques y delitos se usan en memoria para asignar el distrito (punto en polígono) y se descartan; nombres, edad, raza, sexo, direcciones y texto libre no se piden en la consulta. Lo descartado queda listado en `excluido` de cada tema.
- **Conteo mínimo:** la verificación rechaza conteos de personas entre 1 y 9 por distrito.
- **Reproducibilidad:** solo APIs sin llave. El 311 y los delitos se consultan mes a mes porque la consulta anual agota el tiempo de la API. Reconstruir el lago desde cero tardó 3 min 27 s y cambió 1 de 82.131 valores (la temperatura en vivo de F24).
- **Licencias:** se copian literalmente. Ningún dataset de NYC Open Data ni de data.ny.gov declara licencia en sus metadatos: figura «no declara» y el marco de uso (Local Law 11 de 2012, Términos de Uso) va en la observación del catálogo.
- **Calidad:** los defectos de cada fuente van en `calidad` y `notas` de su tema, y el sitio los muestra; no se esconden.
