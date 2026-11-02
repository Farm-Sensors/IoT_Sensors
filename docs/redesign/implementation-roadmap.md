# Roadmap de implementación

Rama: `redesign/ux-ui-overhaul`. Cada etapa es independiente, se valida antes de pasar a la siguiente y se deja en commits propios dentro de la rama (cuando se autorice implementar). Orden por impacto en el usuario y por dependencias: primero lo que hoy bloquea el uso (navegación móvil y tablas cortadas), después lo que ahorra pasos, al final la consolidación visual.

Verificación común a **todas** las etapas: `cd frontend && npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, `npm run test:a11y` (sin aumentar `e2e/a11y-baseline.json`), y capturas antes/después a 1366 (claro y oscuro), 768 y 390 px con el mismo script de recorrido de esta auditoría. Las peticiones de red de cada pantalla deben ser idénticas antes y después (misma lista de URL y parámetros).

| Etapa | Qué | Impacto | Depende de |
|---|---|---|---|
| 0 | Preparación y red de seguridad | Habilita medir | — |
| 1 | Marco y navegación | Alto | 0 |
| 2 | Tablas responsivas del admin | Alto | 0 |
| 3 | Contexto del cliente, Histórico y descarga | Alto | 1 |
| 4 | Panel admin y atajos de alta | Medio | 1, 2 |
| 5 | Dashboard del cliente: frescura y dato antiguo | Medio | 1 |
| 6 | Consolidación visual y modo oscuro | Medio | 1–5 |
| 7 | Refactors técnicos | Bajo (calidad) | cualquiera |

---

## Etapa 0 · Preparación y red de seguridad

**Estado: implementada y verificada en la rama, sin commit.** Verificación (al cerrar la etapa 0): 160 pruebas unitarias, `typecheck` y `build` en verde; `npx playwright test` 71 pasan, 0 fallan, 6 omitidas (las mismas que antes); las 6 páginas que el suite a11y no podía medir ahora se miden y pasan sin tocar `a11y-baseline.json`; 0 animaciones en curso en `/cliente`, `/cliente/areas`, `/cliente/historico`, `/admin/nodos/:id` y `/admin/clientes`, también con movimiento reducido. Cambios: `FreshnessIndicator` y «Estado del Riego» con punto estático, `PageTransition` y `animate-stagger-*` solo con opacidad (150 ms), fondo animado retirado (`AnimatedBackground` eliminado), bloque `prefers-reduced-motion` en `theme.css`, reglas de rutas actualizadas y sección «Movimiento» en `design-system.md`.

1. **Objetivo:** poder medir antes de cambiar.
2. **Resuelve:** las 3 páginas × 2 anchos que el suite a11y no mide hoy; reglas que prohíben cambiar rutas.
3. **Pantallas:** `/cliente`, `/cliente/areas`, `/admin/nodos/:id`; ninguna visible cambia.
4. **Componentes:** quitar el pulso infinito de `FreshnessIndicator` y de «Estado del Riego» (causa confirmada del fallo a11y en `/cliente/areas` y `/admin/nodos/:id`) y añadir un bloque global `prefers-reduced-motion` en `theme.css`; `docs/ui-redesign-rules.md` §2 (permitir las rutas aprobadas aquí); guardar el script de recorrido en `frontend/e2e/` solo si el dueño lo aprueba.
5. **Navegación:** ninguna.
6. **Visual:** los puntos de estado dejan de pulsar (el texto ya dice el estado); `PageTransition` pasa a solo opacidad y 150 ms; fondo animado sustituido por fondo sólido.
7. **Riesgos:** el test a11y es de otro equipo; tocar su espera podría ocultar una regresión real. Preferible arreglar la animación, no el test.
8. **Verificación:** `npm run test:a11y` pasa 54/54 en lugar de 42 + 6 fallos; el baseline no cambia.

## Etapa 1 · Marco y navegación

**Estado: implementada en la rama, sin commit.** Cambios: `AppShell` compartido; `items.ts` con grupos, `mobileTab`, `alsoActiveOn` y la entrada «Ciclos»; `MobileTabBar` de tres destinos + «Más»/«Cuenta»; `MoreSheet`; barra lateral del admin en tres grupos; «Dashboard» pasa a «Inicio». Dos desviaciones respecto al plan inicial, a propósito: (1) **no** hay menú de avatar en escritorio, porque dejaba «Cerrar sesión» a un clic más sin beneficio (el cluster inferior ya cabe) y `auth.spec` lo usa; el menú de usuario solo existe en móvil; (2) las entradas de Fase 2 viven en el grupo «Sistema» (escritorio) y en la hoja (móvil), con el mismo gate de módulo.

1. **Objetivo:** que todo destino sea visible y alcanzable, en móvil y escritorio.
2. **Resuelve:** N1, N2, N4 (opción elegida), parte de N5; C3 («Inicio»).
3. **Pantallas:** todas (el marco).
4. **Componentes:** nuevo `layouts/AppShell.tsx`; `ClientLayout`/`AdminLayout` reducidos; `navigation/items.ts` (grupos, «Ciclos», «Más»/«Cuenta»); `MobileTabBar` (4 pestañas + hoja); `DesktopSidebar` (grupos admin, avatar con menú); nuevo `MoreSheet`.
5. **Navegación:** móvil admin Inicio · Clientes · Equipos · Más; móvil cliente Inicio · Histórico · Mapa · Cuenta; barra lateral admin en tres grupos; `/admin/ciclos` entra al menú. Rutas sin cambio; los gates de Fase 2 intactos.
6. **Visual:** hoja inferior, rótulos de grupo, objetivos ≥ 44 px.
7. **Riesgos:** las e2e `navigation.spec.ts` y `auth.spec.ts` fijan etiquetas de menú; el gate `useModules` debe seguir filtrando; en móvil, «Predios» (cliente) pasa al selector de la etapa 3, así que **esta etapa deja «Predios» en la hoja «Cuenta» hasta que exista el selector** para no perder acceso.
8. **Verificación:** en 390 px no queda ítem fuera de pantalla (`scrollWidth ≤ clientWidth` en la barra); «Salir» en ≤ 2 acciones; con módulos apagados el menú muestra los mismos destinos que hoy; con módulos activos simulados en las pruebas unitarias (`navigation.test.tsx`, **sin encender ningún flag**) aparecen sus entradas; e2e de navegación actualizadas.

## Etapa 2 · Tablas responsivas del admin

**Estado: implementada en la rama, sin commit.** Cambios: `ResponsiveTable` (acción principal + menú «⋯», tarjetas bajo 1280 px) aplicado a Clientes, Predios, Áreas de riego y Nodos; sin cambios de rutas ni de llamadas a la API. Desviaciones respecto al plan, a propósito: (1) **solo cuatro de las seis pantallas son tablas**: Ciclos y Catálogo ya son listas de tarjetas con acciones de 44 px y nombre accesible, así que no se tocan; (2) el punto de corte es **1280 px**, no 768: con la barra lateral (272 px) el contenido útil a 768-1279 px no alcanza para seis columnas, y `ClientManagement` ya tenía vista de tarjetas por debajo de `md`, pero demasiado baja; (3) en cada fila la acción principal es la que baja un nivel (**Predios**, **Áreas de Riego**) o edita (**Editar** en Áreas y Nodos), y «Editar», «Dashboard» y «Borrar» de Clientes pasan al menú; (4) las tablas quedan **planas** (sin tarjeta alrededor), como pide `design-proposal.md`.

1. **Objetivo:** que las acciones nunca queden fuera de vista.
2. **Resuelve:** U1, O1, U7, T4.
3. **Pantallas:** `/admin/clientes`, `…/predios`, `/admin/predios/:id/areas`, `/admin/nodos`, `/admin/ciclos`, `/admin/cultivos`.
4. **Componentes:** nuevo `ResponsiveTable` + `RowActions`; las seis páginas pasan sus columnas y acciones; `ConfirmDialog` y `FormDialog` sin cambio.
5. **Navegación:** ninguna; los botones «Predios», «Áreas de Riego», «Dashboard» siguen yendo a las mismas rutas.
6. **Visual:** una acción principal visible + «⋯»; tarjetas bajo 768 px; encabezados fijos.
7. **Riesgos:** perder una acción al agrupar (cubierto con una prueba que cuenta las acciones antes/después por fila); `admin-hierarchy.spec.ts` busca botones por nombre (hay que mantener nombres accesibles).
8. **Verificación:** a 768 y 390 px cada fila muestra su acción principal sin desplazarse; las 5 acciones de Clientes siguen operables por teclado; borrar abre el mismo diálogo de confirmación; e2e `admin-hierarchy` en verde.

## Etapa 3 · Contexto del cliente, Histórico y descarga

**Estado: implementada en la rama, sin commit.** Cambios: `ContextSwitcher` en el marco (un solo selector de predio y área, con «Ver predio» y «Todos los predios»), sin selectores propios en el dashboard ni en el histórico; «Predios» y «Exportar» salen del menú; `/cliente/exportar` redirige a Histórico; los botones de descarga suben a la cabecera del histórico; fechas y ciclo comparten fila y el resumen de filtros pasa a una línea. Desviaciones a propósito: (1) el selector conserva los **`select` nativos** (accesibles y mejores en móvil) en lugar de un menú propio, y no muestra frescura por área porque eso exigiría peticiones nuevas (la frescura sigue en «Todos los predios»); (2) «Filtros activos» **no** se oculta: `design-system.md` lo fija como regla visible, así que se compacta a una línea; (3) los botones de descarga conservan los nombres «CSV», «Excel» y «PDF» (seis pruebas los fijan) dentro del grupo «Descargar resultados»; (4) el selector no aparece en el mapa, que no tenía selectores propios y necesita todo el alto; (5) `ExportData.tsx` queda sin ruta pero sin borrar, como pide el roadmap.

1. **Objetivo:** elegir área una sola vez y descargar sin repetir filtros.
2. **Resuelve:** N6, F1, F4, O3, N4.
3. **Pantallas:** `/cliente`, `/cliente/historico`, `/cliente/exportar`, `/cliente/mapa`, `/cliente/areas`, `/cliente/predio/:id`.
4. **Componentes:** nuevo `ContextSwitcher` en el encabezado de `AppShell`; se retira `SelectionScopeBar` de las páginas que lo usan (el componente se conserva si otra lo necesita); `HistoricalData` y `ReadingDateRangeSelector` solo en disposición; `routes.tsx`: `exportar` pasa a `<Navigate>`.
5. **Navegación:** «Exportar» y «Predios» salen del menú; `/cliente/exportar` redirige a Histórico; «Ver todos los predios» abre `/cliente/areas`.
6. **Visual:** barra de filtros de 1–2 filas, gráfica visible sin desplazarse a 1366×900.
7. **Riesgos:** **alto**. Las llamadas `api.*` de `ExportData.tsx` y `ReadingDateRangeSelector.tsx` deben quedar byte a byte (regla §2); `ExportData` se retira del enrutado pero **no se borra** hasta que el dueño lo autorice, y no se tocan `utils/export` ni `readingFilters`. La clave de persistencia del contexto (`persistenceKey`) no cambia. `history-export.spec.ts` fija «Descargar CSV»: se conserva la etiqueta.
8. **Verificación:** cambiar de área desde `/cliente/historico` en 2 acciones; descargar los 3 formatos con los mismos parámetros que hoy (comparar la URL de `/readings/export` en Playwright); `/cliente/exportar` termina en Histórico conservando el área; lista de peticiones idéntica.

## Etapa 4 · Panel admin y atajos de alta

**Estado: implementada en la rama, sin commit.** Cambios: panel rehecho (nodos deshabilitados primero solo si los hay, franja compacta de totales, «Nuevo Cliente» y «Nuevo Equipo» que abren directamente su alta); hook `useOpenFromQuery` (abre el alta con `?nuevo=1`, precarga `?area=ID` y limpia la URL); Clientes, Nodos y Ciclos lo usan; las filas de Áreas ofrecen «Nuevo ciclo» y «Nuevo nodo» (este solo si el área no tiene); `ResponsiveTable` gana `isVisible` por fila. Desviaciones a propósito: (1) **«Nuevo Nodo» se sustituyó por «Nuevo Equipo»** en las acciones rápidas, porque Equipos es el camino recomendado (el asistente crea los nodos); Nodos sigue en su pantalla y ahora acepta `?area=ID&nuevo=1`; (2) solo **Clientes y Nodos** enlazan a su lista desde los totales: Predios y Lecturas no tienen pantalla propia; (3) la cifra de la verificación se corrigió: el flujo pasa de **13 a 12 acciones**, no a 9 (el 9 suponía botones directos y no contaba volver atrás ni algunos «guardar»); la ganancia es no escribir una URL ni buscar de nuevo el área; (4) **N3 queda a medias**: el menú ya marca Clientes dentro de predios y áreas (etapa 1) y las filas ofrecen el siguiente paso, pero el conteo «N predios · M áreas» por cliente exigiría peticiones nuevas y no se hizo; (5) el texto de ayuda de Nodos sobre el orden Equipos → Nodos no se añadió: el formulario ya dice «el nodo físico se vincula desde la pantalla del equipo» y el atajo del panel ya apunta a Equipos.

1. **Objetivo:** menos pasos para dar de alta y un panel que sirva.
2. **Resuelve:** O2, U3, F2, F3, N3, N5.
3. **Pantallas:** `/admin`, `/admin/clientes`, `/admin/nodos`, `/admin/ciclos`, `/admin/predios/:id/areas`.
4. **Componentes:** `AdminDashboard` (disposición, sin tocar el sondeo de 3 s ni los cálculos); `ClientManagement`, `NodeManagement`, `CropCycleManagement` leen `?nuevo=1` y `?area=ID` (patrón ya usado por `GatewayManagement`); texto de ayuda en Nodos sobre el orden Equipos → Nodos.
5. **Navegación:** parámetros de consulta en rutas existentes; filas de área con «Nodo» y «Ciclos».
6. **Visual:** franja de totales clicable; nodos deshabilitados primero.
7. **Riesgos:** leer un parámetro de URL es lógica de navegación, pero toca el montaje de diálogos; se limita a abrir el diálogo con valores iniciales. «Configurar Umbrales» y «Ver Auditoría» (Fase 2, sin gate) **se conservan tal cual**.
8. **Verificación:** desde el panel, «Nuevo Cliente» abre el diálogo en 1 acción; alta de área + nodo + ciclo en 12 acciones (13 antes) sin URL manual ni reselección del área (guion Playwright con datos `UX-AUDIT` borrados al final); sondeo del panel sigue en 3 s (contar peticiones en 10 s).

## Etapa 5 · Dashboard del cliente

**Estado: implementada en la rama, sin commit.** Cambios: humedad al doble de ancho y dos filas (cifra y anillo mayores) con flujo y E.T.O. apilados a su lado; marca «Dato antiguo» y cifra atenuada en las tres tarjetas cuando la lectura no es reciente; «Estado del Riego» sin fila de antigüedad ni punto sin etiqueta (en móvil ese punto era además un `animate-pulse` infinito); etiquetas del riego en minúsculas con tilde. Desviaciones a propósito: (1) **`FreshnessIndicator` no cambió**: su texto ya trae estado y tiempo, el duplicado era la fila de la tarjeta de riego; (2) se atenúan **solo la cifra y los gráficos**, no los textos de apoyo: axe midió 3,96 de contraste en «Acumulado» al atenuarlo todo (lo detecté midiendo, no a ojo) y se corrigió antes de cerrar; (3) **«Hace 1 dia» sin tilde sigue** en `utils/datetime.ts` (`formatElapsed`), carpeta que las reglas protegen; ya no aparece en el dashboard (la fila se quitó) pero sí en la tabla de Nodos, y corregirlo requiere tu autorización; (4) la insignia de riego sin datos ahora dice «Sin datos», igual que el valor ausente, y las pruebas se adaptaron; (5) el modo oscuro sigue sin distinguir las tarjetas prioritarias del resto (U11), que es de la etapa 6.

1. **Objetivo:** un solo mensaje de frescura y señal clara de dato antiguo.
2. **Resuelve:** C1, C2, U5, U8, U10.
3. **Pantallas:** `/cliente` (escritorio y móvil), `MetricCard`, `FreshnessIndicator`.
4. **Componentes:** `DesktopDashboard`, `MobileDashboard`, `MetricCard` (solo apariencia), `FreshnessIndicator` (**solo la presentación**; su cálculo y `FRESH_MINUTES_THRESHOLD` no se tocan), `IrrigationStatusBadge`.
5. **Navegación:** ninguna.
6. **Visual:** una línea de frescura; humedad al doble de ancho con flujo y E.T.O. apilados a su lado (orden 1-2-3 de `AGENTS.md` §2.2, también en móvil); tarjetas prioritarias atenuadas cuando el dato no es fresco; insignia de riego con icono y texto en lugar del punto; tildes y minúsculas («Sin comunicación», «Hace 1 día»).
7. **Riesgos:** **alto en negocio**: el valor mostrado no puede cambiar, `null` nunca como `0`, y la prominencia de humedad/flujo/E.T.O. (§2.2) debe sobrevivir al atenuado. `client-dashboard.spec.ts` y los tests de `MetricCard`/`FreshnessIndicator` fijan textos.
8. **Verificación:** con datos de hace 45 h las tres tarjetas se ven atenuadas y el valor es idéntico al de la API; con datos frescos, sin atenuar; la frescura aparece una sola vez; prueba de que `null` muestra «Sin datos».

## Etapa 6 · Consolidación visual y modo oscuro

**Estado: implementada en la rama, sin commit.** Cambios: serif solo en `h1` (h2-h4 en sans 600); regla de tres radios aplicada (32 / 16 / píldora, 60 de 24 px, 8 de 16 px y 12 `rounded-xl` unificados); superficies opacas en claro y oscuro; `BentoCard` con dos papeles (`group`, `metric`) y borde de acento de 2 px en la métrica, con lo que se distingue en oscuro; marcadores y controles del mapa de 44×44; fecha del ciclo `dd/MM/aaaa` en cuatro lugares; barra lateral plegada entre 768 y 1023 px. Desviaciones a propósito: (1) **las páginas de Fase 2 no se tocaron** (alias antiguos de `BentoCard`, sus radios y sus títulos quedan como estaban; la tipografía global sí les llega, por ser un estilo base); (2) las primitivas de `components/ui/` conservan sus radios; (3) **las casillas del mapa del admin no se cambiaron**: ya viven dentro de una etiqueta de 44 px de alto, que es el objetivo táctil; los enlaces de atribución de MapLibre quedan exentos (texto legal en línea, WCAG 2.2); (4) toqué `components/maps/mapHelpers.ts` solo en la construcción del botón del marcador (clase y variable de color; la lógica de color por frescura no cambió) y el ancla pasó de `bottom` a `center`, así que el punto coincide con la coordenada; (5) la arena queda solo para botones y chips, no para tarjetas; (6) el nombre «glass» de las clases se conserva por historia aunque ya no hay vidrio. Dos fallos míos cazados al mirar las capturas, no por las pruebas: el subtítulo de la métrica se volvió casi invisible en claro (`MetricCard` comparaba con los nombres antiguos de variante) y la marca de la barra lateral engordó (la regla de `h2` pesa 600); ya hay prueba del primero.

1. **Objetivo:** reglas visuales aplicadas por igual en todas las pantallas.
2. **Resuelve:** U4, U11, U9, O4 (visual), puntos de corte.
3. **Pantallas:** todas.
4. **Componentes:** `BentoCard` con dos variantes (métrica y agrupación) y avisos como banners en línea; regla de tres radios (32 / 16 / píldora); `h2`-`h4` en sans y serif solo en `h1`; navegación sobre superficie sólida; fecha del ciclo en `dd/mm/aaaa`; barra lateral plegada por defecto en 768–1023 px; mapas (objetivos táctiles).
5. **Navegación:** ninguna.
6. **Visual:** énfasis de las prioritarias por borde y tamaño también en oscuro.
7. **Riesgos:** cambios de token en `theme.css` afectan a todo (y la regla de radios y la tipografía obligan a actualizar `design-system.md` en el mismo PR); cualquier token nuevo se documenta en `design-system.md`. El baseline a11y puede subir por contraste: ajustar antes de fusionar.
8. **Verificación:** recorrido completo en claro y oscuro; en oscuro las tarjetas prioritarias se distinguen; objetivos táctiles < 44 px en el mapa ≤ 0 en las pantallas del MVP.

## Etapa 7 · Refactors técnicos (opcional)

**Estado: implementada y verificada en la rama, sin commit.** **T3:** los dos dashboards comparten tipo de props, estado derivado, semáforo, tarjeta de riego y los campos de suelo y ambiente; `DesktopDashboard` queda en 241 líneas y `MobileDashboard` en 168. **T5:** `GatewayManagement` pasa de 837 a 438 líneas (estado, efectos y manejadores) y compone `GatewayList`, `GatewayWizard`, `StepOneForm`, `StepTwoLink` y `StepThreeAssign` (578 líneas en `pages/admin/gateways/`, con `shared.ts`). Nada se movió de `helpers.ts`, `readings.ts`, `services/`, `types/`, `utils/` ni `EquipoStateBadge`.

**Cómo se verificó:** 14 pantallas (dashboard antiguo, reciente y sin datos; Equipos: lista, paso 1, paso 1 con áreas y paso 3; escritorio y móvil) con respuestas de la API grabadas y repetibles. «Antes» es la compilación de `dist` del cierre de la etapa 6, servida en otro puerto, y «después» el servidor de desarrollo, **capturados a la vez** para que el reloj sea el mismo. Resultado: **DOM idéntico en 14 de 14** (dos ejecuciones) y, en imágenes, mismo tamaño y como mucho 139 píxeles distintos en 2 de 14, dentro del ruido medido entre ejecuciones idénticas (219). Además, 287 pruebas unitarias (26 nuevas de las piezas extraídas) y 114 e2e + a11y, con `equipos.spec` en verde y la línea base a11y sin cambios.

Desviaciones a propósito: (1) el criterio «píxel a píxel con tolerancia 0» **no se pudo cumplir tal cual**: hay un ruido de captura de hasta 219 píxeles entre ejecuciones idénticas (animación y texto de recharts) y las horas del texto «hace …» cambian el ajuste de línea; por eso el criterio principal es el **DOM idéntico** (más estricto, porque esta etapa no toca CSS) y los píxeles se comparan contra el ruido medido; (2) mi primera línea base de imágenes quedó contaminada por esos textos dependientes del reloj y la descarté: la comparación válida es la de antes y después a la vez; (3) **no extraje «hooks de datos»**: la obtención de datos ya vive una sola vez en `ClientDashboard` y las dos disposiciones la reciben por props, así que no había duplicación que mover; (4) las tarjetas prioritarias y las gráficas **no se unificaron**: son distintas por diseño (anillo y sparkline solo en escritorio); (5) los pasos 2 y «Listo» de Equipos no tienen captura de la base real (no hay un equipo en ese estado sin crear datos); los cubren las pruebas unitarias nuevas y `equipos.spec`.

1. **Objetivo:** reducir duplicación.
2. **Resuelve:** T3, T5.
3. **Pantallas:** dashboards del cliente, Equipos.
4. **Componentes:** compartir hooks y subcomponentes entre `DesktopDashboard` y `MobileDashboard`; dividir `GatewayManagement` por pasos.
5. **Navegación:** ninguna. **6. Visual:** ninguno.
7. **Riesgos:** mover código sin cambiarlo; si una división obliga a tocar lógica, se detiene y se registra.
8. **Verificación:** `equipos.spec.ts` en verde; capturas idénticas pixel a pixel antes y después (tolerancia 0 en las pantallas no tocadas).

---

## Fuera de alcance de este roadmap

Fase 2 (activar o ampliar), cambios de API o de esquema, polling, `/pair`, retirar funciones, renombrar entidades. Si una etapa lo necesitara: se detiene y se anota en «Propuestas fuera de alcance» del PR, como pide `docs/ui-redesign-rules.md` §6.
