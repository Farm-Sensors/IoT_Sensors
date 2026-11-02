# Auditoría de «Mis predios» (portada del productor), 2026-11-01

Motivo: JP se pierde en la portada, no ve dónde están los predios ni dónde hace cada cosa. Medido con capturas reales (1366 y 390 px, usuario productor) en `audit/results/audit-home/`.

## Hallazgos

| # | Hallazgo | Evidencia | Gravedad |
|---|---|---|---|
| 1 | **Los predios van al final.** La pantalla se llama «Mis predios», pero lo primero son 4 KPIs, 2 gráficas y la barra de estado. La lista de predios empieza hacia los 800 px de 1622 px (escritorio) y a más de la mitad de 2368 px en móvil. | `d-full.jpg`, `d-bottom.jpg` | Alta |
| 2 | **El mismo hecho se repite 5 veces:** «2 sin comunicación» arriba a la derecha, KPI «Con atención 2», barra de estado, grupo «Atención» y la nota de cada predio. Hay unas 103 cifras visibles en escritorio. | `d-full.jpg` | Alta |
| 3 | **Las áreas con problema se sacan de su predio.** El grupo «Atención» las lista aparte y el predio queda con una caja gris «Todas las áreas de este predio están en Atención», sin decir que están arriba. Se pierde la jerarquía predio › área. | `d-bottom.jpg` | Alta |
| 4 | **Vocabulario mezclado:** «Atención», «Sin comunicación», «Estado», «reportando», «con atención» nombran lo mismo con palabras distintas. | `d-full.jpg` | Media |
| 5 | **No hay guía de uso:** no dice qué es cada bloque ni qué se hace al tocar una fila (solo un chevron). El enlace al predio es el nombre, sin apariencia de enlace. No hay un botón o texto del tipo «Abrir área». | código `PropertiesOverview.tsx` | Media |
| 6 | **Las gráficas son difíciles de leer:** 4 líneas casi iguales, etiquetas truncadas («DEMO - Chile Pr… 20.8 %»), eje sin unidad en el flujo, y litros por hora en la gráfica frente a L/min en el KPI. | `d-full.jpg` | Media |
| 7 | **Promedios que no significan nada:** «Humedad media 17.5 %» mezcla nogal, alfalfa, chile y maíz; «E.T.O. media» igual. Una media entre cultivos distintos no orienta. | `d-full.jpg` | Media |
| 8 | **Ubicación en crudo:** algunos predios muestran coordenadas como texto («28.6850292,-106.0765387»). | `d-bottom.jpg` | Baja |
| 9 | **Móvil muy largo:** 2368 px de desplazamiento para llegar a lo accionable. | `m-full.jpg` | Alta |

Las causas de fondo: la portada intenta ser **resumen y lista a la vez**, y el resumen está arriba por el pedido anterior («resumen con gráficas primero»), pero sin una jerarquía de qué es lo principal.

## Propuesta (pendiente de elegir)

**Opción A, recomendada: predios primero, resumen compacto.**
1. Arriba, una línea de estado: «4 de 6 áreas al día · 2 sin comunicación» (un solo lugar para esto).
2. Debajo, **una tarjeta por predio** (nombre, ubicación en texto o «sin ubicación», nº de áreas, semáforo propio «4 al día», último dato). Dentro de cada tarjeta, sus áreas con humedad, flujo y estado; las que tienen problema se marcan **en su lugar**, no aparte.
3. Una sola acción visible por fila: «Abrir» el área, con texto, no solo chevron.
4. Las gráficas pasan a una sección «Resumen de las últimas 24 h» **al final y plegable**; una línea por predio en vez de una por área; sin promedios entre cultivos.

**Opción B: dos pestañas** en la portada, «Predios» (lista, por defecto) y «Resumen» (KPIs y gráficas).

Se mantiene: `null` nunca como 0, «Atención» solo para datos, sin consejos de riego, mismo origen de datos.

## Aplicado: opción A (2026-11-01)

- **Orden nuevo de `/cliente`:** título y una sola línea de estado («4 de 6 áreas al día · 2 sin comunicación»), una guía de una frase, **una sección por predio** (nombre, ubicación, nº de áreas, su propio semáforo y «Ver predio») con **todas sus áreas dentro**, y al final el **Resumen de las últimas 24 h plegado**.
- **Problemas marcados en su lugar:** una barra roja a la izquierda de la fila y la insignia «Sin comunicación»; ya no existe el grupo «Atención» aparte ni la caja «Todas las áreas… en Atención».
- **Acción visible:** cada fila termina en «Abrir ›» (en móvil, toda la tarjeta es el enlace).
- **Se retiraron** las 4 cifras (humedad media, E.T.O. media, flujo ahora, con atención) y la barra de estado. De ahí solo se conserva «Flujo ahora» y las áreas con riego encendido, dentro del resumen plegado.
- **Gráficas:** una línea de humedad **por predio** (promedio por hora de sus áreas al día; una hora sin lecturas no genera punto, nunca se rellena con 0) y litros por hora.
- **Ubicación:** unas coordenadas en crudo se muestran como «Ubicado por coordenadas».
- **Medido:** alto del contenido de 1622 a 1026 px en escritorio y de 2368 a 1405 px en móvil; cifras visibles de 103 a 62. Sin errores de JavaScript.
- **Pruebas:** typecheck, 162 unitarias (2 nuevas: promedio por hora sin inventar horas y etiqueta de ubicación) y build.

## Segunda ronda (2026-11-01): menos texto y algo visual

JP precisó que el «abrumador» era esta pantalla. Cambios sobre la opción A:
- **Una línea por área:** nombre y cultivo, humedad (cifra), estado y «Abrir». Se quitaron flujo, E.T.O., la fila de títulos repetida por predio, «Ubicado por coordenadas» y la frase de instrucciones. De ~36 datos a ~18.
- **Último dato solo si no está al día** («hace 2 días»), con la cifra atenuada y sin mini gráfica: un dato viejo no se presenta como actual.
- **Cabecera de predio:** «4 áreas · todas al día» (en rojo si alguna no lo está).
- **Elementos visuales:** una **barra de estado** bajo el título (una franja por área: verde al día, rojo sin comunicación, gris sin datos o sin nodo) y una **mini gráfica de humedad de 24 h** en cada área al día (decorativa; el dato es la cifra).
- Ancho máximo 1100 px y más aire entre predios.
- Pruebas: typecheck, 159 unitarias y build; sin errores de JavaScript.

## Tercera ronda (2026-11-01): el plano de los predios

JP: la portada todavía no convencía. Se rediseñó con las guías de diseño (`frontend-design`, `dataviz`) alrededor de **una sola figura característica: el plano**.
- **Cada área es una parcela dibujada:** su ancho es proporcional a las hectáreas dentro del predio, y el ancho del plano de cada predio es proporcional a sus hectáreas respecto del mayor (mínimo legible). Una parcela de 12.5 ha se ve más grande que una de 5.5 ha.
- **La humedad es el nivel de agua** que sube desde abajo de la parcela (0–100 %), con una sola tinta (`--accent-soft`) y una línea en el borde del nivel. **No juzga** si es poco o mucho: no hay umbrales (Fase 2).
- **Un área sin datos recientes** no dibuja nivel ni cifra: trama rayada, ícono, «Sin comunicación» y «Último dato hace 2 días». El rojo se reserva para ese estado, con ícono y texto (nunca solo color).
- Cada parcela es un enlace a su área (`aria-label` con humedad y estado). La lista de filas, las columnas, la barra de estado y las mini gráficas se retiraron: el plano las reemplaza.
- Se conserva el resumen de 24 h plegado y «Ver predio».
- Pruebas: typecheck, 159 unitarias y build; sin errores de JavaScript.

## Cuarta ronda (2026-11-01): entrar a áreas y predios, y dos pantallas con papeles distintos

Problemas reportados por JP: no se veía cómo entrar a un área o predio, y la página del predio parecía lo mismo dos veces.
- **Causa 1:** las parcelas eran enlaces pero no lo parecían. Ahora llevan «Abrir ›» visible, y «Ver predio» pasó a «Detalle del predio».
- **Causa 2:** `/cliente/predio/:id` seguía siendo la pantalla antigua: las áreas **no eran enlaces**, los nodos y las áreas se mostraban en dos secciones (cada área aparecía dos veces) y la página se desbordaba por el lado derecho. Se rehízo.
- **Papeles distintos:** **Mis predios** es el plano de todos los predios, para ver de un vistazo; **Detalle del predio** es un solo predio con **una fila por área** y todas sus mediciones (humedad, flujo, E.T.O., estado, último dato). Toda la fila abre el área. En móvil la fila pasa a tarjeta.
- **Equipo:** «Equipo pendiente» ya no aparece cuando contradice un «al día»; la insignia del equipo solo se muestra si hay un problema (retrasado, sin comunicación o desconectado), en el detalle del predio y en Área › Detalles.
- **Parcelas:** el nivel de agua vive en una zona de altura fija bajo el nombre, así que el mismo porcentaje se ve igual de alto en todas las parcelas y el nombre nunca queda cruzado por la línea.
- **Comprobado con un clic real** en escritorio y móvil: parcela → `/cliente/area/1`; «Detalle del predio» → `/cliente/predio/1`; fila → `/cliente/area/2`. Sin errores de JavaScript ni desborde. typecheck, 159 unitarias y build.

## Quinta ronda (2026-11-01): volver desde el área y predio más visual

- **Volver:** en las migas de Área, el nombre del predio ahora es un enlace a `/cliente/predio/:id` (antes era texto). Comprobado con un clic real, escritorio y móvil.
- **Detalle del predio, menos aburrido:** de una tabla a **una tarjeta por área** (2 columnas en escritorio): humedad grande con su nivel y una mini gráfica de 24 h, flujo, E.T.O., estado y «Abrir ›» (toda la tarjeta es el enlace). Arriba, una franja con tres hechos del predio (áreas al día, flujo ahora —suma de las áreas al día—, riego encendido). Abajo, la gráfica de humedad de 24 h por área. No hay promedios entre cultivos.
- Las áreas sin comunicación conservan la barra roja, el estado y «hace 2 días», sin gráfica ni nivel.
- typecheck, 159 unitarias y build; sin errores de JavaScript ni desborde.

## Sexta ronda (2026-11-01): qué línea es cada área

Problema: en la gráfica de humedad de 24 h todas las líneas eran del mismo azul/gris y no se sabía cuál era cada área.
- **Un color por área**, con la paleta categórica validada de la guía `dataviz` (azul, naranja, aguamarina, amarillo, magenta, verde, violeta, rojo; versión clara y oscura). Validada con `validate_palette.js` para 4 series en claro y en oscuro: pasa la separación para daltonismo y la de visión normal. El contraste de aguamarina y amarillo sobre fondo claro queda bajo 3:1, por eso es obligatorio lo siguiente.
- **Leyenda siempre visible** sobre la gráfica, con la muestra de color, el **nombre completo** del área y su última cifra (antes las etiquetas iban al final de la línea y se cortaban).
- **Guía al pasar el puntero:** una línea vertical y un cuadro con la hora y el valor de cada área, con su color. Etiqueta accesible con todas las cifras finales.
- El color sigue al área (su posición en la lista del predio), no a cuántas se muestren.
- Aplica también a la gráfica plegada de «Mis predios» (una línea por predio).
- typecheck, 159 unitarias y build; sin errores de JavaScript ni desborde, en claro, oscuro y móvil.

## Séptima ronda (2026-11-01): proporción de las gráficas y qué es cada mini gráfica

- **Letras de la gráfica demasiado grandes:** el SVG se escalaba al ancho de la pantalla (viewBox de 640), así que los rótulos de 11 px se veían de ~17 px. Ahora el SVG se dibuja en **píxeles reales** del contenedor (`useChartWidth`, con `ResizeObserver`) y los rótulos conservan 11 px en cualquier pantalla. Si el contenedor es más angosto que el mínimo (520 px la de humedad, 380 px la de litros) se desplaza. Aplica a las dos gráficas.
- **Mini gráfica de las tarjetas del predio sin explicación:** se quitó la barra sin rótulo y la mini gráfica lleva un rótulo pequeño de 10 px: «humedad, últimas 24 h» (la primera versión, más grande, se descartó).
- typecheck, 159 unitarias y build; sin errores de JavaScript ni desborde.

## Octava ronda (2026-11-01): menos gráficas en el detalle del predio

JP descartó la mini gráfica de cada tarjeta (con cualquier rótulo) y la gráfica grande «Humedad de las últimas 24 h por área». **El detalle del predio ya no tiene gráficas:** franja de tres hechos, y una tarjeta por área con humedad, flujo, E.T.O., estado y «Abrir ›». La historia por área sigue en Área › Historial y la gráfica de 24 h del área en Área › Ahora. `HumidityChart` se conserva para el resumen plegado de «Mis predios».

## Novena ronda (2026-11-01): la ruta de navegación (migas)

JP: la ruta «Mis predios › Predio › Área» es por donde se navega y debía verse mejor.
- Componente nuevo `components/Breadcrumbs.tsx`, usado en Área y en Detalle del predio. Es una **barra con borde** (misma superficie que las tarjetas) con un **botón por tramo** de al menos 40 px de alto: ícono + nombre, con fondo suave al pasar el puntero o enfocar; flechas `›` entre tramos.
- **El lugar actual va resaltado** (fondo `--accent-soft`, texto en negrita, ícono en el color de acento) y no es enlace (`aria-current="page"`).
- **Íconos que repiten los de la app:** Mis predios (almacén), predio (pin) y área (brote).
- **Móvil:** una sola fila; el primer tramo muestra solo su ícono (con el nombre disponible para lectores de pantalla) y los nombres largos se truncan; el nombre completo sigue en el título de la página.
- Comprobado con clics reales: área → predio → portada, en escritorio, oscuro y móvil. typecheck, 159 unitarias y build; sin errores de JavaScript ni desborde.

## Ronda 10 · el nivel de agua ya no parece un fallo (2026-11-01)

JP: el nivel de agua dentro de cada parcela gusta, pero al estar estático parecía un error. **Cambios:** el agua **sube desde 0 hasta su nivel al cargar** (1,1 s) para que se lea como un medidor; la superficie **ondula despacio** (9 s, `.tile-wave` en `theme.css`; con «reducir movimiento» se queda quieta); se sustituye la línea dura que cruzaba la cifra por una onda del mismo tono; el valor queda por encima del agua (`z-10`) y dice «% de humedad del suelo»; y se añaden **marcas de escala al 25, 50 y 75 %** en el borde. El nivel sigue sin juzgar si es poco o mucho (no hay umbrales en esta pantalla).
