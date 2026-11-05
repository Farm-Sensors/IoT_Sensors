# Auditoría del administrador › Hoy (`/admin`), 2026-11-01

Primera pantalla del recorrido del administrador (después: Clientes, Red con sus tres pestañas, Ajustes y Ciclos). Capturas reales (1366 y 390 px, `admin@sensores.com`) en `audit/results/audit-admin-hoy/`. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas:** 935 px de alto en escritorio y 1596 px en móvil; 184 palabras; 7 pendientes en dos grupos; 11 enlaces.

## Hallazgos

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **La calma de las cifras contradice los pendientes.** «Nodos habilitados 6/6» refleja la configuración, no la comunicación: dice 6/6 mientras 2 áreas llevan 2 días sin datos. Ninguna cifra dice «cuántas áreas están al día». | Alta |
| 2 | **Los pendientes repiten el mismo texto:** «No tiene un ciclo de cultivo activo» 5 veces y «Agricola del Norte · DEMO - Rancho Norte» en 4 renglones seguidos. Cuatro de las cinco áreas sin ciclo son del mismo predio: es **un** problema («DEMO - Rancho Norte: 4 áreas sin ciclo»), no cuatro. | Alta |
| 3 | **Los pendientes no se pueden resolver desde aquí:** cada renglón es un enlace a otra pantalla, sin una acción con nombre («Crear ciclo», «Registrar nodo»). | Media |
| 4 | **Una tarjeta entera para decir «0»:** «Nodos deshabilitados 0 · Todos los nodos registrados están habilitados» ocupa espacio y repite la cifra de arriba. | Media |
| 5 | **«Actividad reciente» no muestra actividad:** es un párrafo y un botón hacia la Auditoría. El título promete algo que no hay. | Media |
| 6 | **«Configurar Umbrales» lleva a una función de Fase 2** (apagada). Un administrador la ve como una acción normal. | Media |
| 7 | **Las cifras de arriba no dicen nada accionable:** «Clientes 2, Predios 3, Lecturas hoy 2,282» ocupan lo más visible y no llevan a ninguna parte (ni se sabe de cuándo son los datos). | Media |
| 8 | **Todo pesa lo mismo:** cuatro cajas blancas del mismo tamaño y borde; lo urgente (pendientes) y lo accesorio («Actividad reciente») se ven igual. | Media |
| 9 | **Móvil de 1596 px:** los pendientes ocupan la mitad y las acciones quedan al final. | Alta |

Causa de fondo: la pantalla es un **tablero de contadores con una lista debajo**, y el administrador quiere saber en una línea **si la red está bien y qué tiene que arreglar**.

## Propuesta (pendiente de aprobar)

1. **Una frase de estado arriba,** con la barra de una franja por área (la misma de «Mis predios»): «4 de 6 áreas al día · 2 sin comunicación · 5 sin ciclo». Es lo primero que se lee.
2. **Pendientes agrupados por predio y por tipo,** con **una acción con nombre** por renglón: «DEMO - Rancho Norte · 4 áreas sin ciclo — **Crear ciclos**» y, para cada área sin comunicación, «último dato hace 2 días — **Ver área**». Se acaba la repetición del cliente y del texto.
3. **Las cifras de totales** (clientes, predios, nodos habilitados, lecturas de hoy) **pasan a una línea pequeña** bajo el título, con su hora de actualización; se conserva el refresco de 3 s.
4. **«Nodos deshabilitados» aparece solo si hay alguno,** como un tipo más de pendiente.
5. **Acciones en el encabezado:** «Nuevo cliente» y «Nuevo nodo» como botones; «Ver auditoría» como enlace. **«Configurar Umbrales» solo se muestra si el módulo de alertas está activo.** «Actividad reciente» se elimina como tarjeta.
6. **Móvil:** la frase de estado y los pendientes agrupados primero; los botones de acción en una fila que se desplaza.

**Meta medible:** de 184 a unas 90 palabras, de 935 a unos 650 px en escritorio y de 1596 a unos 1000 px en móvil. Se mantienen: los totales y su refresco de 3 s, el cálculo de pendientes con datos existentes (sin endpoints nuevos), «Ver auditoría», `null` nunca como 0 y ningún consejo de riego.

## Aplicado (2026-11-01)

- **Frase de estado y barra de franjas** (una por área: verde al día, rojo sin comunicación, gris sin datos o sin nodo): «4 de 6 áreas al día · 2 sin comunicación · 5 sin ciclo». Salen del mismo cálculo de los pendientes (`summarizeAreas`), sin endpoints nuevos.
- **Totales en una línea pequeña** («2 clientes · 3 predios · 6/6 nodos habilitados · 2,294 lecturas hoy · Actualizado hace un momento»). **Se conserva el refresco de 3 s** de los totales.
- **Pendientes agrupados y con acción con nombre:** sin comunicación (una fila por área, «Ver área»), sin datos, sin nodo («Registrar nodo»), **sin ciclo agrupado por predio** («DEMO - Rancho Norte · 4 áreas sin ciclo — Crear ciclos», que abre el predio en el Directorio; con una sola área, «Crear ciclo» abre su pestaña Ciclos), equipo por vincular («Vincular») y nodos deshabilitados (solo si los hay, «Ver nodo»). Cuatro renglones repetidos pasaron a uno.
- **Acciones en el encabezado:** botones «Nuevo Cliente» y «Nuevo Nodo» y enlace «Ver Auditoría». **«Configurar Umbrales» solo aparece si el módulo de alertas está activo** (hoy no lo está). Se eliminaron las tarjetas «Nodos deshabilitados» (vacía), «Acciones rápidas» y «Actividad reciente».
- **Medido:** de 184 a 125 palabras (la lista de pendientes es más corta, pero ahora hay verbos de acción); de 935 a 900 px en escritorio (la altura la fija la pantalla: ya no sobra espacio) y de 1596 a 907 px en móvil. La meta de ~90 palabras no se alcanzó: cada renglón lleva su acción.
- **Comprobado con clics reales:** «Crear ciclos» → `/admin/predios/1/areas`; «Ver área» → `/admin/areas/5?tab=nodo`. Sin errores de JavaScript. typecheck, 161 unitarias (la prueba de pendientes cubre la agrupación y el resumen) y build.

## Segunda ronda: se probó un mapa de la red y se descartó (2026-11-01)

JP no quedó conforme con la versión aplicada y pidió «algo más visual». Se probó un **mapa de la red** (un pin por predio con sus pendientes y la lista filtrable al lado) y **tampoco convenció**. Se retiró por completo (`NetworkMap` y el cálculo de pines) y Hoy volvió a la versión de la sección anterior: frase de estado con barra, totales en una línea, pendientes agrupados con acción y acciones en el encabezado.

**Pendiente:** JP indicó que lo que no le convence es **«todo el estilo»** de esta pantalla (se siente igual a lo demás, sin personalidad), no un elemento concreto. Hace falta una referencia o una dirección visual antes de rediseñarla otra vez; no se sigue iterando a ciegas.

## Tercera ronda: la urgencia primero (2026-11-01)

Se partió de la pregunta «¿qué quiere ver primero un administrador y por qué?». Respuesta de JP: es **una sola persona** que atiende a todos los clientes. Razonamiento aplicado: al estar apagadas las alertas automáticas (Fase 2), esta pantalla es la **única** que avisa que algo falló, y lo único que afecta al cliente ahora es que **dejen de llegar sus datos**.
- **1. «Datos que dejaron de llegar»** (arriba, con el conteo en rojo y una barra roja a la izquierda): una fila por área, con el **cliente** como título, «predio · área» debajo y, a la derecha, **desde cuándo** («hace 2 días») y la acción («Ver área» / «Ver nodo»). Ordenadas de la que más tiempo lleva sin datos a la que menos. Si no hay ninguna: «Todos los nodos están enviando datos.»
- **2. «Por configurar»** (más discreto): sin nodo, sin ciclo agrupado por predio, equipos por vincular y nodos deshabilitados. Puede esperar; el cliente aún no lo nota.
- **3. Totales al final y pequeños** (clientes, predios, nodos habilitados, lecturas hoy, hora de actualización; sigue el refresco de 3 s). La salud general («4 de 6 áreas al día») va en el subtítulo.
- Se quitaron la barra de franjas y el mapa. Botones en el encabezado igual que antes («Configurar Umbrales» solo con alertas activas).
- Pruebas: typecheck, 162 unitarias (nueva: orden por antigüedad y datos de cliente/lugar/desde cuándo) y build; sin errores de JavaScript.

## Cambio de nombre y de acciones (2026-11-01)

JP: «Hoy» no convence y hay demasiados botones arriba. **La pantalla se llama ahora «Inicio»** (menú, título y pruebas); las rutas no cambian (`/admin`). **Acciones del encabezado:** quedan solo las dos de crear, **Nuevo Cliente** y **Nuevo Nodo**, con el mismo tamaño (40 de ancho en escritorio, mitad y mitad en móvil). **Registro de eventos** y **Configurar umbrales** salen del encabezado porque ya tienen su sitio en el menú: Registro de eventos es una pestaña de Ajustes y Umbrales es una pestaña de Alertas.

## Cuando todo está bien (2026-11-01)

JP preguntó qué se ve en «Inicio» si todo está configurado y todos los nodos envían datos. **Antes:** solo una línea («Todos los nodos están enviando datos») y las cifras en letra pequeña: casi una pantalla vacía. **Ahora:** un bloque **«Todo en orden»** («Todos los nodos están enviando datos y no hay nada por configurar») con cuatro cifras como tarjetas (Clientes, Predios, Nodos habilitados y Lecturas hoy; las tres primeras llevan a su pantalla) y la hora de la última actualización. En cuanto hay algo urgente o por configurar, vuelve la vista de pendientes de siempre y las cifras regresan a la línea del pie.
