# Auditoría del administrador › Red (Equipos, Nodos y Mapa), 2026-11-01

Capturas reales (1366 y 390 px, `admin@sensores.com`; lista de equipos, equipo con su avance, nuevo equipo, nodos y mapa global) en `audit/results/audit-admin-red/`. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas (escritorio):** Equipos 26 palabras (2 botones); Nodos 131 palabras, tabla de 7 columnas y 13 botones; Mapa 180 palabras y 14 botones. **Móvil:** Nodos 1235 px y Mapa 2112 px.

## Hallazgos

### Equipos (`/admin/gateways`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **El estado del equipo contradice al resto del sistema.** La tarjeta dice «Asignando nodos · 0 de 4 áreas con datos» y la lista del avance «Esperando nodo · Ahora» en las cuatro áreas, mientras la pantalla Nodos muestra esos mismos nodos con «Última lectura: Ahora» y Hoy los da por al día. El texto «Esperando nodo · Ahora» se contradice a sí mismo. | Alta |
| 2 | **La tarjeta no dice lo que un administrador necesita:** si el equipo está conectado, cuándo habló por última vez y cuántas áreas reportan de verdad. Solo dice una etapa de la configuración. | Alta |
| 3 | **Vocabulario fuera del proyecto:** «rancho» («Rancho y áreas», «Selecciona un rancho…», «DEMO - Rancho Norte · Agricola del Norte»). El proyecto usa **Predio**, y en el resto de la aplicación el orden es cliente › predio, aquí es predio · cliente. | Media |
| 4 | **Un asistente de 3 pasos que sirve también de página del equipo:** al abrir un equipo ya vinculado se ve el asistente («Rancho y áreas: Hecho», «Vincular equipo: Hecho», «Paso 3 de 3») en lugar de una ficha con su estado, con «Revocar enlace» como un enlace rojo pequeño al final. | Media |
| 5 | **«Revocados (15)»** es un texto gris diminuto; 15 enlaces revocados se esconden sin una forma clara de entender qué son. | Baja |
| 6 | La tarjeta y su botón «Ver avance» ocupan un tercio del ancho; el resto de la pantalla está vacío. | Baja |

### Nodos (`/admin/nodos`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 7 | **Otra tabla de 7 columnas** (Nombre, Serie, Área vinculada, GPS, Habilitado, Última lectura, Acciones) con los nombres partidos en dos líneas. | Alta |
| 8 | **No dice quién tiene problemas:** «Hace 2 dias» (sin acento) es texto plano igual que «Ahora»; no hay indicador ni orden por gravedad. | Alta |
| 9 | **Columnas que no informan:** «Serie» es «-» en todos, «Habilitado: Sí» en todos, y el nombre del nodo repite el del área («Nodo DEMO - Nogal Norte» en el área «DEMO - Nogal Norte»). GPS con 7 decimales. | Media |
| 10 | **Es el mismo contenido que la pestaña «Nodo» del Directorio** y que lo que ya dice Hoy: tres lugares para la misma información. | Media |
| 11 | Título «Gestión de Nodos» y subtítulo «Administra los sensores IoT del sistema» (jerga, igual que en el Directorio antes de rehacerlo). | Baja |

### Mapa (`/admin/mapa`)
| # | Hallazgo | Gravedad |
|---|---|---|
| 12 | **Un formulario antes del mapa:** tres selectores (Cliente, Predio, Área), «Modo de visualización» (marcadores o clusters), tres casillas (Frescos, Tardíos, Sin lectura), «Actualizar capa» y cuatro contadores. El mapa empieza a media pantalla. | Alta |
| 13 | **Vocabulario distinto al resto:** «Fresco / Tardío / Sin lectura / Reportando / Sin reporte reciente», frente a «Al día / Sin comunicación / Sin datos» del resto de la aplicación (mismo defecto que tenía el mapa del productor). | Alta |
| 14 | **Los pines son puntos sin nombre ni leyenda** (azul y naranja sin explicación) y desde el mapa **no se puede entrar al área**: el panel «Detalle de nodo» no tiene enlaces. | Alta |
| 15 | **Texto de plomería y formatos distintos:** «Estado (config)», «Hace 0 min», «11/1/2026, 1:02:18 PM» (formato estadounidense), «MapLibre», «Actualizar capa». | Media |
| 16 | **Panel lateral con 9 campos, una lista que repite el nodo y «Nodos sin GPS»**; en móvil el mapa y su panel suman 2112 px. | Media |
| 17 | Título «Mapa Global de Nodos» frente a «Mapa» en la vista del productor. | Baja |

Causa de fondo: **Red** reúne tres pantallas técnicas (equipos, nodos, mapa) que hablan de lo mismo con palabras y formatos distintos a los del resto. El administrador necesita saber **si la red está viva y dónde falla**, no administrar tablas.

## Propuesta (pendiente de aprobar)

**Equipos**
1. **Tarjeta por equipo con su estado real:** «DEMO - Rancho Norte → Predio… » se escribe cliente › predio («Agricola del Norte · DEMO - Rancho Norte»), con el estado en palabras («Conectado · 4 de 4 áreas con datos», «Sin comunicación desde hace 2 días», «Falta vincular», «Falta asignar nodos») calculado con las lecturas reales, la hora de la última comunicación y toda la tarjeta como enlace. Se corrige «Esperando nodo · Ahora».
2. **«Rancho» pasa a «Predio»** en todo el flujo.
3. **Ficha del equipo en lugar del asistente** una vez vinculado (estado, hora, áreas y su estado, «Revocar enlace» como botón de peligro en un lugar visible); el asistente de 3 pasos queda solo para equipos nuevos o incompletos.
4. «Revocados (15)» como sección plegada con un título claro («Enlaces revocados») y el predio y la fecha de cada uno.

**Nodos**
5. **Lista en filas, no en tabla:** agrupada por cliente › predio, **ordenada de lo más grave a lo menos** (sin comunicación primero), con el **área como título** (no el nombre repetido del nodo), el estado («Al día», «Sin comunicación · hace 2 días») y «Deshabilitado» solo si lo está. Serie y GPS pasan al detalle del nodo (`/admin/nodos/:id`, que ya existe) con coordenadas formateadas. Editar y borrar viven en ese detalle.
6. Se quitan el título «Gestión de Nodos» y el subtítulo; «Nuevo Nodo» queda arriba.

**Mapa**
7. **Mismo patrón que el mapa del productor:** al entrar, **un pin por predio** con su nombre y su salud («2 sin comunicación»); al elegir un predio, **un pin por área** con el nombre y su estado; tocarlo abre una tarjeta con **«Abrir área»** (a `/admin/areas/:id`). Chips «Todos los clientes» + uno por cliente y los predios como chips; se eliminan el modo de visualización, las tres casillas, «Actualizar capa» y la nota de MapLibre. Vocabulario y fechas unificados, mapa de al menos el 70 % de la pantalla.

**Meta medible:** Equipos con el estado verdadero (sin contradicciones), Nodos sin tabla y con problemas primero, Mapa de 180 a unas 40 palabras visibles, con todos los nodos alcanzables y cada pin con su camino al área. Se mantienen: `/pair`, `/admin/gateways/pair`, todo el alta de equipos, nodos y su CRUD, los endpoints actuales y `null` nunca como 0.

## Aplicado (2026-11-01)

**Mapa (`/admin/mapa`)** — se rehízo con el mismo patrón del mapa del productor (`AdminMapPage.tsx`):
- Al entrar: **un pin por predio** (nombre y «4 nodos · al día» / «1 nodo · 1 sin comunicación»), con la misma franja de color y el vocabulario Al día / Sin comunicación / Sin datos. Chips **«Todos los clientes»** y uno por cliente.
- Al elegir un predio (pin, chip o lista): **un pin por área** con su estado; tocarlo abre una tarjeta (cliente, predio, cultivo, nodo, estado y «hace X») con **«Abrir área»** (`/admin/areas/:id`) y **«Ver nodo»** (`/admin/nodos/:id`). «Todos los predios» vuelve; «Abrir <predio> en Clientes» lleva al Directorio.
- Se eliminaron el formulario de filtros, el modo de visualización (clusters), las casillas Frescos/Tardíos/Sin lectura, «Actualizar capa» (se refresca solo, con «Actualizado hace…»), «Estado (config)», la nota de MapLibre y el formato de fecha estadounidense. Título «Mapa» (igual que el del productor).
- **Medido:** de 180 a 76 palabras visibles; el mapa ocupa 645 de 900 px (72 %) en escritorio y 506 de 844 px (60 %) en móvil.

**Nodos (`/admin/nodos`)**
- La tabla de 7 columnas pasó a **filas agrupadas por predio, con lo más grave primero** (sin comunicación arriba): el **área** es el título, el nodo va debajo, y a la derecha el estado («Sin comunicación · hace 2 días»). Toda la fila abre el detalle del nodo; **Editar y Eliminar se conservan** como botones de la fila. Se quitaron las columnas Serie (vacía), Habilitado («Sí» en todos; ahora solo se escribe «deshabilitado» si lo está) y GPS con 7 decimales (queda en el detalle). Título «Nodos», sin «Gestión de Nodos» ni subtítulo. 131 → 95 palabras; sin tablas.

**Equipos (`/admin/gateways`)** — cambios de texto, sin tocar la lógica:
- **«Rancho» → «Predio»** en todo el flujo (asistente, vinculación, revocación y detalle) y el nombre del equipo se escribe **cliente · predio** (antes predio · cliente), como en el resto de la aplicación.
- «Revocados (15)» → **«Enlaces revocados (15)»**.
- **«Esperando nodo · Ahora»** ya no se contradice: si llegan datos de un área sin nodo asignado al equipo, dice **«Llegan datos, sin nodo asignado · último dato ahora»**.
- **No se cambió** el cálculo del estado («Asignando nodos · 0 de 4 áreas con datos»): viene de la vinculación del equipo, no de las lecturas. En los datos de prueba hay lecturas que llegan sin pasar por el equipo, por eso la tarjeta y la pantalla Nodos difieren; en un despliegue real, donde todo llega por el equipo, coinciden. **Tampoco se hizo** la ficha del equipo en lugar del asistente (queda propuesta): es un cambio más delicado que conviene validar con un equipo real.

**Pruebas:** typecheck, 162 unitarias (se actualizaron las de Equipos, Vinculación, Detalle de equipo y Nodos) y build; sin errores de JavaScript. Flujo comprobado con clics reales (escritorio y móvil): mapa → predio → pin → «Abrir área». `navigation.spec.ts` y `equipos.spec.ts` actualizados, **no ejecutados**. Quedan sin uso en `components/maps/mapHelpers.ts` las funciones de clusters.

## Segunda ronda: Equipos con el estilo de Nodos (2026-11-01)

JP aprobó todo menos Equipos («se ve vacía y distinta» y «los enlaces revocados») y eligió filas con ficha.
- **Lista de filas a todo el ancho** (misma caja y mismo estilo que Nodos y el Directorio) en lugar de una tarjeta chica con media pantalla vacía. Cada fila: **«Cliente · Predio»**, «N de M áreas con datos · **Última comunicación hace X**» (de la hora del último latido del equipo; «Sin comunicación todavía» si no hay; nada si falta vincular), el estado con su ícono y la acción: «Vincular equipo» o «Ver avance» (abren el asistente solo para equipos nuevos o incompletos) o «Ver detalle» (la ficha `/admin/gateways/:id`, que ya existía, para los que están funcionando).
- **«Enlaces revocados (N)»** es ahora una sección plegable con su explicación («Equipos que ya no envían datos a ningún predio. Un predio con el enlace revocado se puede vincular de nuevo desde “Nuevo equipo”»), y cada fila dice el cliente, el predio y **la fecha de revocación**.
- No cambia la lógica ni el cálculo del estado.
- Pruebas: typecheck, 162 unitarias (la de la lista ajustada a «Última comunicación») y build; sin errores de JavaScript. `equipos.spec.ts` no ejecutado.

### Ajuste: alineación del estado en Nodos

En la lista de Nodos el estado («Al día», «Sin comunicación») flotaba al centro y cada fila empezaba en un punto distinto. Ahora el estado es una **columna de ancho fijo** alineada a la izquierda (comprobado: las seis filas empiezan en el mismo píxel, 734 px a 1100 de ancho). En **móvil** el estado pasa debajo del nombre, también alineado, para que el nombre del área no se aplaste.
