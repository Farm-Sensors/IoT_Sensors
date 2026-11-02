# Auditoría de Área › Ahora (`/cliente/area/:id`), 2026-11-01

Motivo: JP ve «mucho texto luego luego» y se siente abrumado. Medido con capturas reales (1366 y 390 px, productor, DEMO - Nogal Norte) en `audit/results/audit-area/`.

**Medidas:** 1480 px de alto en escritorio y 2294 px en móvil; 158 palabras; 35 cifras; 11 encabezados; 20 cajas con borde en escritorio.

## Hallazgos

| # | Hallazgo | Evidencia | Gravedad |
|---|---|---|---|
| 1 | **Cinco filas antes de ver un dato:** migas de 3 niveles, nombre, cultivo y hectáreas, pestañas y la línea de estado. Los datos empiezan hacia los 270 px de 900 px (escritorio) y a unos 380 px en móvil. | `d-top.jpg`, `m-full.jpg` | Alta |
| 2 | **Tres tarjetas oscuras de 340 px** ocupan toda la primera pantalla y pesan más que cualquier otra cosa. La de E.T.O. tiene un número y mucho vacío; la de humedad trae un medidor circular casi invisible (oscuro sobre oscuro). | `d-top.jpg` | Alta |
| 3 | **«Datos actuales» junto a «Equipo pendiente»** se contradicen: los datos llegan, y a la vez dice que el equipo está pendiente, sin explicar qué significa. Es un estado interno de administración (decisión 4, ya aplicada en Mis predios, no aquí). | `d-top.jpg` | Alta |
| 4 | **El mismo hecho dicho dos veces:** «Último dato: … hace un momento» arriba y «Antigüedad de la lectura: Ahora» en la tarjeta Estado del Riego; «Estado: Activo» repite lo que ya dice que fluyen 9.9 L/min. | `d-top.jpg` | Media |
| 5 | **La gráfica «Últimas 12 lecturas» abarca 11 minutos:** no muestra una tendencia útil (para eso está Historial). Su eje cambia de 9–26 en escritorio a 0–100 en móvil. | `d-mid.jpg`, `m-full.jpg` | Media |
| 6 | **Datos escondidos en móvil:** «Métricas de Suelo» es una tira con desplazamiento horizontal y el tercer valor (potencial hídrico) queda fuera de la pantalla sin aviso. | `m-full.jpg` | Alta |
| 7 | **Tres estilos para medir lo mismo:** Suelo en fila horizontal, Ambiental en lista con iconos, Estado en tarjeta gris. Cada bloque tiene fondo y forma distintos. | `d-mid.jpg` | Media |
| 8 | **«Fuentes externas» ocupa ~200 px para decir que no hay nada:** dos tarjetas vacías («Sin clima de referencia…», «Sin NDVI todavía…») y una frase de descargo. | `d-mid.jpg` | Media |
| 9 | **Textos que no ayudan:** «Dato prioritario» repetido en dos tarjetas, «Evapotranspiración» como subtítulo, mayúsculas de título («Humedad del Suelo», «Flujo de Agua») frente al resto en minúscula, y términos técnicos sin explicar («Antigüedad de la lectura», «Potencial hídrico»). | `d-top.jpg` | Baja |
| 10 | **Nadie dice en palabras si todo está bien.** Hay que deducirlo de un punto verde, un «Activo» y una hora. | `d-top.jpg` | Media |

Causa de fondo: la pantalla enseña **todo lo que el sensor mide, con el mismo peso**, en vez de responder primero «¿está bien mi área?» y dejar el detalle a un clic.

## Propuesta (pendiente de aprobar)

1. **Encabezado más corto:** migas y nombre en una fila, cultivo y hectáreas como texto pequeño al lado; pestañas debajo.
2. **Una frase de veredicto**, que reemplaza la línea de estado y la tarjeta Estado del Riego: «Al día · último dato hace un momento · riego encendido». Si no hay datos: «Sin comunicación desde hace 2 días».
3. **Los tres datos prioritarios en una franja compacta** (un solo contenedor, tres columnas, ~120 px): humedad, flujo (con su mini gráfica y el acumulado) y E.T.O., con número grande y unidad. Sin medidor circular ni subtítulos.
4. **Una sola gráfica:** humedad de las últimas 24 h (mismos datos que ya usa Mis predios), con una escala consistente en escritorio y móvil, en lugar de las «12 lecturas».
5. **«Otras mediciones»:** suelo y ambiente en una sola lista de dos columnas con el mismo formato y las **8 cifras siempre visibles**, sin desplazamiento horizontal.
6. **Fuentes externas:** se muestran solo si tienen dato; si no, una línea al final («Clima de referencia y NDVI: sin datos todavía»).
7. **«Equipo pendiente» sale de Ahora** y vive en Detalles, como en Mis predios.

**Meta medible:** de 1480 a unos 800 px en escritorio y de 2294 a unos 1300 px en móvil, y de 158 a unas 90 palabras. Se mantienen: `null` nunca como 0, la frescura (20 min), el polling de 30 s y el mismo origen de datos.

## Aplicado (2026-11-01)

- **Un solo componente para escritorio y móvil** (`dashboard/AreaNowView.tsx`); se borraron `DesktopDashboard.tsx` y `MobileDashboard.tsx`. Se respetan las preferencias de tarjetas del admin (`visibleCards`) y el semáforo solo con el módulo de alertas encendido.
- **Franja de datos prioritarios** (un contenedor, 3 columnas; en móvil, 3 filas) en lugar de tres tarjetas oscuras de 340 px: sin medidor circular ni subtítulos; flujo con mini gráfica y acumulado; E.T.O. con «Evapotranspiración» como `title` de la abreviatura.
- **Veredicto en una línea** bajo las pestañas: frescura («Datos actuales · último dato…») más la insignia del riego (ACTIVO / INACTIVO / SIN DATOS / SIN COMUNICACION). Se eliminó la tarjeta «Estado del Riego» y «Antigüedad de la lectura».
- **Una gráfica de humedad de 24 h** (antes, 12 lecturas ≈ 11 min), con eje en % y la misma escala en escritorio y móvil.
- **«Otras mediciones»**: suelo y ambiental en un solo bloque, las 7 cifras siempre visibles (sin tira con desplazamiento horizontal).
- **Fuentes externas**: lo que no tiene dato pasa de tarjeta vacía a una línea; con dato, sigue la tarjeta.
- **«Equipo pendiente» salió de Ahora** y vive en Detalles («Equipo del predio»).
- **Encabezado del área**: nombre, cultivo y tamaño en la misma línea.
- **Medido:** de 1480 a 1192 px en escritorio y de 2294 a 1678 px en móvil; cajas con borde de 20 a 6. **No se llegó a la meta de ~800 px**: la gráfica de 24 h es alta a propósito; si se quiere más corto, se puede reducir o plegar. El conteo de palabras apenas baja (158 → 148) porque lo dominan los rótulos de ejes y cifras.
- **Pruebas:** typecheck, 159 unitarias (se reescribieron las de `DesktopDashboard`/`MobileDashboard` para el componente nuevo y se agregó una del badge de riego) y build.
