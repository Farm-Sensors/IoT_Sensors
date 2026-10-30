# Design System: Agroindustrial Orgánico (Variante Bento Box)

> **Fuente de verdad:** `frontend/src/styles/theme.css` (tokens CSS reales). Este documento describe el sistema implementado; si un token cambia en el código, actualizar aquí.

## 1. Filosofía de Diseño

Estética terrosa, elegante y orgánica. Layout estilo **"Bento Box"** (cuadrículas asimétricas) con formas suaves y redondeadas. Alto contraste entre bloques de color sólido, tipografía clásica-moderna (serif para títulos, sans para datos), alejado de interfaces SCADA industriales: artesanal y premium.

**Dual theme:**
- **Light (default):** "Organic Daylight Bento" — base crema cálida, separación por contraste de superficie (no sombras pesadas).
- **Dark:** "Espresso Glass Premium" (Direction B) — superficies charcoal/marrón oscuro con glassmorphism, acentos cálidos. Mapeado semántico desde el sistema light, sin copiar hex exactos.

**Guardrails del dark mode:** sin neón, sin dominancia azulada fría, sin stacks de sombras pesadas, sin cambios de geometría entre modos, contraste de lectura preservado en cards/formularios/tablas.

## 2. Tokens de Color (CSS Variables reales)

### Fondos y Superficies
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#F4F1EB` | `#12100E` | Crema / charcoal. Fondo global. |
| `--bg-surface` | `#F9F8F4` | `#1A1714` | Hueso claro / dark surface. Tarjetas base. |
| `--bg-elevated` | `#FFFFFF` | `#221D18` | Superficie elevada (popovers, elevated cards). |
| `--card-sand` | `#E2D4B7` | `#2C241D` | Arena cálido. Métricas y contenedores de iconos. |
| `--card-dark` | `#3B312B` | `#241D17` | Marrón café. Tarjetas de contraste. |
| `--card-brown` | `#705541` | `#31261E` | Marrón medio. Tarjetas secundarias oscuras. |

### Acentos y Acciones
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--accent-primary` | `#5A6B4C` | `#8CA478` | Verde olivo. Botones primarios, progreso. Con `--text-inverted` encima da ≥ 4.5:1 en claro (antes `#6D7E5E`, 3.88:1). |
| `--accent-gold` | `#A68A61` | `#BDA077` | Marrón dorado. Progreso secundario. |
| `--accent-glow` | `rgba(109,126,94,0.15)` | `rgba(140,164,120,0.16)` | Glow de prioridad (métricas en vivo). |

### Tipografía y Contraste
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#2C2621` | `#ECE6DE` | Marrón casi negro / off-white. Texto principal. |
| `--text-secondary` | `#5C5249` | `#A79B8D` | Marrón grisáceo. Subtítulos y etiquetas; ≥ 4.5:1 también sobre `--card-sand` (antes `#6E6359`, 3.99:1). |
| `--text-inverted` | `#F4F1EB` | `#12100E` | Texto sobre acentos. |

### Estados (status)
| Token | Light | Dark | Uso |
| :--- | :--- | :--- | :--- |
| `--status-active` | `#22C55E` | `#4ADE80` | Verde online / óptimo |
| `--status-warning` | `#F59E0B` | `#FBBF24` | Ámbar warning / riesgo leve |
| `--status-danger` | `#EF4444` | `#F87171` | Rojo error / crítico |
| `--status-info` | `#3B82F6` | `#60A5FA` | Azul info |
| `--status-*-bg` | alpha 0.14–0.16 | alpha 0.2 | Fondos translúcidos de estado |
| `--status-danger-text` | `#B91C1C` | `#FCA5A5` | Texto de acciones destructivas (p. ej. «Revocar enlace»); contraste ≥ 4.5:1 |
| `--status-danger-solid` | `#B91C1C` | `#B91C1C` | **Relleno** con texto blanco: botón destructivo de `ConfirmDialog` y aviso de error de `Toast` (≥ 4.5:1). Igual en ambos temas. |
| `--status-success-solid` | `#15803D` | `#15803D` | **Relleno** con texto blanco: aviso de éxito de `Toast` (≥ 4.5:1). Igual en ambos temas. |

> Nota: no usar `--state-live/warning/critical` — son nombres de un plan anterior que **no existen** en el código.

### Capa semántica (Light = fuente de verdad, Dark mapeada por rol)
`--surface-page`, `--surface-panel`, `--surface-card-primary`, `--surface-card-secondary`, `--text-title`, `--text-body`, `--text-subtle`, `--focus-ring`, `--hover-overlay`, `--pressed-overlay`, `--disabled-opacity`, `--outline-contrast`, `--chart-priority-1/2/3`.

### Bordes y Sombras
| Token | Light | Dark |
| :--- | :--- | :--- |
| `--border-glass` | `rgba(44,38,33,0.06)` | `rgba(236,230,222,0.08)` |
| `--border-subtle` | `rgba(44,38,33,0.04)` | `rgba(236,230,222,0.05)` |
| `--border-strong` | `rgba(44,38,33,0.12)` | `rgba(236,230,222,0.14)` |
| `--shadow-soft` | `0 4px 20px rgba(44,38,33,0.02)` | `0 4px 20px rgba(0,0,0,0.22)` |

## 3. Tipografía

- **Serif (títulos):** `'Playfair Display', serif` (`--font-serif`) — H1–H4, títulos de tarjetas grandes, peso 500.
- **Sans (datos/cuerpo):** `'Inter', sans-serif` (`--font-sans`) — valores numéricos, cuerpo, botones, etiquetas, pesos 400–600.
- **Mono (datos numéricos):** `'JetBrains Mono', monospace` (`--font-mono`) — clase `font-mono-data` con `tabular-nums`.

## 4. Espaciado y Layout (Bento Grid)

- **Bento Grid:** CSS Grid.
- **Gap estándar entre tarjetas:** `1.5rem` (24px).
- **Padding interno de tarjetas:** `1.5rem`–`2rem`.
- **Radio global:** `--radius: 32px` (`--radius-sm/md/lg/xl` derivados).

## 5. UI y Geometría

### Radios de Borde
- **Tarjetas:** `32px` (`rounded-[32px]` / `--radius`).
- **Botones (Pill):** `9999px` (`rounded-full`).

### Sombras y Detalles
- **Sombras:** evitar sombras fuertes; máx. `--shadow-soft` (difusa, imperceptible). Estilo mayormente *flat*.
- **Barras de progreso:** altura `8px` (`h-2`), `rounded-full`; pista `--progress-track` (`#E6E1D8` light / translúcido dark).
- **Glassmorphism adaptativo:** `.glass-card`, `.glass-card-elevated`, `.glass-sidebar` — sombra suave en light, blur+translucidez en dark.

### Estados Interactivos
- **Hover:** `--hover-overlay` (alpha 0.05 light / 0.06 dark) — overlay sutil, no cambio brusco de color.
- **Pressed:** `--pressed-overlay` (alpha 0.1).
- **Disabled:** `--disabled-opacity: 0.5`.
- **Focus:** `--focus-ring` (verde olivo) + `outline-ring/50`.

## 6. Configuración (Tailwind v4 CSS-first)

No existe `tailwind.config.js`. Tailwind v4 se configura en CSS: `@theme inline` en `theme.css` mapea los tokens a utilidades (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-ring`, `--color-chart-1..5`, radios `--radius-sm..xl`, colores de sidebar). Las utilidades Tailwind usan esos mapeos; los tokens raw (`--bg-base`, `--accent-primary`, etc.) se usan directamente en CSS de componentes.

## 7. UX Rules para el dominio (MVP)

1. **Prioridad visual:** `soil.humidity`, `irrigation.flow_per_minute`, `environmental.eto` — las 3 métricas prioritarias tienen el mayor peso visual (cards superiores).
2. **Frescura siempre visible, una vez por área:** indicador de último dato + tiempo transcurrido en el encabezado del dashboard (`FreshnessIndicator`), junto al selector de predio y área. Las tarjetas de métricas no lo repiten. En listas de áreas (`AreaSelector`, `PropertyDetail`) cada tarjeta de área lleva el suyo.
3. **Jerarquía de navegación:** Cliente → Predio → Área de Riego, consistente en toda la app.
4. **Interacciones simples y predecibles:** sin efectos ruidosos; animaciones sutiles (fade-in-up, stagger, glow solo en métricas prioritarias en vivo).

## 8. Patrones de pantalla

Contrato para los cambios de rediseño 2–4 (`openspec/changes/ui-redesign-*`): cada bloque de una
página debe corresponder a uno de estos patrones y usar su componente compartido en vez de HTML
ad-hoc. Referencia de «pantalla enfocada»: `pages/admin/GatewayManagement.tsx` y `GatewayDetail.tsx`
(lista con badges de estado, una acción primaria, detalle tras un disclosure). Vocabulario y reglas
de accesibilidad: `docs/ui-redesign-rules.md` §3–§4.

Todos viven en `frontend/src/app/components/`. Los marcados **(nuevo)** se crearon durante el rediseño de la ronda 1; las páginas de cliente y de admin ya los usan.

| # | Patrón | Componente |
| :--- | :--- | :--- |
| 8.1 | Encabezado de página | `PageHeader` **(nuevo)** |
| 8.2 | Lista de entidades | `BentoCard` (tarjetas) / `ui/table` (tabla) |
| 8.3 | Badge de estado | `StatusBadge` **(nuevo)**; `GatewayStatusBadge` e `IrrigationStatusBadge` (dashboard del cliente) ya lo usan; `EquipoStateBadge` lo usan |
| 8.4 | Datos secundarios / de soporte | `Disclosure` **(nuevo)** |
| 8.5 | Formulario | `FormDialog` + `Field` (en diálogo) o página con `BentoCard` |
| 8.6 | Estados vacío, carga y error | `EmptyState`, `SkeletonCard`, `ErrorState` **(nuevo)** |
| 8.7 | Confirmación de acción destructiva | `ConfirmDialog` |
| 8.9 | Ubicación en la jerarquía | `HierarchyTrail` **(nuevo)** |
| 8.8 | Pasos de un flujo | `Stepper` **(nuevo)**, basado en el asistente de *Equipos* (que lo adopta el cambio 4) |

### 8.1 Encabezado de página
- Un solo `h1` por página, con `tabIndex={-1}` para recibir el foco al cambiar de paso o de ruta.
- Subtítulo opcional de **una línea**. A la derecha, **como máximo una acción primaria** (`PillButton primary`); las demás van como `outline` o dentro de la página.
- Móvil: el título ocupa todo el ancho y la acción pasa debajo, a ancho completo.

### 8.2 Lista de entidades
- **Tarjetas** cuando cada elemento tiene estado, 2–4 datos y una acción (p. ej. equipos, predios). **Tabla** cuando se comparan muchas filas por las mismas columnas (p. ej. histórico, auditoría).
- Cada fila/tarjeta es navegable por teclado y muestra su estado con un badge (8.3), no solo con color.
- Móvil: tablas pasan a tarjetas apiladas o a scroll horizontal **solo dentro de la tabla**, nunca de la página.

### 8.3 Badge de estado
- Siempre **icono + texto + color** (nunca solo color); texto en `--text-main`, fondo `--status-*-bg`, icono `--status-*`.
- Tono: `active` (óptimo), `warning` (riesgo leve), `danger` (crítico), `info` (en proceso), `neutral` (inactivo/revocado).
- El mismo componente en escritorio y móvil; no se oculta el texto en móvil.

### 8.4 Datos secundarios / de soporte
- Todo lo que no ayuda a la tarea principal (IDs, versiones, referencias) va en un disclosure cerrado, titulado «Datos para soporte» o similar, como en `GatewayDetail`.
- Implementado sobre `ui/collapsible`: botón con `aria-expanded`, foco visible, objetivo táctil ≥ 44 px.

### 8.5 Formulario: diálogo o página
- **Diálogo** (`ui/dialog`) para crear/editar con ≤ 5 campos y sin pasos. **Página** para formularios largos o con dependencias entre campos.
- Etiqueta visible en cada campo; error junto al campo y resumen anunciado (`role="alert"`); foco al primer campo inválido al enviar; al cerrar un diálogo el foco vuelve al botón que lo abrió.

### 8.6 Estados vacío, carga y error
- **Vacío:** `EmptyState` con icono, título corto, una línea de ayuda y, si aplica, la acción para salir del vacío.
- **Carga:** `SkeletonCard`/`MetricSkeleton` con la forma del contenido; nunca texto «Cargando…» suelto.
- **Error:** `ErrorState` con mensaje llano, `role="alert"` y botón «Reintentar»; sin trazas ni códigos en el texto principal.

### 8.7 Confirmación de acción destructiva
- `ConfirmDialog variant="danger"`: título con el verbo y el objeto («Revocar enlace»), consecuencia en una línea, foco inicial en **Cancelar**, Escape cierra. El texto del botón destructivo usa `--status-danger-text`.

### 8.5b Formularios del admin
- **`FormDialog`** envuelve el `<form>` de cada alta o edición: diálogo con nombre accesible (su título), foco atrapado, Escape y «Cerrar» lo cierran, el foco vuelve al botón que lo abrió y un clic fuera **no** lo cierra (no se pierde lo escrito).
- **`Field`** asocia la etiqueta visible con su control (`input`, `select`, `textarea`); `FIELD_INPUT_CLASS` da el estilo común con 44 px de alto.
- **Borrar:** siempre `ConfirmDialog` que nombra la entidad («¿Eliminar el predio X?») con «Esta acción no se puede deshacer.»; ya no se usa `window.confirm`.

### 8.9 Ubicación en la jerarquía
`HierarchyTrail` es un `nav` de migas con **nombres, no IDs**, en las páginas que dependen de otra: Clientes → cliente → predio → áreas (`/admin/clientes/:id/predios`, `/admin/predios/:id/areas`), el dashboard de un cliente y el detalle de un nodo. El último elemento es el lugar actual; los demás son enlaces cuando existe la ruta.

### 8.8 Pasos de un flujo
- Lista ordenada (`<ol aria-label="Pasos">`) con `aria-current="step"` en el paso actual y texto «Paso N de M»; al avanzar, el foco pasa al encabezado del paso.
- Móvil: una columna; los pasos completados se resumen en una línea.

### Marco de la app (login, navegación, layouts)
- **Login:** `AuthSplitLayout` muestra el título del formulario como único `h1` (el panel decorativo usa `p`, porque se oculta bajo 1024 px). Tras un error, `LoginPage` lo anuncia (`role="alert"`, `aria-describedby` en ambos campos) y mueve el foco al primer campo a revisar: el correo si está vacío, si no la contraseña.
- **Navegación:** `DesktopSidebar` y `MobileTabBar` son `nav` con nombre «Navegación principal». La página actual lleva `aria-current="page"` **y** una barra indicadora (lateral en escritorio, superior en móvil) además del relleno de color; en móvil la entrada actual se desplaza a la vista.
- **Saltar al contenido:** `SkipLink` es el primer elemento enfocable de `AdminLayout` y `ClientLayout`; lleva el foco al `main#contenido`.
- **Objetivos táctiles:** botones y enlaces del marco miden ≥ 44 px (`PillButton` tiene `min-h-[44px]`).
- **Diálogo de confirmación:** `ConfirmDialog` devuelve el foco al elemento que lo abrió y asocia la consecuencia con `aria-describedby`.

### Filtros, exportación y mapa (cliente)
- **Filtros visibles:** `ReadingDateRangeSelector` muestra siempre un bloque «Filtros activos» (rango rápido, fechas resueltas y ciclo de cultivo) justo encima de los resultados; el rango elegido lleva `aria-pressed` y un icono de check, no solo color. El significado de los filtros (presets de `QUICK_RANGES` + «Personalizado», ciclo, fechas en UTC) no cambia.
- **Series de una gráfica:** conmutadores (`aria-pressed`) con muestra de color, borde e icono de check cuando están activos; la leyenda de la gráfica usa `--text-body` (el color de la serie solo va en la línea y en la muestra).
- **Tablas anchas:** `caption` para lectores de pantalla, primera columna fija y la pista «Desliza hacia los lados…» en móvil; el scroll horizontal queda dentro de la tabla.
- **Exportar:** dos pasos, «1. Elige qué datos» y «2. Descarga». Antes de descargar, un resumen en una línea (área, fechas, ciclo); los tres formatos (CSV, Excel, PDF) son acciones separadas «Descargar …» que bajan el archivo al instante. La consulta es la misma que usa el histórico.
- **Mapa:** la leyenda usa `StatusBadge` (icono + texto + conteo). Los marcadores del mapa se distinguen solo por color, así que la lista «Nodos en el mapa» ofrece la misma información en texto y abre el detalle del nodo.

### Variantes móviles (390 px)
Una columna, sin scroll horizontal de la página, objetivos táctiles ≥ 44×44 px, acción primaria a ancho completo, barra de pestañas con todas las entradas alcanzables.

## 9. Referencia del diseño original

- Figma: https://www.figma.com/design/oC6tGH2eDH091njUEnkRPk/IoT-Agricultural-Irrigation-App