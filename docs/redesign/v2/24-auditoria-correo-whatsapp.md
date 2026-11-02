# Auditoría de diseño · Productor › Correo y WhatsApp (antes «Notificaciones», aplicada)

Fase 2 autorizada (ver `README.md`). Solo presentación: el modelo de datos (preferencia por área, situación, gravedad y canal), la carga y el guardado no cambian. Hecha leyendo el código; la verificación visual queda para la pasada final.

## Hallazgos
1. **12 interruptores por área** presentados como una cuadrícula de botones («--» y una marca) con cabeceras en mayúsculas y abreviaturas («Canal», «Info», «Warning», «Critical»); con cinco áreas, 60 controles a la vista.
2. **Cuatro botones por situación** («Todo ON», «Todo OFF», «Email ON», «WhatsApp ON»), en inglés mezclado y de 11 px, que no se distinguen entre sí.
3. **Situaciones con nombre interno** («Umbral», «Inactividad») que no dicen qué pasó; «N de 6 activas» sin decir de qué.
4. **Interruptor global como casilla** («Activado / Desactivado»), sin explicar que las alertas se siguen viendo en la plataforma.
5. **Tarjetas dentro de tarjetas** (predio › área › situación) y «Guardar cambios» siempre visible arriba, lejos de donde se cambia; «Recargar» descartaba los cambios sin avisar.
6. **Mensajes sin acción** («No hay cambios pendientes por guardar», «Preferencias guardadas correctamente»).

## Cambios
- **Interruptor global** como interruptor real (`role="switch"`) con una frase de qué pasa en cada estado y la aclaración de que las alertas se ven siempre en la plataforma. Apagado, la lista se atenúa.
- **Por predio y área en filas:** cada área muestra un resumen («Correo 6/6 · WhatsApp 4/6») y un «Elegir avisos» plegado.
- **Dentro, una tabla legible:** filas por **situación** («Una medición sale de su umbral», «Un nodo deja de enviar datos») y **canal** (Correo, WhatsApp), columnas por **gravedad** (Crítica, Aviso, Información) con casillas de 44 px y nombre accesible completo. Solo dos acciones masivas: «Activar todos» y «Desactivar todos».
- **Barra de cambios** fija abajo solo cuando hay cambios: «Tienes cambios sin guardar» con **Descartar** y **Guardar cambios**. Se quita «Recargar».
- Mensajes de éxito y error en español, vacío sin áreas útil y carga con `role="status"`.
- Los valores internos (`threshold`, `inactivity`, `info`…) no cambian ni se envían distinto.

**Aclaración de la gravedad (2026-11-01, a petición de JP):** la columna «Información» no se entendía. Ahora cada columna lleva el mismo icono y color que la alerta correspondiente (Crítica, Aviso, Información) y, sobre la tabla, una línea explica qué significa cada gravedad: «La gravedad la define cada umbral. Crítica: algo urgente. Aviso: conviene revisarlo. Información: solo para que lo sepas».

**Pasada final (2026-11-01):** en móvil la tabla de avisos dejaba la columna «Información» fuera de la pantalla y el nombre de la situación partido en cuatro líneas. Ahora cada situación es un título sobre sus filas Correo y WhatsApp, y la tabla tiene solo cuatro columnas (Por + las tres gravedades), que caben a 390 px sin desplazarse.
