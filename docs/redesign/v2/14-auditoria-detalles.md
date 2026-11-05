# Auditoría de Área › Detalles (`/cliente/area/:id/detalles`), 2026-11-01

Capturas reales (1366 y 390 px, productor; DEMO - Nogal Norte con nodo y sin ciclo, y Area Granja Hogar con ciclo) en `audit/results/audit-detalles/`. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas:** 900 px de alto en escritorio y 950 px en móvil; 56 a 65 palabras; 12 pares etiqueta/valor repartidos en 3 secciones.

## Hallazgos

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **Repite lo que ya está arriba:** «Cultivo» y «Tamaño» ya salen bajo el título («Nogal · 12.5 ha») y «Predio» ya está en la ruta de navegación. Tres de los cuatro datos de la sección «Área» sobran. | Alta |
| 2 | **Las coordenadas salen dos veces y en crudo:** «Ubicación del predio» muestra `28.6850292,-106.0765387` y el GPS del nodo muestra casi lo mismo. La portada ya traduce eso a «Ubicado por coordenadas»; aquí no. | Alta |
| 3 | **«Número de serie: —» en todos los nodos:** un campo vacío que no sirve para nada ocupa una fila entera. | Media |
| 4 | **Media pantalla vacía:** el ciclo de cultivo, lo más relevante de esta vista, es una columna corta a la derecha con un par de líneas, mientras la izquierda es larga. | Alta |
| 5 | **Los ciclos anteriores están en letra diminuta** («Ciclos anteriores: 01/09/2025 a 30/11/2025; …») dentro de un párrafo, sin forma de leerlos de un vistazo. | Media |
| 6 | **Sin jerarquía ni nada visual:** son filas de etiquetas grises muy pequeñas con valores en negrita separadas por líneas. Todo pesa igual y se ve como un formulario de solo lectura. | Media |
| 7 | **«Ver en el mapa» es un enlace subrayado diminuto** que lleva al mapa general, no a este nodo. | Media |
| 8 | **Formatos mezclados:** «12.5 ha» en monoespaciada, «Nogal» en sans, fecha en monoespaciada, GPS con 4 a 7 decimales. | Baja |

Causa de fondo: la pantalla vuelca todos los campos de la base de datos en lista, en vez de responder dos preguntas del productor: **«¿en qué momento del ciclo va esta área?»** y **«¿dónde está mi nodo?»**.

## Propuesta (pendiente de aprobar)

1. **Quitar lo repetido:** se eliminan Cultivo, Tamaño y Predio (ya están en el título y en la ruta). La ubicación solo aparece si es un texto real, nunca coordenadas.
2. **Ciclo de cultivo, primero y con forma visual:** una barra de avance entre el inicio y el fin con «Día 32 de 90» (si el ciclo tiene fin) o «Desde el 01/10/2026 · 32 días» (si no lo tiene), con las fechas en los extremos. Los **ciclos anteriores** pasan a una lista corta de filas legibles («Sep 2025 – Nov 2025»). Sin ciclo activo: un aviso claro de qué falta y quién lo define.
3. **Nodo con un minimapa:** un mapa pequeño de unos 200 px con el pin del nodo (el mismo mapa de la aplicación) reemplaza las coordenadas en crudo; el nombre del nodo y las coordenadas formateadas (`29.0892° N, 110.9588° O`) van debajo, y **«Ver en el mapa» pasa a ser un botón** que abre el mapa centrado en este nodo. El número de serie solo se muestra si existe.
4. **Dos tarjetas de igual altura** (Ciclo y Nodo) en escritorio y apiladas en móvil, con el mismo formato de valores.
5. Se mantiene la insignia «Equipo del predio» solo cuando hay un problema.

**Meta medible:** de 12 pares etiqueta/valor a unos 5, de 65 a unas 40 palabras, sin media pantalla vacía y con dos elementos visuales (barra del ciclo y minimapa). Se mantienen: `null` nunca como 0, mismos endpoints (`/crop-cycles`, `/nodes/geo`), sin recomendaciones de riego.

## Aplicado, versión ligera (2026-11-01)

JP eligió la versión sin minimapa.
- **Se quitó lo repetido:** Cultivo, Tamaño y Predio (ya están en el título y la ruta). La ubicación del predio solo aparece si es texto real, nunca unas coordenadas.
- **Ciclo de cultivo, primero:** «Día 32 de 90» con barra de avance y fechas en los extremos si el ciclo tiene fin; «Desde hace 31 días» y la fecha de inicio si no lo tiene. Los **ciclos anteriores** pasan a una lista de filas (hasta 5, con «y N más»). Sin ciclo activo, un aviso claro.
- **Nodo:** nombre, **coordenadas formateadas** (`29.0892° N, 110.9588° O`), número de serie **solo si existe** y la insignia del equipo solo si hay un problema. El enlace pasó a un **botón «Abrir el mapa»** (abre el mapa general: la página del mapa todavía no admite centrarse en un nodo, así que no se promete).
- **Dos tarjetas de igual altura** en escritorio, apiladas en móvil.
- **Medido:** de 12 pares etiqueta/valor a 2–5, de 56–65 a 42–53 palabras; sin media pantalla vacía. typecheck, 159 unitarias y build; sin cambios en endpoints.
