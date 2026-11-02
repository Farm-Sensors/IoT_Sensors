# Auditoría de diseño · Admin › Alertas (Todas las alertas y detalle)

Fase 2 autorizada (ver `README.md`). Navegación ya resuelta en `20-navegacion-fase-2.md`; aquí solo la **presentación** de la lista y del detalle. El productor reutiliza las mismas pantallas («Mis alertas»), así que lo que se decida aquí se aplica a los dos. Sin cambios de lógica, API ni flags.

**Cómo se auditó:** la base no tiene alertas, así que se simularon respuestas de `/alerts` en el navegador (6 alertas: 2 críticas, 2 de aviso, 1 informativa; umbral e inactividad; leídas y sin leer) sin escribir en la base. Script: `audit/107-alertas-admin.mjs`; capturas en `audit/results/alertas-admin/` (1366 y 390 px).

## Hallazgos

### Lista
1. **Casi 300 px de filtros antes de la primera alerta** (en móvil, ~500 px): un panel «Contexto activo» con dos chips y dos listas, y debajo tres listas más y un rango de fechas con su propia línea «Rango … · Todos los ciclos». La alerta más reciente queda bajo el primer pliegue.
2. **Dos maneras de elegir el área** (el panel de contexto y la lista de filtros), y el panel dice «Predio: Sin seleccionar», que describe un estado vacío en lugar de ofrecer un filtro. El admin necesita Cliente → Predio → Área, no un contexto global.
3. **Solo ids:** «Nodo 11 · Area 2». Quien administra no sabe de qué predio ni de qué cliente es.
4. **Gravedad en inglés y en mayúsculas** («CRITICAL», «WARNING», «INFO») y solo distinguida por color de la etiqueta. Vocabulario: debe ser «Crítica», «Aviso», «Información», con icono y texto.
5. **Parámetro en bruto:** `soil.humidity`, `irrigation.flow_per_minute`. Es el nombre interno; nunca se muestra en pantalla. Falta el nombre en español, el valor con su unidad y, si hay, el umbral.
6. **El fondo naranja marca «no leída», no la gravedad:** 4 de 6 filas naranjas, incluida una informativa. La página entera parece una advertencia y la gravedad crítica no destaca sobre la de aviso.
7. **Dos botones por fila** («Leída», «Ver recomendación»), repetidos en cada una. «Ver recomendación» no aplica a una alerta de inactividad (no hay nada que recomendar sobre un valor). La fila entera debería ser el enlace al detalle.
8. **Ortografía:** «leidas», «pagina», «Pagina», «Leida», «Area», «No leidas» sin tilde. Controles de página solo con flechas.
9. **Vacío genérico:** «No hay alertas para los filtros seleccionados» aun sin filtros. No explica cuándo aparecen alertas ni lleva a los umbrales.
10. **Sin jerarquía temporal ni de urgencia:** una lista plana; lo no leído y crítico no sube.

### Detalle
11. **Título engañoso:** «Recomendación de alerta», cuando la pantalla es el detalle de la alerta; el subtítulo dice «generada por IA» aunque la fuente sea «Reglas» (la tarjeta lo contradice).
12. **Datos sin unidad ni nombre:** «Nodo 11», «Parámetro soil.humidity», «Valor detectado 6.1» (¿%, °C?).
13. **Avisos enviados** («Correo enviado», «WhatsApp enviado») sueltos en una línea que se parte; no se entiende que son canales de notificación.
14. **La recomendación ocupa media pantalla** pese a ser secundaria (y, sin IA, una frase fija de reglas). El hecho (qué pasó, dónde, cuándo, qué valor) debería mandar.
15. **Acciones dispersas:** «Marcar como leída» abajo a la izquierda, «Actualizar» arriba, «Regenerar» en otra tarjeta; falta ir al umbral que la causó.

### Transversal
16. **Botón «Actualizar»** y refresco automático conviven sin indicar cuándo se actualizó por última vez.
17. **Móvil:** filtros apilados en listas nativas (4 pantallas de scroll); la campana flotante tapa contenido en la esquina.

## Propuesta

### Lista
- **Encabezado:** «Todas las alertas», contador «4 sin leer» y «Actualizar» (con «Actualizado hace un momento»).
- **Barra de filtros de una fila** (en móvil, plegable con «Filtros (n)»): selector **Cliente › Predio › Área** en cascada (reemplaza el panel de contexto), **Gravedad**, **Tipo** (Umbral, Sin datos), y segmentos **Sin leer | Todas**. El rango de fechas queda como «Últimos 7 días ▾» con un selector.
- **Fila = un enlace al detalle:** barra lateral e icono de gravedad (Crítica, Aviso, Información; texto además del color), mensaje en negrita si no está leída con un punto de «sin leer», `Predio · Área` (con cliente para el admin), el valor con nombre y unidad («Humedad del suelo 6,1 %») y «hace 37 min». «Marcar como leída» como botón discreto de la fila.
- **Fondo uniforme** para todas las filas: la gravedad se ve en la barra y el icono, y «sin leer» en el punto y la negrita. Las críticas sin leer suben arriba bajo un título «Requieren atención».
- **Vacío útil:** «Aún no hay alertas. Aparecen cuando una medición sale de sus umbrales o un nodo deja de enviar datos» con enlace a **Umbrales**; con filtros: «Ninguna alerta coincide con el filtro» y «Limpiar filtros».
- **Paginación** con «Anterior / Siguiente» y «Página 1 de 1», con tildes.

### Detalle
- **Título = el mensaje de la alerta** («Humedad del suelo crítica»), con gravedad, tipo y estado.
- **Hechos** en una lista: Dónde (Cliente › Predio › Área, con enlace al área), Qué (Humedad del suelo), Valor (6,1 %), Cuándo (fecha y «hace 37 min»), Nodo (nombre).
- **Avisos enviados:** «Avisamos por correo y WhatsApp» (o «No se envió aviso»).
- **Acciones juntas:** «Marcar como leída», «Ver el área» y «Ver el umbral».
- **Recomendación** como tarjeta secundaria debajo o al lado, con título honesto por su fuente («Sugerencia automática» o «Basada en reglas») y «Regenerar» dentro de ella.

### Se mantiene
Rutas, API, permisos, flags, el refresco automático, los filtros disponibles y el marcado como leída. «Atención» sigue sin significar necesidad de riego.

## Pendientes de decisión para JP
1. **Nombres de cliente y predio:** la API trae solo ids; los nombres salen de las listas de predios y áreas que la app ya carga (para el cliente se haría una consulta a `/clients`). ¿Se acepta esa consulta extra?
2. **Subir las críticas sin leer** arriba como grupo «Requieren atención» frente a una lista cronológica simple.
3. **Cantidad de filtros:** mantener Cliente › Predio › Área, Gravedad, Tipo, Estado y Fechas, o reducir a lo esencial (Área, Gravedad, Sin leer).
