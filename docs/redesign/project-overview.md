# Visión general del proyecto (estado actual)

Fotografía del frontend en la rama `redesign/ux-ui-overhaul`, partiendo de `main` (`af67be8`). Fuente: lectura de código y recorrido con Playwright (1366, 768 y 390 px) contra el stack local con datos demo. Todo lo que aquí se afirma sale de ese recorrido o del código; lo que no pude comprobar está en `risk-assessment.md` → «Dudas abiertas».

## Stack

React 18, `react-router` 7 (`createBrowserRouter`), Tailwind v4 (CSS-first, tokens en `src/styles/theme.css`), componentes Radix en `components/ui/` (48 archivos), `lucide-react`, `recharts`, `maplibre-gl`, `motion`, `axios`, `react-hook-form`. Tests: Vitest + Playwright (`frontend/e2e/`, con línea base a11y).

Ya existe un sistema de diseño ("Agroindustrial Orgánico", variante Bento) y cuatro rondas de rediseño fusionadas (#59–#62): marco y patrones, dashboard del cliente, histórico/exportación/mapa y páginas de admin. Este análisis parte de ahí.

## Estructura de `frontend/src/app`

| Carpeta | Contenido |
|---|---|
| `routes.tsx` | Todas las rutas; mapas con `lazy` |
| `layouts/` | `RootLayout`, `ClientLayout`, `AdminLayout` (los dos últimos difieren en una sola prop: `autoSelectFirst={false}` en admin) |
| `context/` | `AuthContext`, `SelectionContext` (predio/área activos, persistidos en `localStorage`), `ThemeContext` (`app-ui-theme`) |
| `hooks/` | `useModules`, `useIsMobile`, `usePageVisibility`, `usePropertyGatewayStatus` |
| `services/` | `api.ts` (axios), lecturas, gateways, módulos Fase 2, `useReadingFilters` |
| `utils/` | Presets de fecha, filtros, exportación, gráficas |
| `components/` | Patrones propios (`PageHeader`, `StatusBadge`, `Disclosure`, `FormDialog`, `Field`, `HierarchyTrail`, `Stepper`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `BentoCard`, `PillButton`), `navigation/`, `selection/`, `notifications/`, `maps/` |
| `pages/` | `auth/`, `client/` (+ `dashboard/`), `admin/`, `shared/` |

Tamaño: 39 archivos de página, unas 11 400 líneas. Los más grandes: `GatewayManagement` (837), `ThresholdManagement` (592, Fase 2), `NodeManagement` (560), `AdminMapPage` (532), `AIChatPage` (553, Fase 2), `AlertsCenterPage` (500, Fase 2).

## Rutas y cómo se llega a cada una

### Cliente (`/cliente`, rol `cliente`)

| Ruta | Pantalla | Entrada |
|---|---|---|
| `/cliente` | Dashboard del área activa (Suelo, Riego, Ambiental, clima de referencia, NDVI) | Menú «Dashboard» / «Inicio» (móvil) |
| `/cliente/areas` | «Predios y Áreas de Riego»: tarjetas por área; al tocar una fija el contexto y vuelve al dashboard | Menú «Predios» |
| `/cliente/mapa` | Mapa de nodos | Menú «Mapa» |
| `/cliente/historico` | Filtros, gráfica, tabla y descarga CSV/Excel/PDF | Menú «Histórico» |
| `/cliente/exportar` | Filtros y descarga CSV/Excel/PDF | Menú «Exportar» |
| `/cliente/perfil` | Perfil | Menú «Perfil» |
| `/cliente/predio/:predioId` | Detalle de predio (sensores por área) | **Sin enlace desde ninguna pantalla** (solo la ruta) |
| Fase 2: `alertas`, `alertas/:id`, `reportes-ia`, `reportes-ia/:id`, `asistente-ia`, `notificaciones`, `umbrales` | Dormidas | Menú solo si su módulo está activo; **la ruta abre igualmente por URL** |

### Admin (`/admin`, rol `admin`)

| Ruta | Pantalla | Entrada |
|---|---|---|
| `/admin` | Panel: 4 totales, nodos deshabilitados, acciones rápidas | Menú «Dashboard» |
| `/admin/clientes` | Tabla de clientes (Editar, Predios, Dashboard, Borrar) | Menú «Clientes» |
| `/admin/clientes/:id/predios` | Predios del cliente | Botón «Predios» de la fila |
| `/admin/clientes/:id/dashboard` | Qué tarjetas ve ese cliente | Botón «Dashboard» de la fila |
| `/admin/predios/:id/areas` | Áreas de riego del predio | Botón «Áreas de Riego» de la fila |
| `/admin/cultivos` | Catálogo de cultivos | Menú «Catálogo» |
| `/admin/ciclos` | Ciclos de cultivo | **Sin menú ni enlace**: solo por URL |
| `/admin/nodos`, `/admin/nodos/:id` | Nodos | Menú «Nodos» |
| `/admin/gateways`, `/admin/gateways/:id` | «Equipos»: lista, asistente de 3 pasos (`?nuevo=1`, `?gateway=N`), detalle | Menú «Equipos» |
| `/admin/gateways/pair` | Aprobar o denegar un código de emparejamiento | `/pair?code=…` redirige aquí |
| `/admin/mapa` | Mapa global | Menú «Mapa» |
| `/admin/auditoria` | Bitácora (Fase 2, sin módulo que la oculte) | Menú «Auditoría» |
| Fase 2: `alertas`, `umbrales`, `reportes-ia`, `asistente-ia`, `consumo-ia` | Dormidas | Igual que en cliente |

Públicas: `/` (login), `/recuperar-contrasena`, `/restablecer-contrasena`, `/pair`.

## Navegación

- Escritorio: `DesktopSidebar` (plegable), con perfil, tema y salir al pie.
- Móvil (≤ breakpoint de `useIsMobile`): `MobileTabBar` fija abajo, con desplazamiento horizontal. Contiene los ítems del rol **más** «Tema» y «Salir».
- Los ítems salen de `components/navigation/items.ts`; los de Fase 2 se filtran con `useModules()` (`GET /api/v1/settings/modules`). Con los módulos apagados: cliente 6 ítems, admin 7.
- Contexto predio/área: `SelectionProvider` por layout; cada página lo muestra con `SelectionScopeBar` o con selectores propios.

## Lógica que el rediseño no debe tocar

Servicios, tipos y utilidades; llamadas `api.*` hechas en línea por las páginas (16 archivos de página las contienen); umbral de frescura; `null` frente a `0`; unidades; las 12 variables de telemetría; presets de fecha; formatos de exportación; permisos por rol; intervalos de sondeo (el panel admin consulta cada 3 s); rutas de emparejamiento (`/pair`). Detalle en `risk-assessment.md`.

## Pruebas existentes

`frontend/e2e/`: `navigation`, `auth`, `client-dashboard`, `history-export`, `admin-hierarchy`, `equipos`, `a11y` (+ `a11y-baseline.json`). Varias fijan etiquetas visibles («Descargar CSV», nombres de menú), así que un cambio de etiquetas obliga a actualizarlas en el mismo cambio.
