# Inventario de Git y plan de reversión de v1

Generado de `git status` y `git diff` el 2026-10-31.

## Resultado de la reversión (EJECUTADA el 2026-10-31, autorizada por el usuario)

- **Antes:** el estado real coincidía con el inventario (95 de 95 entradas; 69 archivos +1607/−1966). Ningún archivo mezclaba v1 con otro trabajo, así que no hubo nada que conservar de la implementación.
- **Respaldo (fuera del repo):** `/Users/jp-dlg/Backups/iot-sensors-v1-20261031-231902`: `v1-tracked.patch` (diff binario contra `af67be8`), `untracked-files.tar.gz` (todo lo sin seguimiento, incluida `docs/redesign/`), `modified-files-fullcopy.tar.gz`, listas y `SHA256SUMS`. **Recuperación verificada:** `git archive af67be8` + `git apply --binary` del parche + extraer el tar reproduce `frontend/`, `openspec/` y `docs/` idénticos al árbol previo.
- **Cómo:** `git restore --source=af67be8 --staged --worktree -- frontend openspec docs/README.md docs/architecture/frontend.md docs/design-system.md docs/ui-redesign-rules.md`, y `rm` archivo por archivo de los 31 sin seguimiento de `frontend/` (lista del respaldo) más `rmdir` de la carpeta vacía. Sin `git reset --hard`, sin `git clean`, sin cambiar de rama, sin commits ni push.
- **Después:** `git diff af67be8 -- . ':!docs/redesign'` vacío; único elemento sin seguimiento: `docs/redesign/`. Rama `redesign/ux-ui-overhaul`, 0 commits propios. Backend y base de datos no se tocaron. `npm run typecheck`, `npm test -- --run` (34 archivos, 159 pruebas) y `npm run build` pasan.
- **No ejecutado:** `npx playwright test`: crea datos en la base del stack local; no se corrió para no modificarla. Se espera el estado de `main` (a11y: 42 pasan, 6 fallan, 6 omitidas).
- **Único cambio añadido:** una fila en `docs/README.md` que enlaza `redesign/README.md`.
- **Para deshacer:** aplicar `v1-tracked.patch` y extraer `untracked-files.tar.gz` sobre el árbol.

*Lo que sigue es el plan original, conservado como referencia.*

## Estado

- Rama `redesign/ux-ui-overhaul`, en el mismo commit que `main`: `af67be8`. Tiene 0 commits propios y 0 stashes.
- Por eso **todo lo pendiente es el rediseño v1 y su documentación**. Los rediseños #59-#62 están fusionados en `main` y no son parte de esto.
- `git status` da **95 entradas**: 68 modificadas, 1 borrada y 26 sin seguimiento. Las 26 son carpetas o archivos sueltos: al expandirlas (`git status -uall`) son **127 archivos sin seguimiento**: 96 bajo `docs/redesign/` (9 son las guías `v2/*.md` de la sesión de planificación) y 31 en `frontend/`. **Sin las guías v2 son 118.** *Corrección:* el documento decía 117 sin las guías y 86 en `docs/redesign/`; el recuento real es 118 y 87 (96 − 9). La suma 118 + 9 = 127 sí coincide con lo que dio el usuario.
- Diff de archivos con seguimiento frente a `af67be8`: 69 archivos, +1607/-1966. **Re-medido el 2026-10-31 al cerrar la preparación: idéntico.** La sesión de auditoría y prototipo no modificó ningún archivo con seguimiento.
- Esta sesión añadió **solo archivos sin seguimiento** bajo `docs/redesign/` (`v2/audit/`, `v2/prototype/` y actualizaciones de las guías `v2/*.md` y de `README.md`). Se conservan al revertir. Los 127 y los 95 de arriba se midieron **antes** de añadirlos.
- Verificado: la lista de «Inventario por entrada» coincide exactamente (95 de 95) con `git status --short`.

## Plan de reversión (pendiente de autorización)

Objetivo: dejar `frontend/`, `openspec/` y los documentos con seguimiento como en `af67be8`, conservando `docs/redesign/`.

1. Confirmar el estado: `git status --short` y que la rama siga en `af67be8`.
2. Respaldo **fuera del repo**: `git diff --binary af67be8 > <respaldo>/v1-tracked.patch` y un `tar` de los archivos sin seguimiento de `frontend/`.
3. Restaurar lo que tiene seguimiento, sin tocar `docs/redesign/`: `git restore --source=af67be8 --staged --worktree -- frontend openspec docs/README.md docs/architecture/frontend.md docs/design-system.md docs/ui-redesign-rules.md`.
4. Listar antes de borrar: `git clean -nd -- frontend`. Revisar la salida y solo entonces `git clean -fd -- frontend`. **Nunca** `git clean` en la raíz ni sobre `docs/`.
5. Comprobar: `git diff --stat af67be8 -- frontend openspec` vacío y `docs/redesign/` intacto.
6. `npm test -- --run`, `npm run typecheck`, `npm run build`, `npx playwright test`.
7. Volver a enlazar `docs/redesign/` en `docs/README.md`.

**Vuelta atrás:** aplicar `v1-tracked.patch` y extraer el `tar`.

**Resultado esperado al volver a `main`:** el suite a11y de `main` tenía 6 fallos (42 pasan, 6 fallan, 6 omitidas). Una animación infinita (`rippleExpand`) impide medir `/cliente/areas` y `/admin/nodos/:id`, y `/cliente` falló igual sin confirmar la causa. **No es una regresión de la reversión.** La versión con v1 daba 114 pasan, 12 omitidas, 0 fallan.

## Mezclas e ideas de v1

Ningún archivo mezcla v1 con otro trabajo: todo lo pendiente es v1. Lo siguiente **se revierte igual**, pero conviene volver a implementarlo en v2 porque corrige defectos, no porque sea diseño de v1:

| Idea | Por qué |
|---|---|
| Quitar pulsos infinitos y añadir `prefers-reduced-motion` | Accesibilidad; permite medir a11y |
| Contraste de la pestaña activa y de los textos de la barra lateral | La línea base bajó de 93 a 18 violaciones con v1 |
| Formato único de fecha del ciclo `dd/MM/aaaa` | Había tres formatos del mismo dato |
| Objetivos táctiles del mapa de 44 px | Marcadores de 16 px y controles de 29 px |
| Técnica de comparación de DOM de `s7` (grabar API, capturar antes y después a la vez) | Sirve para demostrar que un refactor no cambia nada; los scripts vivían en una carpeta temporal y deben reescribirse |

## Pendiente de decidir por el usuario

`docs/README.md`: se restaura y se añade solo el enlace a `docs/redesign/README.md`.

## Inventario por entrada

| Archivo o carpeta | Estado | Líneas | Acción propuesta |
|---|---|---|---|
| `docs/README.md` | M | +1/-0 | Decidir: restaurar y volver a enlazar `docs/redesign/` |
| `docs/architecture/frontend.md` | M | +12/-4 | Restaurar desde `af67be8` |
| `docs/design-system.md` | M | +39/-11 | Restaurar desde `af67be8` |
| `docs/ui-redesign-rules.md` | M | +3/-2 | Restaurar desde `af67be8` |
| `frontend/e2e/a11y-baseline.json` | M | +36/-122 | Restaurar desde `af67be8` |
| `frontend/e2e/a11y.spec.ts` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/e2e/admin-hierarchy.spec.ts` | M | +33/-0 | Restaurar desde `af67be8` |
| `frontend/e2e/client-dashboard.spec.ts` | M | +85/-1 | Restaurar desde `af67be8` |
| `frontend/e2e/history-export.spec.ts` | M | +26/-15 | Restaurar desde `af67be8` |
| `frontend/e2e/navigation.spec.ts` | M | +98/-27 | Restaurar desde `af67be8` |
| `frontend/playwright.config.ts` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/AnimatedBackground.tsx` | D | +0/-26 | Restaurar desde `af67be8` |
| `frontend/src/app/components/BentoCard.test.tsx` | M | +28/-8 | Restaurar desde `af67be8` |
| `frontend/src/app/components/BentoCard.tsx` | M | +26/-7 | Restaurar desde `af67be8` |
| `frontend/src/app/components/ChartSkeleton.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/ConfirmDialog.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/EmptyState.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/ErrorState.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/Field.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/FormDialog.tsx` | M | +2/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/components/FreshnessIndicator.tsx` | M | +0/-11 | Restaurar desde `af67be8` |
| `frontend/src/app/components/MetricCard.tsx` | M | +27/-10 | Restaurar desde `af67be8` |
| `frontend/src/app/components/MetricSkeleton.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/PageTransition.tsx` | M | +3/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/components/PairingApprovalPanel.tsx` | M | +3/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/components/ReadingDateRangeSelector.tsx` | M | +14/-13 | Restaurar desde `af67be8` |
| `frontend/src/app/components/SkeletonCard.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/auth/AuthSplitLayout.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/components/maps/mapHelpers.ts` | M | +3/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/components/navigation/DesktopSidebar.tsx` | M | +64/-46 | Restaurar desde `af67be8` |
| `frontend/src/app/components/navigation/MobileTabBar.tsx` | M | +70/-86 | Restaurar desde `af67be8` |
| `frontend/src/app/components/navigation/items.ts` | M | +82/-26 | Restaurar desde `af67be8` |
| `frontend/src/app/components/navigation/navigation.test.tsx` | M | +147/-12 | Restaurar desde `af67be8` |
| `frontend/src/app/components/selection/SelectionScopeBar.tsx` | M | +2/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/layouts/AdminLayout.tsx` | M | +2/-42 | Restaurar desde `af67be8` |
| `frontend/src/app/layouts/ClientLayout.tsx` | M | +2/-42 | Restaurar desde `af67be8` |
| `frontend/src/app/layouts/RootLayout.tsx` | M | +0/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/layouts/layouts.test.tsx` | M | +21/-0 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/AdminDashboard.tsx` | M | +84/-94 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/AdminMapPage.tsx` | M | +2/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/ClientManagement.tsx` | M | +48/-133 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/CropCycleManagement.test.tsx` | M | +13/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/CropCycleManagement.tsx` | M | +17/-16 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/CropTypeManagement.tsx` | M | +6/-6 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/DashboardPreferences.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/GatewayManagement.tsx` | M | +70/-469 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/IrrigationAreaManagement.test.tsx` | M | +23/-0 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/IrrigationAreaManagement.tsx` | M | +44/-99 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/NodeDetail.tsx` | M | +13/-13 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/NodeManagement.test.tsx` | M | +15/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/NodeManagement.tsx` | M | +93/-95 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/PropertyManagement.test.tsx` | M | +9/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/admin/PropertyManagement.tsx` | M | +25/-87 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/auth/LoginPage.tsx` | M | +3/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/AreaSelector.tsx` | M | +2/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/ClientDashboard.tsx` | M | +2/-45 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/ClientMapPage.tsx` | M | +2/-2 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/ExportData.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/HistoricalData.tsx` | M | +19/-18 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/HistoryExport.test.tsx` | M | +6/-6 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/ProfilePage.tsx` | M | +1/-1 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/PropertyDetail.tsx` | M | +3/-3 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/dashboard/Dashboard.test.tsx` | M | +80/-7 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/dashboard/DesktopDashboard.tsx` | M | +60/-160 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/dashboard/MobileDashboard.tsx` | M | +37/-107 | Restaurar desde `af67be8` |
| `frontend/src/app/pages/client/dashboard/helpers.ts` | M | +4/-4 | Restaurar desde `af67be8` |
| `frontend/src/app/routes.tsx` | M | +2/-2 | Restaurar desde `af67be8` |
| `frontend/src/styles/theme.css` | M | +79/-42 | Restaurar desde `af67be8` |
| `openspec/specs/history-export/spec.md` | M | +4/-3 | Restaurar desde `af67be8` |
| `docs/redesign/` | ?? | +—/-— | Conservar (evidencia de v1, no es implementación) |
| `frontend/e2e/admin-panel.spec.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/e2e/admin-tables.spec.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/e2e/visual-rules.spec.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/MetricCard.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/ResponsiveTable.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/ResponsiveTable.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/cycleLabel.test.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/cycleLabel.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/navigation/MoreSheet.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/navigation/items.test.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/selection/ContextSwitcher.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/components/selection/ContextSwitcher.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/hooks/useOpenFromQuery.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/hooks/useOpenFromQuery.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/layouts/AppShell.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/admin/AdminDashboard.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/admin/ClientManagement.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/admin/gateways/` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/IrrigationStatusCard.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/PrioritySemaphore.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/SoilReading.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/dashboardShared.test.tsx` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/fields.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/status.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
| `frontend/src/app/pages/client/dashboard/types.ts` | ?? | +—/-— | Eliminar (código nuevo de v1) |
