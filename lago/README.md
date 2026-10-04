# Lago de datos · Cerebro NYC

Generado por `scripts/construir_lago.py`. No se edita a mano. Cada archivo trae un bloque `_meta` con la fuente (`id_fuente`, que coincide con la hoja *1. Fuentes* del diccionario), la URL de la API, la consulta SoQL, la licencia tal como aparece, si la fuente trae personas, cobertura, periodo, frecuencia y la fecha en que la API respondió.

| Archivo | Fuentes | Contenido | Periodo |
|---|---|---|---|
| `demografia.json` | F09, F10, F18, F20 | Población, superficie, densidad e indicadores ACS por borough (con margen de error) | Censo 2020; ACS 2020–2024 |
| `distritos.json` | F02–F05, F07, F10, F15, F16, F19 | Atlas de los 55 distritos comunitarios (PUMA): ACS + tasas por habitante | 2025 / ACS 2020–2024 |
| `calidad_de_vida_311.json` | F03 | Solicitudes 311 por borough, tipo y mes | 2025 |
| `seguridad_delitos.json` | F04, F14 | Denuncias por borough y categoría legal; ene–jun 2026 vs 2025 | 2025–2026 |
| `seguridad_vial.json` | F02 | Choques, heridos y fallecidos por tipo de víctima | 2025 |
| `vivienda.json` | F05, F16 | Obra nueva radicada (depurada) y vivienda asequible HPD | 2025; desde 2014 |
| `economia_rodajes.json` | F06 | Permisos de rodaje por borough, categoría y mes | 2025 |
| `ambiente.json` | F07, F15 | Árboles de calle (2015) y serie anual de PM2,5 y NO₂ | 2009–último año |
| `movilidad.json` | F17, F18 | Viajes diarios promedio por modo y mes; estaciones | 2020-03 → hoy |
| `escucha_interes.json` | F08 | Vistas de Wikipedia de la ciudad y los boroughs | últimos 24 meses |
| `verificaciones.json` | F11, F12, F21–F25, F32 | Pruebas de vida de las fuentes candidatas y descartadas | día de la prueba |
| `catalogo.json` | todas | Espejo de la hoja de fuentes | — |
| `geo/*.geojson` | F18–F20, F26, F27 | Boroughs, PUMA, barrios NTA, precintos y estaciones (simplificados) | vigente |
| `lago.js` | — | Paquete de todo lo anterior para abrir el sitio sin servidor | — |

## Reglas

- **Minimización:** de NYPD y DOB solo se guardan conteos agregados. Las coordenadas de delitos se usan en memoria para asignar distrito y se descartan; los nombres de dueños y solicitantes no se piden en la consulta.
- **Reproducibilidad:** solo APIs sin llave. El 311 y los delitos se consultan mes a mes porque la consulta anual agota el tiempo de la API.
- **Licencias:** ningún dataset de NYC Open Data ni de data.ny.gov declara licencia en sus metadatos: figura «no declara» y se explica el marco (Local Law 11 de 2012) en la observación.
- **Calidad:** los defectos de cada fuente se documentan en `_meta.nota`, no se esconden.
