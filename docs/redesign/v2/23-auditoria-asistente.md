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
