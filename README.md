# Cerebro NYC

## Laboratorio territorial

La nueva sección conecta cinco funciones con el lago existente, sin llaves de API ni un servicio de IA:

- **Personalizado** en Panorama: seis pesos, normalizados a 100 %, ranking actualizado y mapa de atención sincronizado. Los empates usan rango medio. Todos los pesos en cero o un valor ausente en una dimensión activa dejan el índice sin resultado; no se imputan valores.
- **Comparador**: doce indicadores, diferencias B − A, puntos porcentuales para porcentajes y lectura automática descriptiva. Incluye fuentes, periodos y márgenes de error del ingreso ACS.
- **Punto/radio** en Gemelo: clic o coordenadas, radios de 500 m, 1 km y 2 km, identificación del PUMA y conteo de filas geográficas MTA. Son registros por andén/línea, no complejos únicos. El contexto distrital no se convierte en un conteo dentro del radio.
- **Temporal**: selector y cursor de periodos reales de aire, MTA y denuncias. Aire y denuncias admiten mapa de valor final o cambio porcentual **por borough**, repetido en sus PUMA. MTA corresponde a la red y no se distribuye sobre distritos. NYPD compara enero–junio de 2025 y 2026.
- **Pregúntale a NYC**: preguntas guiadas que configuran pesos, ranking y mapa mediante reglas locales transparentes; no interpreta texto libre ni consume una API de IA.

La cartografía requiere conexión y WebGL; comparación, cálculos, coordenadas y series funcionan con el paquete local del lago. No hay puntos de incidentes, árboles ni 311 en este lago y no se simulan. El color verde del cambio significa disminución, no una valoración automática de mejora.

Validación: `node tests/analisis.test.cjs` (pesos, empates, ausencias, bases cero, huecos de polígonos y radios sobre geometrías reales). `python scripts/verificar_lago.py` verifica el diccionario; en Windows puede requerir `PYTHONIOENCODING=utf-8`. También se comprobó la interacción en Chrome de escritorio y móvil: preguntas, sliders, comparación, coordenadas y mapas temporales.

Gemelo territorial de la Ciudad de Nueva York construido solo con datos abiertos trazables. Es la réplica, para Nueva York, del [Cerebro Lima](https://cerebro-lima.vercel.app) del Taller de Datos (Gestión y Gobernanza de Datos).

**Abrir:** doble clic en `index.html` (funciona sin servidor gracias a `lago/lago.js`) o publicar la carpeta en Vercel / GitHub Pages.

## Qué responde

| # | Pregunta | Fuentes |
|---|----------|---------|
| P1 | ¿Qué distrito concentra más carga de calidad de vida, inseguridad y siniestralidad por habitante? | F02, F03, F04, F10 |
| P2 | ¿Dónde se cruza la presión del alquiler con bajo ingreso, y cuánta vivienda nueva y asequible llega allí? | F05, F10, F16 |
| P3 | ¿Está bajando el delito este año frente al anterior? | F04, F14 |
| P4 | ¿Quiénes son las víctimas del tránsito y dónde? | F02 |
| P5 | ¿Cuánto se recuperó el transporte público y qué cambió con el peaje de congestión? | F10, F17, F18 |
| P6 | ¿Dónde es peor el aire y hay menos árboles, y coincide con menor ingreso? | F07, F10, F15 |
| P7 | ¿Cuánto interés externo despierta la ciudad y cada borough? | F08 |

## Secciones del sitio

Panorama con **diagnóstico territorial** de los 55 distritos (prioridades intercambiables y prueba de robustez) · **Gemelo 3D** (MapLibre, edificios de OpenStreetMap, 8 lentes, indicador extruido, satélite, estaciones, precintos, barrios) · Gente · Economía y vivienda · Turismo y rodajes · Municipio y 311 · Seguridad · Movilidad · **Correlaciones** (n = 55, Pearson, Spearman y valor p) · **Atlas** ordenable · Ambiente y aire · Escucha (Wikipedia) · Fuentes y gobernanza. Buscador `Ctrl+K`, modo presentación, tema claro/oscuro, reloj y clima en vivo de Central Park.

Cada cifra indica su fuente (ID F##) y su estado: **observado** (sale de una API), **derivado** (calculado por nosotros), **transcrito** (copiado de una tabla oficial sin API) o **declarado** (comunicado oficial, no verificable con microdatos).

## Estructura

```
index.html            sitio (sin build)
css/, js/             estilos y módulos: graficos, diagnostico, mapa, secciones, correlaciones, app
lago/*.json           lago de datos; cada archivo con bloque _meta (fuente, consulta, licencia, fecha de prueba)
lago/geo/*.geojson    geometrías oficiales simplificadas (DCP, MTA)
lago/lago.js          paquete de todo el lago para abrir el sitio sin servidor
scripts/              construcción y verificación del lago y de los entregables
```

## Reproducir

```bash
pip install requests openpyxl python-docx
python scripts/construir_lago.py      # consulta las APIs (≈10 min) y reescribe lago/
python scripts/verificar_lago.py      # falla si un campo del lago no está en el diccionario
python scripts/generar_entregables.py # Excel del diccionario desde la plantilla en blanco
python scripts/generar_word.py        # Word «Por qué estos datos» desde la plantilla en blanco
```

`scripts/catalogo.py` (fuentes), `scripts/diccionario.py` (campos) y `scripts/bitacora.py` (uso de IA) son la única fuente de verdad: el sitio, el Excel y el Word salen de ahí.

## Gobernanza

- **Trazabilidad:** ID de fuente en cada cifra, consulta SoQL exacta en cada `_meta`.
- **Minimización:** de las fuentes con personas identificables (NYPD, DOB) solo se guardan conteos agregados; las coordenadas de delitos se usan en memoria para asignar distrito y se descartan.
- **Licencias:** se copian tal como aparecen. Ningún dataset de NYC Open Data ni de data.ny.gov declara licencia en sus metadatos, así que figuran como «no declara»; el portal se rige por la Local Law 11 de 2012.
- **Calidad:** los defectos encontrados se muestran junto a cada gráfico (trámites duplicados en DOB NOW, fechas como texto, proyecciones con nombre de censo, filas mezcladas en la serie de aire…).
