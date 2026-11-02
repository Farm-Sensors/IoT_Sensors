# Fases y criterios de aceptación

Cada fase termina en una revisión del usuario. Una fase no empieza sin aprobar la anterior.

## Antes de implementar

**Estado:** preparación (P1 a P4) y las 7 fases de implementación hechas; en revisión en el PR #71.

| Fase | Entrega | Aceptación |
|---|---|---|
| **P2. Auditoría** ✅ | `01-auditoria.md`, evidencia en `audit/` | Base aislada; todas las tareas recorridas en 390 y 1366; datos originales sin cambios |
| **P3. Inventarios** ✅ | `03-flujos.md` y `04-paridad.md` completos | Toda ruta, menú y acción con destino; pasos medidos |
| **P4. Prototipo** ✅ | `prototype/` y enlace | Interactivo; 4 pantallas; escritorio y móvil; claro y oscuro; sin clase D |
| **Compuerta** | Presentación al usuario | **Aprobación explícita.** Decidir pendientes |

## Implementación (etapa independiente)

| Fase | Entrega | Aceptación |
|---|---|---|
| 1. Identidad y marco ✅ | Tokens, riel lateral, pestañas, rutas y redirecciones | Toda ruta antigua llega a su destino; `/pair` intacto |
| 2. Mis predios ✅ | Predios con sus áreas primero, resumen de 24 h plegado (el mapa es su propia página) | Todas las áreas visibles sin elegir, incluidas las sin nodo |
| 3. Área ✅ | Ahora, Historial, Detalles | Paridad con dashboard, histórico y exportación; misma consulta de exportación |
| 4. Directorio ✅ | Árbol, panel y altas en contexto | Paridad con las pantallas que sustituye |
| 5. Hoy y Red | Bandeja, equipos, nodos, mapa | `equipos.spec` y emparejamiento en verde |
| 6. Ajustes y Cuenta | Catálogo, Auditoría, perfil | Todo alcanzable |
| 7. Limpieza | Retirar lo reemplazado, documentar | `04-paridad.md` verificado fila por fila |

## En cada fase de implementación

- `npm test -- --run`, `npm run typecheck`, `npm run build`, `npx playwright test`.
- Axe en claro **y** oscuro; línea base sin subir.
- Revisar capturas a 390 y 1366 px, no solo pruebas.
- El diff no toca `backend/`, `services/`, `types/` ni `utils/`.
- Peticiones de cada tarea comparadas con `main`.
- Documentación actualizada en el mismo cambio.

## Criterio global

Las tareas de `01-auditoria.md` se hacen con menos esfuerzo medido; ninguna función se pierde; la lógica sigue intacta; y el resultado **no puede describirse como el mismo diseño con mejores tarjetas**.

## Decisiones pendientes del usuario

Resumen con recomendación en `README.md` («Decisiones que necesitan al usuario»).

2. Pantalla de admin para ver lo que ve un cliente (clase C).
3. «Ver Planes», «Plan Profesional» y «Cambiar Contraseña», que hoy no parecen funcionar.
4. Si «Equipo pendiente» debe verlo el productor.
5. «Hace 1 dia» sin tilde en `utils/datetime.ts`, carpeta protegida.
6. Revisión con Alan: un PR por fase, y destino de las capturas de 8 MB.


## Fase 1 (hecha, 2026-11-01)

- **Tokens** de la identidad A (claro y oscuro) en `theme.css`; Geist y Geist Mono; `prefers-reduced-motion`; se retiró `AnimatedBackground`.
- **Marco:** riel lateral (`DesktopSidebar`), pestañas inferiores con todos los destinos (`MobileTabBar`), `MobileHeader` con el menú de cuenta y `SectionTabs` para Clientes, Red y Ajustes. Ciclos de cultivo **ya tiene enlace** (pestaña de Clientes).
- **Destinos transitorios:** productor = Mis predios (`/cliente/areas`), Área (`/cliente`), Mapa, Historial, Cuenta; admin = Hoy, Clientes, Red, Ajustes. Cada uno aterriza en la pantalla actual más cercana; las fases 2 a 6 las sustituyen.
- **Rutas:** sin cambios (`/pair` y `/admin/gateways/pair` intactos); no hizo falta ninguna redirección nueva porque ninguna ruta se renombró.
- **No cambia:** `backend/`, `services/`, `types/`, `utils/`.
- **Pruebas:** `typecheck`, 162 pruebas unitarias y `build` pasan; se actualizaron `navigation.spec.ts` y `client-dashboard.spec.ts` (no se ejecutaron: escriben en la base local). Capturas de revisión en `audit/results/fase1/`.
- **Conocido para la fase 5:** en `/admin/gateways` el botón «Nuevo equipo» desborda a 390 px; las tarjetas de pantalla siguen con la forma antigua hasta sus fases.


## Fase 2 (hecha, 2026-11-01)

- **`/cliente` es «Mis predios»** (reordenada tras la auditoría `11-auditoria-mis-predios.md`): una línea de estado, una sección por predio con todas sus áreas dentro (problemas marcados en su fila) y el resumen de 24 h plegado al final. **Todas las áreas se ven sin elegir**, incluidas las sin nodo y las sin datos.
- **Mismas llamadas que antes, sin endpoints nuevos:** `/nodes/geo` (qué áreas tienen nodo), `/readings/latest` y `/readings` (24 h, una página de 200) por área. Sondeo de 30 s con pausa si la pestaña está oculta; estado según el umbral de 20 min (`FRESH_MINUTES_THRESHOLD`).
- **El mapa** sigue siendo la página `/cliente/mapa` (pestaña «Mapa»); no comparte pantalla con el resumen.
- **El área tiene dirección propia:** `/cliente/area/:areaId` (transitorio: fija la selección y muestra el dashboard actual hasta la fase 3). La dirección sigue a los selectores del dashboard. Un área inexistente vuelve a `/cliente`.
- **Rutas:** `/cliente/areas` redirige a `/cliente`. `/cliente/predio/:id` se conserva y ahora tiene enlace (el nombre del predio en la lista). Se eliminó `AreaSelector` (sustituido).
- **Navegación del productor:** Mis predios, Mapa, Cuenta (Historial pasó al Área en la fase 3).
- **Reglas del dominio:** un `null` se muestra «—» y nunca cuenta como 0 en promedios; «Atención» es solo problema de datos; «Equipo pendiente» no se muestra al productor (decisión 4 pendiente).
- **Pruebas:** typecheck, 166 unitarias (4 nuevas del estado, resumen y litros) y build pasan; un barrido de capturas con datos reales (claro/oscuro, 1366/390) sin errores de JavaScript ni desborde. `navigation.spec.ts`, `client-dashboard.spec.ts` y `a11y.spec.ts` actualizados, **no ejecutados** (escriben en la base local).
- **Conocido:** con los datos del simulador local la humedad salta de golpe (viene del simulador, no de la gráfica). Las gráficas de móvil se desplazan por dentro y arrancan en lo más reciente.


## Fase 3 (hecha, 2026-11-01)

- **Área con pestañas** en `/cliente/area/:areaId`: **Ahora** (el dashboard actual, sin su saludo ni selectores), **Historial** (el histórico actual, con filtros, ciclo, gráfica, tabla y las descargas CSV, Excel y PDF) y **Detalles** (nuevo: cultivo, tamaño, predio y ubicación, ciclo activo y anteriores con un solo formato `dd/MM/aaaa`, y nodo con serie y GPS). Encabezado con migas (Mis predios › predio › área), nombre, cultivo y tamaño.
- **Misma consulta de exportación:** Historial usa el mismo `GET /readings/export` con los mismos filtros; no se tocó esa lógica. Las llamadas de Ahora e Historial son las mismas que antes.
- **Rutas antiguas:** `/cliente/historico` y `/cliente/exportar` redirigen al Historial del área activa (o a `/cliente` si no hay). Se quitó «Historial» de la navegación del productor; ahora son Mis predios, Mapa y Cuenta.
- **Detalles solo con datos existentes:** `/crop-cycles` y `/nodes/geo`. El estado del equipo se conserva donde estaba (Ahora, junto a la frescura); la decisión 4 sigue pendiente.
- **Transitorio:** `ClientDashboard` y `HistoricalData` aceptan `embedded` para ocultar su encabezado; `ExportData.tsx` queda sin ruta y se retira en la fase 7 junto con sus pruebas.
- **Pruebas:** typecheck, 166 unitarias y build pasan; un barrido de capturas con datos reales (1366 y 390 px) sin errores de JavaScript ni desborde, con un solo `h1` por pantalla y las 3 descargas presentes. `client-dashboard.spec.ts`, `history-export.spec.ts`, `navigation.spec.ts` y `a11y.spec.ts` actualizados, **no ejecutados** (escriben en la base local).


## Fase 4 (hecha, 2026-11-01)

- **Directorio** en `/admin/clientes`: árbol cliente › predio › área (con búsqueda) y, a la derecha, el panel de lo seleccionado. Las altas, ediciones y bajas ocurren en el panel, **sin salir de la pantalla**; el árbol se actualiza solo cuando el panel crea, edita o borra algo.
- **Qué muestra cada selección** (reutiliza las pantallas de gestión existentes, así que la lógica y los formularios no cambian):
  - sin selección: lista de clientes (crear, editar, borrar, buscar);
  - cliente (`/admin/clientes/:id/predios`): sus predios, con enlace a las preferencias del dashboard;
  - predio (`/admin/predios/:id/areas`): sus áreas;
  - **área** (`/admin/areas/:id`, nueva): pestañas Resumen, Ciclos y Nodo, con «Siguiente paso» (sin ciclo → crear ciclo; sin nodo → registrar nodo). Ciclos y Nodo son las pantallas existentes filtradas a esa área y con el área ya elegida.
- **Cómo:** `PageHeader` baja a `h2` dentro del panel (`EmbeddedPanel`); `PropertyManagement`, `IrrigationAreaManagement`, `CropCycleManagement` y `NodeManagement` aceptan un id opcional (sin él se comportan igual que antes). `/admin/ciclos`, `/admin/nodos` y las preferencias del dashboard siguen siendo pantallas propias.
- **Móvil:** sin árbol; se navega con las listas y las migas del panel (dos niveles de la prueba del prototipo).
- **Alta de área + ciclo + nodo sin cambiar de pantalla:** hecho. En el árbol, un triángulo marca las áreas sin nodo o sin ciclo.
- **Conocido:** el panel del cliente no tiene «Editar cliente» propio: se edita en la lista (sin selección). Dentro del panel las tablas conservan su aspecto antiguo hasta la fase 7.
- **Pruebas:** typecheck, 166 unitarias y build pasan; barrido de capturas con datos reales (1366 y 390 px) sin errores de JavaScript, con un solo `h1` por pantalla. `admin-hierarchy.spec.ts` y `navigation.spec.ts` actualizados, **no ejecutados** (escriben en la base local).

## Fase 5 (hecha, 2026-11-01)

- **Hoy** (`/admin`, `h1` «Hoy»): totales (clientes, predios, nodos habilitados, lecturas hoy; siguen refrescándose cada 3 s), **bandeja de Pendientes** y los bloques que ya existían (Nodos deshabilitados, «Nuevo Cliente», «Nuevo Nodo», «Configurar Umbrales», «Ver Auditoría»).
- **Pendientes derivados de datos existentes, sin endpoints nuevos** (`pages/admin/today/pending.ts`, con prueba): áreas sin comunicación (último dato con más de 20 min), sin datos, sin nodo, sin ciclo de cultivo activo, y equipos por vincular (estado distinto de activo y revocado). Ordenados por gravedad; cada fila lleva al lugar donde se resuelve (`/admin/areas/:id?tab=nodo|ciclos` o el detalle del equipo). Son problemas de datos y de configuración, nunca consejos de riego. Se recalculan cada 30 s, pausados con la pestaña oculta.
- **Red** (`/admin/gateways`, `/admin/nodos`, `/admin/mapa`): ya estaban bajo las pestañas Equipos, Nodos y Mapa desde la fase 1; sin cambios de lógica.
- **Desborde de «Nuevo equipo» a 390 px:** causa real, las pantallas de Equipos, detalle de equipo y emparejar no tenían margen propio, así que el botón tocaba los bordes. Ahora llevan `p-4 md:p-8`. `/pair` y `/admin/gateways/pair` no cambian de ruta ni de comportamiento.
- **Pruebas:** typecheck, 168 unitarias y build; barrido de capturas con datos reales (1366 y 390 px) sin errores de JavaScript, sin desborde y con un solo `h1` por pantalla. `navigation.spec.ts` y `auth.spec.ts` actualizados al título «Hoy», **no ejecutados** (escriben en la base local).
- **Conocido:** Equipos, Nodos y Mapa conservan sus tarjetas con radios grandes hasta la fase 7.

## Fase 6 (hecha, 2026-11-01)

- **Ajustes** (`/admin/cultivos` y `/admin/auditoria`) ya estaban bajo las pestañas «Catálogo de cultivos» y «Auditoría» desde la fase 1; no cambia su lógica (CRUD del catálogo, filtros y detalle de la bitácora). Comprobado a 1366 y 390 px: sin desborde, un solo `h1`.
- **Cuenta del productor** (`/cliente/perfil`, `h1` «Cuenta»): perfil con nombre editable y correo bloqueado, y la fecha de última actualización. Mismo endpoint (`/users/me`, GET y PATCH). Se quitó el avatar con degradado.
- **Decisión 3 aplicada con la opción recomendada, reversible:** «Ver Planes», «Plan Profesional» y «Cambiar Contraseña» **ya no se muestran**, porque no hacían nada (como en el prototipo aprobado). Si JP decide otra cosa, se restauran o se implementan aparte. La recuperación de contraseña por correo sigue en el inicio de sesión.
- **Fase 2:** las rutas de alertas, notificaciones y asistente IA conservan su módulo (gate); no se encendió ningún flag.
- **Pruebas:** typecheck, unitarias y build; barrido de capturas con datos reales sin errores de JavaScript. `navigation.spec.ts` actualizado al título «Cuenta», **no ejecutado**.
- **Conocido:** Catálogo y Auditoría conservan tarjetas con radios grandes y botones en píldora hasta la fase 7.

## Fase 7 (hecha, 2026-11-01)

- **Código retirado:** `pages/client/ExportData.tsx` (huérfano desde la fase 3; su función vive en Área › Historial) y las pruebas que solo cubrían esa pantalla (`HistoryExport.test.tsx` conserva las de `HistoricalData`: de 168 a 160 pruebas, por esa razón). Las propiedades `embedded` de `ClientDashboard` y `HistoricalData` **se conservan**: las usa Área.
- **Forma unificada a la identidad A:** todos los radios grandes (`16`, `20`, `24`, `32 px`, `xl`, `2xl`, `3xl`) pasan a `--radius` (4 px) en todo el frontend, incluidos `BentoCard` y `PillButton`; los botones con forma de píldora también. Se conservan las insignias y puntos de estado como píldoras. Las pantallas de Fase 2 (apagadas) heredan el cambio en sus tarjetas; no se tocó su lógica ni sus flags.
- **Paridad (`04-paridad.md`) verificada:** las 38 rutas (productor y admin, incluidas las antiguas `/cliente/historico`, `/cliente/exportar` y `/cliente/areas`, que redirigen) cargan en 1366 y 390 px, sin errores de JavaScript, sin pantallas rotas, sin desborde y con un solo `h1`. Las rutas de Fase 2 (alertas, umbrales, notificaciones, asistente y reportes IA, consumo IA), `/pair` y `/admin/gateways/pair`, recuperar y restablecer contraseña siguen declaradas en `routes.tsx`.
- **Pendiente de decisión de JP (sin cambio):** P10 (área › detalles ya existe), A20 (admin «ver como cliente», clase C), acentos en `utils/datetime.ts`, flujo de PR por fase con Alan. P19 aplicado como recomendado.
- **Pruebas finales:** typecheck, 160 unitarias y build; barrido de 38 rutas. Los e2e están actualizados pero **no se ejecutaron** (escriben en la base local).
- **Falta fuera de código:** autoalojar las fuentes Geist antes de desplegar (hoy vienen de Google Fonts) y revisar la licencia de Esri si se usa satélite.

## Inicio de sesión (rehecho, 2026-11-01)

- **`AuthSplitLayout`** (lo comparten inicio de sesión, «Olvidé mi contraseña» y restablecer) se reacomoda: a pantalla completa, panel izquierdo azul tinta con curvas de nivel decorativas (SVG, `aria-hidden`), titular «Tu riego, predio por predio.» y los tres datos prioritarios con su unidad; a la derecha, el formulario sin tarjeta, alineado a la izquierda y centrado en vertical. En móvil el panel azul se oculta y queda la marca arriba. El botón de tema conserva su `aria-label`.
- **Se retiraron cifras inventadas** del panel anterior («99.9 % Uptime», «144+ lecturas/día», «3 cat.»), que no salían de ningún dato.
- Mismas props y mismo formulario; las 3 pruebas de `LoginPage` pasan. Capturas en `docs/redesign/v2/audit/results/login/` (1366, 900 y 390 px, sin desborde ni errores de JavaScript).

> **Actualización (2026-11-01):** la pantalla Hoy de la fase 5 se reordenó tras la auditoría `16-auditoria-admin-hoy.md` (frase de estado con barra, pendientes agrupados por predio con acción con nombre, totales en una línea, acciones en el encabezado y «Configurar Umbrales» solo con el módulo de alertas activo).
