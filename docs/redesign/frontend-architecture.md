# Arquitectura frontend recomendada

**Conclusión:** la organización actual permite implementar el rediseño. No hace falta reescribir ni reorganizar por completo; bastan cinco piezas nuevas y refactors incrementales de los archivos grandes. Sin dependencias nuevas.

## Lo que ya está bien (no se toca)

Separación `services/` · `utils/` · `context/` · `components/` · `pages/`; patrones propios (`PageHeader`, `StatusBadge`, `FormDialog`, `Field`, `HierarchyTrail`, `Disclosure`, `Stepper`, `ConfirmDialog`, `EmptyState`, `ErrorState`); tokens en `theme.css`; `items.ts` como fuente única de ítems de menú para escritorio y móvil; `lazy` en mapas; pruebas colocadas junto a los componentes.

## Problemas técnicos que condicionan el rediseño

| # | Problema | Evidencia | Efecto |
|---|---|---|---|
| T1 | `ClientLayout` y `AdminLayout` son casi idénticos | Difieren en `autoSelectFirst={false}` y en el rol | Cambiar el marco exige editar dos archivos |
| T2 | El selector de contexto está implementado por página | `SelectionScopeBar` en unas, selectores propios en otras | N6 |
| T3 | Dos dashboards de cliente paralelos | `DesktopDashboard` 341 + `MobileDashboard` 238 líneas | Un cambio visual probablemente se aplica en ambos (no comparé el código línea a línea) |
| T4 | Tablas con markup propio en cada página admin | Clientes, Predios, Áreas, Nodos, Ciclos, Cultivos | U1 se repite 6 veces |
| T5 | Archivos grandes con varias responsabilidades | `GatewayManagement` 837, `NodeManagement` 560, `AdminMapPage` 532 | Difíciles de revisar y de probar |
| T6 | Llamadas `api.*` dentro de las páginas | 16 archivos | Cualquier extracción debe dejarlas **idénticas** |
| T7 | `any` y estado local en el panel admin | `AdminDashboard` usa `any[]` | Fuera de alcance; solo se anota |

## Piezas nuevas (todas presentacionales)

| Pieza | Ubicación | Qué hace | Resuelve |
|---|---|---|---|
| `AppShell` | `layouts/AppShell.tsx` | Marco común (barra lateral o pestañas, `SkipLink`, `main`); `ClientLayout` y `AdminLayout` pasan a ser envoltorios de 5 líneas con su rol y su `SelectionProvider` | T1 |
| `ContextSwitcher` | `components/selection/` | Selector Predio › Área en el encabezado; lee `SelectionContext`, sin lógica nueva | T2, N6 |
| `ResponsiveTable` + `RowActions` | `components/` | Tabla con una acción principal y menú «⋯», tarjetas bajo 768 px; recibe columnas y filas por props | T4, U1 |
| `PageToolbar` | `components/` | Búsqueda, filtros y vista bajo el encabezado | Esqueleto único |
| `MoreSheet` | `components/navigation/` | Hoja inferior de la pestaña «Más»/«Cuenta»; reutiliza `ui/` (Radix `dialog`/`vaul` ya instalados) | N1 |

Menú de usuario con avatar: sobre `ui/dropdown-menu`, ya existente.

## Refactors incrementales

- **T3 (hecho en la etapa 7, ver `implementation-roadmap.md`):** extraer lo común de los dos dashboards a `dashboard/` (hooks de datos y subcomponentes por tarjeta) y dejar a cada vista solo su disposición. Sin tocar `readings.ts` ni `helpers.ts`, que contienen reglas de negocio.
- **T5 (hecho en la etapa 7):** dividir `GatewayManagement` por pasos del asistente (`GatewayList`, `WizardStep1…3`), moviendo código sin cambiarlo. Es la única división recomendada; las demás solo si una etapa las toca.
- **Estados visuales:** un único hook `useFreshnessState` **no** se propone: la regla de frescura es lógica y vive donde está. Solo se lee su resultado.

## Estilos

Tokens ya centralizados. Regla nueva: las tarjetas tienen dos variantes (métrica y agrupación) en `BentoCard` (que ya acepta `variant`); los avisos son banners en línea, no tarjetas y no se vuelven a escribir clases a mano. Sin CSS adicional por página.

## Estructura de carpetas

Se mantiene `pages/<rol>/`. No se migra a carpetas por funcionalidad: el costo de mover 39 páginas (imports, diffs enormes de revisión) no compensa. Solo se añade `components/selection/ContextSwitcher.tsx` y `layouts/AppShell.tsx`.

## Pruebas

Cada pieza nueva con prueba colocada (convención del repo). Las e2e que fijan etiquetas de menú o «Descargar …» se actualizan en el mismo cambio. Las pruebas de comportamiento no se borran.
