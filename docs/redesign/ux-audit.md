# Auditoría UX

Método: recorrido de las 20 rutas alcanzables de cada rol con Playwright a 1366, 768 y 390 px; interacción con menús, selectores, filtros y diálogos (sin guardar nada); lectura del código para confirmar enlaces. Datos: base local demo. Los números salen de mediciones en el navegador salvo que se indique «derivado» (contado sobre la estructura de rutas observada, no cronometrado).

Prioridades: **C**rítica, **A**lta, **M**edia, **B**aja. Cada hallazgo: qué pasa · dónde · por qué importa · efecto · propuesta.

Los hallazgos de Fase 2 describen lo que se ve, pero **no se propone activar ni ampliar** esa funcionalidad.

---

## Navegación

### N1 · Barra móvil esconde ítems, incluido «Salir» — **Alta**
- **Qué:** la barra inferior es un carrusel horizontal. A 390 px el contenido mide 614 px (admin) y 536 px (cliente) para 389 px visibles. Quedan fuera: admin «Catálogo», «Auditoría», «Tema», «Salir»; cliente «Perfil», «Tema», «Salir».
- **Dónde:** `components/navigation/MobileTabBar.tsx`; capturas `cliente-cliente-mobile.png`, `admin-admin-mobile.png`.
- **Por qué:** lo único que sugiere que hay más es un degradado de 24 px. Cerrar sesión y el perfil requieren adivinar el desplazamiento.
- **Efecto:** en móvil, que es el uso en campo, cuatro de siete destinos del admin no se ven al abrir.
- **Propuesta:** 4 pestañas fijas + «Más» (hoja inferior con el resto, tema y salir). Ver `navigation-architecture.md`.

### N2 · «Ciclos de cultivo» no tiene entrada — **Alta**
- **Qué:** `/admin/ciclos` renderiza («Gestión de Ciclos de Cultivo») pero no está en el menú y ningún enlace del código apunta a ella.
- **Por qué:** el ciclo de cultivo es un concepto central del producto (agrupa datos por temporada, filtra el histórico del cliente). Quien no conozca la URL no puede crearlo.
- **Efecto:** el flujo «dar de alta un área» no se puede completar desde la interfaz.
- **Propuesta:** entrada «Ciclos» en el grupo de terrenos y enlace «Ciclos» desde cada área.

### N3 · Predios y Áreas solo son alcanzables por tablas anidadas — **Media**
- **Qué:** Clientes → botón «Predios» de la fila → botón «Áreas de Riego» de la fila. No hay entrada de menú ni vista transversal; en `/admin/predios/:id/areas` las migas muestran «Clientes › Agricola del Norte › DEMO – Rancho Norte», pero «Áreas de Riego» no figura como destino de menú.
- **Efecto:** para revisar áreas de dos clientes hay que volver a Clientes cada vez (derivado: 3 pantallas y 2 clics por cliente).
- **Propuesta:** mantener la jerarquía (es el modelo del negocio) pero hacer visibles los pasos: conteo y enlace directo «N predios · M áreas» en la fila del cliente, y migas clicables en todas las pantallas de la jerarquía (ya existen en `HierarchyTrail`).

### N4 · Ruta huérfana `/cliente/predio/:predioId` — **Media**
- **Qué:** muestra «Sensores por Área» con humedad y frescura, pero ninguna pantalla enlaza a ella. Tocar un área en «Predios» fija el contexto y salta al dashboard.
- **Por qué:** o es una vista útil que nadie encuentra o es código muerto. No lo decido yo: ver dudas abiertas.
- **Propuesta:** usarla como destino del cambio de predio («Ver predio») o decidir con el dueño si se retira; no se elimina en este trabajo.

### N5 · Dos rutas para dar de alta nodos — **Media**
- **Qué:** «Nodos» (`/admin/nodos`, «Nuevo Nodo» pide área, nombre, serie y GPS) y «Equipos» (el asistente crea los nodos que faltan al elegir las áreas). El propio diálogo aclara que «el nodo físico se vincula desde la pantalla del equipo».
- **Efecto:** el admin no sabe cuál usar primero. El panel ofrece «Nuevo Nodo» como acción rápida.
- **Propuesta:** orden explícito en el texto de ayuda («Primero Equipos; Nodos es para editar GPS y estado») y, en el panel, sustituir el atajo por el flujo recomendado. Sin cambiar ninguna de las dos pantallas.

### N6 · Contexto repetido en cada pantalla — **Media**
- **Qué:** dashboard, histórico, exportar y mapa muestran sus propios selectores de predio/área (en histórico, además, «Contexto activo» en chips encima de los mismos datos en `select`). El contexto persiste entre pantallas (comprobado: histórico abre con «Granja Hogar»), así que se vuelve a elegir sin necesidad.
- **Propuesta:** un selector de contexto único y persistente en el encabezado del layout; cada pantalla lo lee.

### N7 · Páginas de Fase 2 abren por URL con el módulo apagado — **Baja (decisión del dueño)**
- **Qué:** con los módulos apagados, `/cliente/alertas`, `/cliente/umbrales`, `/cliente/notificaciones`, `/admin/alertas`, `/admin/umbrales` cargan («Centro de Alertas», «Umbrales de Alertas»…). Solo el menú las oculta. Además, el panel admin enlaza «Configurar Umbrales» y «Ver Auditoría» sin condición.
- **Por qué importa:** no es un fallo de UX del MVP, pero un usuario que llegue por un enlace ve pantallas de una fase bloqueada.
- **Propuesta:** **no tocar.** `docs/ui-redesign-rules.md` y `AGENTS.md` mantienen esas entradas tal cual; cualquier cambio requiere autorización del dueño de la integración.

---

## Flujos de usuario

### F1 · Exportar está duplicado — **Alta**
- **Qué:** `/cliente/historico` ya tiene botones CSV, Excel y PDF; `/cliente/exportar` repite el rango, el ciclo y los tres formatos con otro selector.
- **Efecto:** el usuario que filtró en Histórico y pulsa «Exportar» en el menú pierde la vista y repite el trabajo (derivado: hasta 5 acciones para llegar a una descarga desde el menú, frente a 1 desde un Histórico ya filtrado).
- **Propuesta:** una sola superficie de descarga (la de Histórico, que ya conserva los filtros); `/cliente/exportar` queda como redirección y no se pierde ninguna función ni formato.

### F2 · Alta completa de un área exige 13 acciones y una URL oculta — **Alta** (derivado)
Clientes → Predios → Áreas → «Nueva Área» → guardar; Nodos → «Nuevo Nodo» → elegir área; `/admin/ciclos` escrito a mano → «Nuevo Ciclo». Resuelto en la etapa 4 (`user-flows.md`: 13 → 12 acciones, sin URL oculta ni reselección): cada fila de área ofrece en su menú «Nuevo ciclo» y, si no tiene nodo, «Nuevo nodo», con el área ya elegida.

### F3 · Atajos del panel solo llevan a la lista — **Media**
«Nuevo Cliente» y «Nuevo Nodo» navegan a la tabla; el formulario se abre con otro clic. «Equipos» ya demuestra el patrón correcto (`?nuevo=1`). **Propuesta:** reutilizar ese parámetro para abrir el diálogo directamente.

### F4 · Cambiar de predio en el cliente da 3 vueltas — **Media**
Menú «Predios» → tocar un área → vuelve al dashboard. Quien solo quiere cambiar de área en el histórico debe usar el `select` de la propia página. Se resuelve con N6.

---

## Claridad visual

### C1 · La misma frescura se cuenta dos veces y con palabras distintas — **Media** (resuelto en la etapa 5)
- **Dónde:** `cliente-cliente-desktop.png`. Encabezado: «Sin reporte reciente · Último dato: 29/10/2026, 9:00:00 p.m. · hace 45h 10min». Tarjeta «Estado del Riego»: «SIN COMUNICACION» y «Antigüedad de la lectura: Hace 1 dia».
- **Por qué:** para un solo hecho hay tres formulaciones y dos formatos de tiempo. Además «SIN COMUNICACION» va sin tilde y «dia» también.
- **Propuesta:** una sola línea de frescura con estado y tiempo; la tarjeta de riego muestra solo el estado del riego. La regla de frescura y el umbral no se tocan.

### C2 · Valores desactualizados con el mismo peso que los vigentes — **Media** (resuelto en la etapa 5)
Con datos de hace 45 h el dashboard muestra «0 L/min» y «62.85 %» en tarjetas oscuras de máxima prominencia. Ninguna señal en la propia tarjeta dice que son viejos (la advertencia está arriba, a distancia). Propuesta: atenuar las tarjetas prioritarias cuando el dato no es fresco, sin cambiar el valor ni mostrarlo distinto de lo medido.

### C3 · Etiquetas inconsistentes — **Baja**
«Dashboard» (inglés) en el menú y «Inicio» en móvil; «Rancho» en Equipos frente a «Predio» en el resto (`docs/ui-redesign-rules.md` §3 prohíbe renombrar: se documenta, no se corrige); «Equipo pendiente» en las tarjetas de área del **cliente**, que expone un estado de infraestructura que el cliente no gestiona.

### C4 · Ruido de red en consola — **Baja**
`GET /weather/current` (409), `/properties/{id}/gateway/status` (404) y `/ndvi-snapshots/latest` (404) responden error en estados esperados (predio sin ubicación, sin equipo, sin NDVI). La interfaz los maneja bien; es ruido de consola. Es lógica de integración: **solo se registra**.

---

## Organización

### O1 · Tablas con acciones cortadas — **Alta**
`/admin/clientes`: el contenedor mide 980 px y la tabla 1 135 px; el botón «Dashboard» se corta y «Borrar» queda fuera de vista en 1366 px (`admin-admin-clientes-desktop.png`). A 768 px es peor: solo se ven Empresa, Contacto y Email, y ninguna acción (`admin-admin-clientes-tablet.png`); el desplazamiento horizontal no tiene indicio visual. Hay cinco acciones por fila con la misma jerarquía. Propuesta: una acción principal visible y el resto en un menú «⋯», con vista de tarjetas por debajo de 768 px.

### O2 · Panel admin con poco valor y mucho espacio — **Media**
Cuatro tarjetas de totales que no son clicables; en móvil ocupan casi una pantalla completa antes del contenido accionable (`admin-admin-mobile.png`). «Actividad Reciente» solo contiene un enlace a Auditoría. Propuesta: franja compacta de totales (cada una enlaza a su lista) y los nodos deshabilitados arriba.

### O3 · Histórico gasta ~700 px antes de mostrar datos — **Media**
A 1366×900 la gráfica queda bajo el pliegue: «Contexto activo» (chips + selectores), presets, fechas, ciclo, panel «Filtros activos» y la línea de disponibilidad (`cliente-cliente-historico-desktop.png`). «Filtros activos» repite lo que los controles ya muestran. Propuesta: barra de filtros en una o dos filas, gráfica visible sin desplazarse, resumen solo cuando los filtros cambian algo respecto al valor por defecto.

### O4 · Dos implementaciones del dashboard — **Baja (técnica)**
`DesktopDashboard` (341 líneas) y `MobileDashboard` (238) se mantienen por separado; ver `frontend-architecture.md`.

---

## Qué no es un problema

El orden de las tres tarjetas prioritarias (humedad, flujo, E.T.O.), las unidades, `null` → «Sin datos», el indicador de frescura por área, el emparejamiento de equipos y la confirmación de borrado funcionan bien y deben conservarse. `h1` único en todas las pantallas, sin desbordamiento horizontal de página en ningún ancho.

## Accesibilidad medida

`npm run test:a11y`: 42 pasan, 6 fallan, 6 omitidas. Los 6 fallos son el mismo tipo: en `/cliente`, `/cliente/areas` y `/admin/nodos/:id` (escritorio y móvil) el test espera a que terminen todas las animaciones (`document.getAnimations()`) y nunca terminan, así que **esas páginas no se midieron**. Reproducido con una segunda ejecución de `/cliente` en escritorio. Sin cambios de código en mi rama, es previo. **Causa identificada:** el pulso infinito `rippleExpand` de `FreshnessIndicator` (un punto por cada dato fresco). Medido en el navegador: 4 animaciones en curso en `/cliente/areas` y 1 en `/admin/nodos/1` y `/admin/nodos/2`; `/cliente` no la mostró porque su área estaba desactualizada en ese momento (con un área fresca sí la tendría; no lo reproduje). Un segundo pulso igual vive en el punto de «Estado del Riego». El CSS no tiene ningún `prefers-reduced-motion`, así que además es un incumplimiento de accesibilidad (**Media**; ver `design-proposal.md`, «Movimiento»). Objetivos táctiles menores de 44 px: 1 en las pantallas principales; 16 en el mapa admin, 9 en el del cliente; 40 y 148 en umbrales y notificaciones (Fase 2).
