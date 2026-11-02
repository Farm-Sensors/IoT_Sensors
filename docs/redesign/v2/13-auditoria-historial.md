# Auditoría de Área › Historial (`/cliente/area/:id/historial`), 2026-11-01

Capturas reales (1366 y 390 px, productor, DEMO - Nogal Norte, 1433 registros) en `audit/results/audit-historial/`. Se revisó con las guías `frontend-design` y `dataviz`.

**Medidas:** 3375 px de alto en escritorio y 4085 px en móvil; 612 palabras; 20 botones; 1 tabla de 9 columnas × 20 filas (72 páginas).

## Hallazgos

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **Filtros que ocupan una pantalla completa antes de ver un dato:** 6 botones de rango, 2 fechas, selector de ciclo, una caja «Filtros activos», una nota de UTC y una línea de disponibilidad. | Alta |
| 2 | **La misma información tres veces:** el botón «Últimos 7 días» marcado, los campos de fecha con 26/10 – 01/11 y la caja «Filtros activos» que repite rango, fechas y ciclo. | Alta |
| 3 | **Dos notas de zona horaria que se contradicen:** «Fechas de consulta en UTC» y «Las horas… en tu zona horaria local». | Media |
| 4 | **Las líneas de la gráfica no se distinguen:** azul marino, gris, gris punteado y negro; hay que adivinar cuál es cuál por la leyenda. Es el mismo problema que ya se corrigió en el detalle del predio. | Alta |
| 5 | **Ejes dobles** (% a la izquierda y °C a la derecha; L/min y mm/día): obliga a leer dos escalas y es lo primero que la guía de visualización prohíbe. | Alta |
| 6 | **Eje roto en la gráfica de riego:** el rótulo superior dice «33333333 L/min» y el derecho «7.653 mm/día», con decimales sin formato. | Alta |
| 7 | **Espagueti:** 7 días × 144 lecturas por serie, 4 series superpuestas en el mismo plano; no se lee ninguna tendencia. | Alta |
| 8 | **Controles de serie pesados:** botones grandes con borde negro, círculo y palomita, que ocupan una fila entera por gráfica. | Media |
| 9 | **Exportar, la acción principal, está hasta abajo,** en el encabezado de la tabla, después de 2000 px. | Alta |
| 10 | **La tabla de 1433 registros es lo último y lo más largo:** 9 columnas, fechas partidas en dos líneas, 72 páginas. Nadie lee 72 páginas. | Media |
| 11 | **Móvil de 4085 px**, con la misma estructura apilada. | Alta |

Causa de fondo: la pantalla enseña **todos los controles, todas las series y todos los registros**, sin contestar primero lo que el productor suele querer: «¿cómo estuvo mi humedad esta semana?» y «descárgame los datos».

## Propuesta (pendiente de aprobar)

1. **Filtros en una sola fila:** rango como control segmentado (Hoy, 7 días, 30 días, Este mes, Este año, Personalizado); las dos fechas aparecen solo con «Personalizado»; ciclo de cultivo como selector compacto. Se elimina la caja «Filtros activos» y las notas; queda **una línea de resumen**: «26/10 – 01/11/2026 · todos los ciclos · 1433 lecturas». La zona horaria va como una sola nota breve.
2. **Descargar arriba, junto al resumen:** CSV, Excel y PDF como botones pequeños a la derecha.
3. **Un gráfico a la vez, con un solo eje:** selector de variable (Humedad del suelo, Flujo de agua, E.T.O. primero por ser los datos prioritarios; luego temperatura del suelo, temperatura del aire, humedad relativa…). Línea grande y legible con un solo color, guía vertical con hora y valor al pasar el puntero, y **promedio por hora** cuando el rango es largo para quitar el espagueti (la tabla conserva los registros exactos). Se corrigen los formatos del eje.
4. **Comparar es opcional:** un botón «Comparar con…» puede añadir una segunda variable **en otro gráfico apilado** (nunca con doble eje), con colores de la paleta validada.
5. **Registros plegados:** la tabla pasa a una sección «Ver registros (1433)» cerrada por defecto, con la fecha en una línea y solo las columnas de los tres datos prioritarios visibles (las demás, en un detalle).
6. **Móvil:** mismo orden; filtros en una fila que se desplaza, gráfico al ancho completo, registros plegados.

**Meta medible:** de 3375 a unos 1100 px en escritorio y de 4085 a unos 1400 px en móvil; de 612 a unas 200 palabras. Se mantienen: `null` nunca como 0, mismos endpoints (`/readings` y `/readings/export`), exportación con los mismos filtros, ciclo de cultivo y rango libre de fechas.

## Aplicado (2026-11-01)

- **Filtros en una fila:** rango como control segmentado (Hoy, Últimos 7 días, Últimos 30 días, Este mes, Este año, Personalizado) y selector de ciclo a la derecha. **Las dos fechas solo aparecen con «Personalizado».** Se eliminaron la caja «Filtros activos», la línea «Disponible desde…» y las dos notas de zona horaria; en su lugar hay **una línea de resumen** («Últimos 7 días 26/10/2026 – 01/11/2026 · Todos los ciclos» con un ícono de información que explica UTC y hora local). La disponibilidad sigue marcada con puntos en el calendario.
- **Descargas arriba,** en la misma línea del resumen: CSV, Excel y PDF (mismos endpoints y filtros).
- **Un gráfico a la vez, con un solo eje:** selector de variable (Humedad del suelo, Flujo de agua, E.T.O., Temp. suelo, Temp. aire, H. relativa; los tres prioritarios primero). Cada variable conserva su color de la paleta validada. Título con unidad y color, guía con hora y valor al pasar el puntero, ejes con formato (se acabó «33333333 L/min»). **«Comparar con»** añade un segundo gráfico apilado, nunca un doble eje. Nota: «Cada punto es el promedio de 30 min».
- **Registros plegados** en «Ver registros (N)», con las 12 columnas intactas, fecha en una sola línea y la paginación dentro.
- **Medido:** de 3375 a 968 px en escritorio y de 4085 a 1424 px en móvil; de 612 a 153 palabras. Se cumple la meta.
- **Pruebas:** typecheck, 159 unitarias (se actualizaron las de filtros, rango personalizado y selector de variable) y build; sin errores de JavaScript.

### Ajuste posterior: se quitó «Comparar con»

JP no entendió «Comparar con», y su botón de la variable ya elegida no hacía nada. Se eliminó: el historial muestra **una variable a la vez**, que se cambia desde el selector de la gráfica.

### Ajuste posterior: la página ya no salta al paginar

Al cambiar de página en «Ver registros», la tabla se vaciaba mientras cargaba, la página se encogía y el navegador subía el desplazamiento. Ahora **se conservan las filas anteriores, atenuadas (`aria-busy`), hasta que llegan las nuevas**, y el aviso de carga es solo para lectores de pantalla. Comprobado en el navegador: el desplazamiento (978 px) y la posición del botón «Siguiente» no cambian entre la página 1, 2 y 3.

### Ajuste posterior: ventana «Descarga lista»

Al terminar una descarga (CSV, Excel o PDF) aparece una **ventana centrada sobre la pantalla** con una **palomita animada** (el círculo se dibuja y después la marca, con un pequeño rebote), el título «Descarga lista» y solo el nombre del archivo (no se afirma dónde se guardó: eso depende del navegador).
- Se cierra con **«Listo»**, con **Escape** o sola a los **4 s**. El foco queda dentro de la ventana mientras está abierta (Radix Dialog).
- Con **movimiento reducido** la palomita aparece ya dibujada (la regla global de `theme.css` anula las animaciones).
- Si la descarga falla no aparece: se mantiene el mensaje de error de siempre.
- Componente: `components/DownloadReadyDialog.tsx`; estilos de la palomita al final de `styles/theme.css`.
- Comprobado en el navegador (escritorio claro, oscuro y móvil) con una descarga real: se descarga `export_DEMO - Nogal Norte_2026-11-01.csv`, la ventana aparece y se cierra sola, sin errores de JavaScript. typecheck, 159 unitarias y build.

### Corrección: puntito al inicio de la palomita

Antes de dibujarse, el trazo (de extremos redondos) dejaba un **punto visible** donde empieza la marca. La animación `download-check-draw` ahora empieza con **opacidad 0** y la sube al 5 % del recorrido, así que durante la espera de la marca no se ve nada. Comprobado midiendo los estilos: la marca mantiene opacidad 0 hasta que empieza a dibujarse.
