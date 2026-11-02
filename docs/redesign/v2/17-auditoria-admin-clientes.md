# Auditoría del administrador › Clientes (Directorio, `/admin/clientes`), 2026-11-01

Capturas reales (1366 y 390 px, `admin@sensores.com`; lista, cliente, predio, área con sus pestañas Resumen, Ciclos y Nodo) en `audit/results/audit-admin-clientes/`. Revisada con las guías `frontend-design` y `dataviz`.

**Medidas (escritorio):** lista 67 palabras, cliente 85, predio 150, área 85–97; hasta 24 botones por pantalla. **Móvil:** 1152 px la lista, 1383 el cliente y 1556 el predio.

## Hallazgos

| # | Hallazgo | Gravedad |
|---|---|---|
| 1 | **Las acciones de la lista de clientes quedan cortadas.** A 1366 px el botón «Editar» se ve como «Ed» y los demás (Predios, Dashboard, Borrar) no se ven: están fuera de la caja y hay que desplazarla de lado. La tabla compite con el árbol (320 px) y los nombres se parten en tres líneas («Agricola / del / Norte»). | Alta |
| 2 | **Tres sistemas de navegación para la misma jerarquía:** las pestañas «Clientes / Ciclos de cultivo», el árbol de la izquierda y la ruta «Clientes › Agricola del Norte › Granja Hogar › Area…». El nombre del área aparece **tres veces** (árbol, ruta y título). | Alta |
| 3 | **Dos buscadores para lo mismo:** «Buscar cliente, predio o área» (árbol) y «Buscar por nombre, email o teléfono» (lista). | Media |
| 4 | **Títulos que repiten o explican la técnica:** «Clientes», «Gestión de Clientes», «Administra los clientes del sistema» y «Directorio: cliente › predio › área, con altas y ediciones en el mismo lugar». En un predio: «Predios» (ruta), «Predios» (título) y «Predios de Agricola del Norte» (subtítulo). | Media |
| 5 | **No dice cómo está nadie.** La lista muestra «Activo» en todos los clientes (no informa nada) y ningún indicador de salud, aunque la pantalla Hoy acaba de decir que dos áreas llevan días sin datos. En el árbol solo hay un triángulo por área, sin conteos en cliente ni predio. | Alta |
| 6 | **El resumen del área dice cosas vagas:** «Ciclo de cultivo: **Con ciclo**» y «Nodo: **Asignado**», sin fechas, sin nombre y sin cuándo llegó el último dato. | Alta |
| 7 | **El área no tiene «Editar» ni «Borrar»:** hay una instrucción («Para editar o borrar el área, abre su predio en el árbol») en lugar del botón. Cliente, predio y área se comportan distinto. | Media |
| 8 | **Tablas anchas dentro de un panel angosto:** áreas con nombre en 3 líneas y botones Editar/Borrar en cada fila; en Nodo, una tabla de 7 columnas (Nombre, Serie, Área vinculada, GPS, Habilitado, Última lectura, Acciones) en 750 px. Mucho texto repetido («Nodo DEMO - Nogal Norte» como nodo del área «DEMO - Nogal Norte»). | Media |
| 9 | **Pestañas Ciclos y Nodo traen sus propios títulos de pantalla** («Gestión de Ciclos de Cultivo / Administra los ciclos de cultivo por área», «Gestión de Nodos / Administra los sensores IoT del sistema») y el nombre del área otra vez. | Media |
| 10 | **Coordenadas en crudo** como ubicación del predio (`28.6850292,-106.0765387`). | Baja |
| 11 | **Botones ambiguos:** «Dashboard» (¿de qué?, es la preferencia de tarjetas del cliente) y «Predios» frente a «Ver Predios» en móvil. | Baja |
| 12 | **Móvil largo (1383–1556 px)** y sin el árbol: se navega solo con las listas y la ruta. | Media |

Causa de fondo: el Directorio **junta tres pantallas de gestión antiguas dentro de un árbol**, y cada una conserva su título, su buscador y su tabla. Falta una cabecera única por nivel que diga **qué es, cómo está y qué se puede hacer**.

## Propuesta (pendiente de aprobar)

1. **Una sola navegación.** En escritorio: el árbol (con un solo buscador) y, **sin la ruta repetida**, la cabecera del panel ya dice dónde estás. En móvil: la barra de ruta nueva de la aplicación del productor (la misma de «Mis predios › Predio › Área»), sin árbol.
2. **Cabecera única por nivel**, con acciones arriba a la derecha y el estado de salud: cliente → «Agricola del Norte», «Alan Test · alan2203mx@gmail.com · 3 predios · 6 áreas · **2 sin comunicación**» y [Editar] [Borrar] [Preferencias del dashboard]; predio y área igual (y **el área también con Editar y Borrar**). Se acaban «Gestión de…», «Administra…» y «Directorio: …».
3. **Lista de clientes en filas, no en tabla:** nombre de la empresa, contacto y un indicador de salud («Todo al día» o «2 sin comunicación»), con la fila completa abriendo al cliente. Sin columna «Estado: Activo». Se quita su buscador (queda el del árbol).
4. **Predios y áreas como filas ligeras** (nombre, ubicación en texto, «N áreas · X al día», estado) con «Editar» y «Borrar» dentro de cada panel, no en cada fila.
5. **Resumen del área con hechos:** estado de datos («Al día» o «Sin comunicación · hace 2 días»), ciclo («Desde 30/09/2026, día 33») y nodo (nombre, habilitado y última lectura), cada uno con su enlace a su pestaña.
6. **Pestañas Ciclos y Nodo sin título propio** y con **tarjetas en lugar de la tabla de 7 columnas**.
7. **Árbol con conteos:** en cliente y predio, un número con los problemas (en rojo si hay sin comunicación) en lugar de solo el triángulo del área.
8. Ubicación del predio: texto real o «Ubicado por coordenadas».

**Meta medible:** que las acciones de cada nivel estén visibles sin desplazarse, de 3 títulos por pantalla a 1, de 2 buscadores a 1, de 150 palabras (predio) a unas 70, y el estado de salud visible en lista, cliente, predio y área. Se mantienen: todas las altas, ediciones y bajas actuales (mismos endpoints), el filtrado por cliente/predio/área de Ciclos y Nodo, y `null` nunca como 0.

## Aplicado (2026-11-01)

El Directorio conserva sus altas, ediciones y bajas (mismos formularios, mismos endpoints, mismos diálogos de confirmación); cambia cómo se presentan.
- **Una sola navegación:** en escritorio, el árbol (con su único buscador) y la **cabecera del panel** dicen dónde estás; la ruta repetida se retiró. En **móvil** no hay árbol: se usa la barra de ruta nueva (la misma de «Mis predios › Predio › Área»).
- **Un título por pantalla:** `h1 «Clientes»` y un `h2` por nivel (la empresa, el predio o el área). Desaparecieron «Gestión de Clientes», «Administra los clientes del sistema», «Directorio: cliente › predio › área…» y los títulos propios de las pestañas Ciclos y Nodo.
- **Cabecera con estado y acciones** (componente `directory/Health.tsx`): título, línea de contexto («Alan Test · alan2203mx@gmail.com · 3 predios · 6 áreas · ⚠ 2 sin comunicación») y, arriba a la derecha, **Editar**, **Borrar** y, en el cliente, **Preferencias del dashboard**. **El área también tiene Editar y Borrar** y ya no hay la instrucción «abre su predio en el árbol». Al borrar se vuelve al nivel superior.
- **Lista de clientes, de predios y de áreas en filas** (toda la fila abre su detalle) en lugar de tablas, con un **indicador de salud** («Todo al día», «2 sin comunicación», «4 por configurar», «Sin áreas») en lugar de «Activo». Las acciones ya no quedan cortadas ni dependen del ancho.
- **Árbol con conteos:** en cliente y predio, un número con las áreas pendientes (rojo si alguna no se comunica); en cada área, un punto (rojo si no se comunica).
- **Resumen del área con hechos y acciones:** *Datos* («Sin comunicación · último dato hace 2 días»), *Ciclo de cultivo* («Desde 01/10/2026 · día 32», con «Crear ciclo» / «Ver ciclos») y *Nodo* (nombre y habilitado, con «Registrar nodo» / «Ver nodo»). Se retiró «Siguiente paso».
- **Ciclos y Nodo sin título propio;** Nodo pasa de una tabla de 7 columnas a **tarjetas** (nombre, habilitado, último dato, serie solo si existe, coordenadas formateadas, editar y eliminar).
- **Ubicación del predio:** texto real o «Ubicado por coordenadas».
- **Medido (escritorio):** lista de 67 a 40 palabras, cliente 85 a 89, predio 150 a 131, área 85 a 87, con el estado de salud ahora visible en todos los niveles; **tablas: 0**; botones en la lista: de 19 a 3. **Móvil:** lista de 1152 a 788 px, cliente de 1383 a 867 px y predio de 1556 a 812 px.
- **Comprobado con clics reales (escritorio y móvil):** abrir cliente desde la fila; «Editar» abre su ventana; abrir predio y área; «Borrar» del área pide confirmación; sin errores de JavaScript. typecheck, 162 unitarias y build. `admin-hierarchy.spec.ts` actualizado al flujo de filas, **no ejecutado** (escribe en la base local).
- **Limitación:** las palabras del cliente y el predio casi no bajan porque ahora hay más información útil (estado, conteos, acciones con nombre); lo que baja es la cantidad de títulos, buscadores, tablas y botones.
