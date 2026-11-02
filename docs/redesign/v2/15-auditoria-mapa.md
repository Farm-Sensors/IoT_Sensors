# Auditoría de Mapa (`/cliente/mapa`), 2026-11-01

Capturas reales (1366 y 390 px, productor) en `audit/results/audit-mapa/`. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas:** 115 palabras visibles, 6 botones, un mapa de 540 px (escritorio) y 439 px (móvil, con 1576 px de página). El mapa muestra **un solo nodo** de los seis.

## Hallazgos

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **El mapa muestra un solo nodo de seis.** Al entrar hereda el predio y el área que se eligieron antes («Granja Hogar / Area Granja Hogar») y filtra en silencio; el productor cree que ese es todo su campo. | Alta |
| 2 | **El pin es un punto naranja sin nombre, sin cifra y sin leyenda.** No se sabe de qué área es, ni qué significa el naranja. | Alta |
| 3 | **Desde el mapa no se puede entrar al área.** El panel «Detalle de nodo» no tiene ningún enlace a Ahora, Historial o Detalles. Para un mapa que debería ser una vía de navegación, es un callejón sin salida. | Alta |
| 4 | **Vocabulario distinto al resto de la aplicación:** aquí «Fresco / Tardío / Sin lectura / Sin reporte reciente»; en las demás pantallas «Al día / Sin comunicación / Sin datos». «Sin reporte reciente» aparece tres veces (panel, lista y chip). | Alta |
| 5 | **Mucho texto y de plomería:** «Estado (config): Activo», «Comunicación:», «Actualizar capa», «Nodos IoT», y una nota que dice «los estilos se renderizan con MapLibre GL JS» además de la atribución del propio mapa. | Media |
| 6 | **Bloques que no dicen nada:** «Nodos sin GPS: 0», «Sin GPS: 0», «Todos los nodos tienen coordenadas» y la lista «Nodos en el mapa» (que repite el panel de al lado con un solo elemento). | Media |
| 7 | **Fecha en formato estadounidense de 12 h** («10/29/2026, 9:00:00 PM»), distinto del dd/MM de toda la aplicación, y la frescura como «Hace 63h 18min». | Media |
| 8 | **«Actualizar capa» es un botón que no debería hacer falta:** la capa debe refrescarse sola y decir cuándo se actualizó. | Media |
| 9 | **El mapa de calles tiene mucho ruido** (nombres de colonias, carreteras) para ubicar un terreno agrícola. | Baja |
| 10 | **Móvil:** 1576 px; el detalle queda debajo del mapa, fuera de la pantalla, y el mapa no ocupa el ancho. | Alta |

Causa de fondo: la pantalla es un **formulario con un mapa dentro**, no un mapa. El productor quiere ver **todos sus terrenos, cuáles están bien y entrar a uno**.

## Propuesta (pendiente de aprobar)

1. **Mostrar todos los nodos por defecto.** Los filtros pasan a ser chips encima del mapa: **Todos** (activo) y uno por predio. Elegir un predio centra el mapa en él; nada se oculta en silencio.
2. **Pines con sentido:** cada pin lleva el **nombre del área y su humedad** (por ejemplo «Nogal Norte · 61 %»), con el mismo vocabulario y colores de la aplicación: al día (verde), sin comunicación (rojo, con ícono), sin datos (gris). Una **leyenda de tres elementos** en una esquina.
3. **Tocar un pin abre una tarjeta** (ventana sobre el mapa en escritorio, hoja inferior en móvil) con: área, predio, humedad, estado y «hace 2 días», y el botón **«Abrir área»** que lleva a Ahora. Desaparece el panel lateral permanente.
4. **Lista compacta de áreas** (colapsable) para quien prefiera elegir de una lista: tocar un renglón enfoca el pin.
5. **Quitar lo que sobra:** «Actualizar capa» (se refresca cada 30 s y dice «Actualizado hace 1 min»), «Estado (config)», la nota de MapLibre, los chips con 0 y «Nodos sin GPS» cuando no hay ninguno (si lo hay: una línea «1 área sin ubicación: X»).
6. **Fechas** en dd/MM HH:mm de 24 h y frescura como en el resto («hace 2 días»).
7. **Mapa más grande:** ocupa el alto de la pantalla (menos la barra superior); en móvil, a todo el ancho con la hoja inferior.
8. **Detalles › «Abrir el mapa» centra el mapa en esa área** (hoy abre el mapa general).
9. **Decisión pendiente:** una capa de **satélite** (muestra los cultivos reales) como en el prototipo A. Exige revisar la licencia del proveedor (Esri) antes de producción; no se incluye si no lo autorizas.

**Meta medible:** de 115 a unas 30 palabras visibles antes de tocar un pin, sin botones de plomería, todos los nodos visibles y el mapa ocupando al menos el 70 % del alto de la pantalla. Se mantienen: mismos endpoints (`/nodes/geo`), `null` nunca como 0, vocabulario Predio/Área de riego/Nodo.

## Aplicado, sin satélite (2026-11-01)

`ClientMapPage.tsx` se rehízo; `AdminMapPage`, `mapHelpers` y `useGeoNodesData` **no se tocaron** (el admin sigue como estaba).
- **Todos los nodos por defecto:** el mapa ya no hereda el predio ni el área elegidos antes. Arriba hay chips **Todos** y uno por predio (solo si hay más de un predio); elegir un predio encuadra sus pines, y nada se oculta en silencio.
- **Pines con sentido:** cada pin es un botón con el **nombre del área** y su **humedad** (o su estado), con una franja de color y el vocabulario de la aplicación (Al día, Sin comunicación, Sin datos) y una leyenda de tres elementos. La humedad sale de `/readings/latest` (los mismos datos de «Mis predios»). Los pines se arman con `textContent`, nunca con HTML.
- **Tocar un pin abre una tarjeta** sobre el mapa (hoja inferior en móvil): área, predio, cultivo, humedad, estado, «hace X» y el botón **«Abrir área»** (enlace a `/cliente/area/:id`). Se cierra con la X o tocando el mapa. Se retiró el panel lateral fijo.
- **«Ver como lista (N)»**, plegado, para elegir un área sin buscar su pin.
- **Se quitó lo que sobraba:** «Actualizar capa» (el mapa se refresca solo cada 30 s y dice «Actualizado hace un momento»), «Estado (config)», la nota de MapLibre, los contadores en 0 y «Nodos sin GPS». Si hay áreas sin pin: una línea («1 área no aparece porque no tiene ubicación: …»).
- **Mapa grande:** 702 de 900 px en escritorio (78 %); 506 de 844 px en móvil (60 %).
- **Detalles › «Abrir el mapa»** ahora abre `/cliente/mapa?area=ID`: el mapa se centra en esa área y abre su tarjeta.
- **Defectos corregidos durante la prueba:** MapLibre fijaba la posición del contenedor y lo dejaba en 300 px (el mapa se veía vacío); se anidó el contenedor y se añadió un observador de tamaño que redimensiona y encuadra cuando la altura es definitiva.
- **Limitaciones:** con áreas muy próximas los pines se superponen al alejar el mapa (la lista resuelve el acceso). No se incluyó la capa de satélite, por decisión de JP.
- **Pruebas:** typecheck, 159 unitarias (se reescribieron las 3 del mapa) y build; sin errores de JavaScript. Flujo comprobado con clics reales: predio → pin → tarjeta → «Abrir área», y Detalles → mapa centrado.

## Ajuste posterior: primero los predios, después los nodos

JP pidió que el mapa muestre **solo los predios** al entrar y que los nodos aparezcan **cuando se elige un predio**.
- **Vista inicial:** un pin por predio, colocado en el centro de sus nodos, con su nombre y «N áreas · todas al día» (o «N áreas · X al día»). El resumen cuenta **todas** las áreas del predio, aunque alguna no tenga ubicación y no lleve pin. Pista: «Toca un predio para ver sus áreas».
- **Elegir un predio** (tocando su pin, su chip o su renglón de la lista) reemplaza los pines por los de **sus áreas** (nombre y humedad), encuadra el mapa en ellas y muestra el enlace «Detalle de <predio>». Los chips son siempre: «Todos los predios» + uno por predio; «Todos los predios» regresa a la vista inicial.
- Tocar el pin de un área abre su tarjeta con «Abrir área», como antes. El aviso de áreas sin ubicación solo aparece dentro de un predio y solo habla de las de ese predio.
- **Detalles › «Abrir el mapa»** (`?area=ID`) abre directamente el predio de esa área, la centra y abre su tarjeta.
- La lista plegada sigue el mismo orden: predios al inicio, áreas dentro de un predio.
- Comprobado en el navegador (escritorio y móvil) con clics reales: inicio con 3 pines de predio, al elegir uno aparecen sus áreas, volver deja los 3 predios, y desde Detalles abre la tarjeta del área. Limitación: con predios muy cercanos los pines se superponen al alejar (en los datos de prueba, Granja Hogar y Campus Reforestado están a ~1 km); la lista y los chips resuelven el acceso. typecheck, 160 unitarias y build.
