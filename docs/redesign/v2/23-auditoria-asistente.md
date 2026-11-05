# Auditoría de diseño · Asistente (Preguntar, Reportes automáticos, Consumo)

Fase 2 autorizada (ver `README.md`). Solo presentación; sin cambios de API, flags ni lógica. Esta auditoría se hizo leyendo el código y sin pasada de capturas (JP pidió dejar las pruebas para el final); la verificación visual se hace en la pasada final.

## 1. Preguntar al asistente (aplicada)

### Hallazgos
1. **Alcance con ids a mano:** el admin debía escribir «Cliente ID» y «Área ID» en campos numéricos, además del panel «Contexto activo»; ninguno de los dos se explicaba bien («usa automáticamente el contexto activo seleccionado arriba»).
2. **Columna de 320 px de ajustes** (ventana, ids, aviso técnico, reiniciar) que estrechaba el chat.
3. **Vacío con una sola frase de ejemplo**, no pulsable.
4. **Datos técnicos para todos:** «Fuente: IA · azure-openai · gpt-… · in:812 out:96» bajo cada respuesta.
5. **Errores con códigos:** «Error del asistente IA: HTTP 503.»
6. **Accesibilidad:** el cuadro de texto solo tenía placeholder, la conversación no se anunciaba y Enter no enviaba.
7. «Chat operativo con datos del sistema» no dice qué hace.

### Cambios
- Encabezado que dice **de qué datos responde** («Responde con los datos de Granja Hogar › Área 1 de las últimas 72 horas»).
- **Una fila de alcance** sobre el chat: Predio › Área (como en Alertas y Umbrales; el admin ve «Cliente › Predio»), Periodo y «Nueva conversación». Se acabaron los ids numéricos. Para el admin el cliente sale del predio elegido.
- **Cuatro preguntas sugeridas pulsables** en el vacío (sin datos técnicos ni consejos de riego).
- Respuestas con «Asistente» y la fuente en palabras («Respuesta generada por IA» / «Respuesta basada en reglas»); proveedor, modelo y tokens quedan solo para el admin, en «Detalles técnicos» plegado.
- Errores en español sin códigos (503: «El asistente no está disponible por ahora»; 429: «Hiciste muchas preguntas seguidas…»).
- `role="log"` con `aria-live`, etiqueta en el cuadro de texto, **Enter envía** y Mayús+Enter salta de línea; botón «Enviar» de 44 px.
- Las tarjetas, tablas y gráficas de las respuestas se conservan tal cual.

## 2. Reportes automáticos (lista y detalle, aplicada)

### Hallazgos
1. **Mismos problemas de alcance:** «Cliente ID» numérico para el admin, panel «Contexto activo» y un rango de fechas que parecía aplicado sin estarlo (mostraba «últimos 7 días» sin filtrar).
2. **Filas sin lugar ni periodo legible:** «Reporte #14» con «25/10/2026 20:00 - 26/10/2026 20:00»; no decían de qué cliente o área eran (un reporte puede cubrir todo el cliente).
3. **Estados sin icono** y con un token que no existe (`--status-success`): «Completado» salía sin color. «Fallido», en tono de sistema.
4. **Detalle de metadatos:** «Trazabilidad de generación», «Metadatos» y un bloque `pre` ocupaban media pantalla, mientras el resumen (lo que se viene a leer) quedaba en una tarjeta con «RESUMEN» en mayúsculas espaciadas.
5. «Cliente 3» en lugar del nombre; «N/D».

### Cambios
- **Lista:** filtros en una fila (Cliente para el admin, Área agrupada por predio, estado en segmentos «Todos · Listos · Generándose · Con error»); las fechas pasan a «Fechas», plegadas y sin simular un rango. Cada fila es un enlace con el estado en palabras con icono (Listo, Generándose, Pendiente, No se pudo generar), el periodo («25 oct – 1 nov 2026»), el lugar («Cliente › todas las áreas» o «Predio › Área») y el inicio del resumen. Vacíos útiles, «Anterior / Siguiente» y hora de actualización.
- **Detalle:** el título es «Reporte del 25 oct – 1 nov 2026» con el lugar debajo; **Resumen, Hallazgos y Recomendación** en tarjetas legibles; avisos según el estado (en cola, generándose, con error); los datos de generación (fecha, error, metadatos) pasan a «Datos de generación (soporte)», plegados y solo para el admin.
- Nuevo `pages/shared/reportFormat.ts` y `useAlertPlaces` expone también la lista de clientes.

### Pendiente
- El filtro de estado «Pendiente» no tiene botón propio (la API acepta un solo estado a la vez); aparece en «Todos».

## 3. Consumo del asistente (solo admin, aplicada)

### Hallazgos
1. **Cifras mezcladas con filtros:** «Ventana», «Acción», «Usuario ID» y tres tarjetas de resumen en una misma rejilla de 6 columnas; el resto del resumen (`in=… · out=… · ai=… · fallback=…`) era una línea de texto técnica sobre la tabla.
2. **Valores internos como etiquetas:** «execute», «error», «rate_limited», «Fuente: ai/fallback» y el código HTTP en una columna «Estado».
3. **«Usuario ID» numérico:** hay que saber el id de la persona.
4. **Nulo mostrado como cero:** los tokens ausentes salían como `0/0` (`?? 0`), aunque no se hubieran medido.
5. **Tabla de 8 columnas** que se desplaza de lado a lado.

### Cambios
- **Filtros en una fila:** periodo, **Usuario por nombre** (lista de usuarios) y resultado en palabras («Preguntas respondidas», «Con error», «Límite excedido»).
- **Resumen en cuatro cifras:** Preguntas, Respondidas bien (con cuántas fallaron), Respuestas (IA y basadas en reglas) y Tiempo de respuesta, más una frase con los tokens de entrada y salida del periodo.
- **Registro en filas:** persona y fecha, resultado en palabras (en rojo con texto si falló), fuente, latencia y tokens («—» si no se midieron, nunca 0); proveedor, modelo, código HTTP y error en «Detalles técnicos» plegado.
- Vacíos con y sin filtro, «Anterior / Siguiente» y hora de actualización. La consulta y los parámetros no cambian.
