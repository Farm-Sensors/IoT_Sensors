# Design System: Agroindustrial Orgánico (Variante Bento Box)

> **Fuente de verdad:** `frontend/src/styles/theme.css` (tokens CSS reales). Este documento describe el sistema implementado; si un token cambia en el código, actualizar aquí.

## 1. Filosofía de Diseño

Estética terrosa, elegante y orgánica. Layout estilo **"Bento Box"** (cuadrículas asimétricas) con formas suaves y redondeadas. Alto contraste entre bloques de color sólido, tipografía clásica-moderna (serif para títulos, sans para datos), alejado de interfaces SCADA industriales: artesanal y premium.

**Dual theme:**
- **Light (default):** identidad provisional **«Sensores Agrícolas»** (`docs/brand/`, sobre la estructura de «Levantamiento»: líneas finas, radio de 4 px) — neutros con un matiz verdoso y un solo acento verde bosque. Referencia visual: `docs/redesign/v2/prototype-a/`.
- **Dark:** mismos tokens semánticos con superficies carbón frío y acento verde claro `#81C784` (derivado; el paquete de marca no define versión oscura).
- **Estado de la migración:** completa (fase 7). Todas las pantallas usan los tokens, el marco y el radio `4px` de la identidad A; `BentoCard` y `PillButton` se conservan como componentes, pero con esa forma. Las insignias de estado (`StatusBadge`, semáforo) siguen siendo píldoras.

**Guardrails del dark mode:** sin neón, sin dominancia azulada fría, sin stacks de sombras pesadas, sin cambios de geometría entre modos, contraste de lectura preservado en cards/formularios/tablas.

## 2. Tokens de Color (CSS Variables reales)

### Fondos y Superficies
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#EFF1F3` | `#0F1214` | Gris frío / carbón. Fondo global. |
| `--bg-surface` | `#F7F8F9` | `#161A1D` | Superficie base. Tarjetas. |
| `--bg-elevated` | `#FFFFFF` | `#1E2327` | Superficie elevada (popovers, elevated cards). |
| `--card-sand` | `#E5E8EA` | `#1E2327` | Gris neutro. Métricas y contenedores de iconos. |
| `--card-dark` | `#1B2A44` | `#101A2B` | Azul noche. Tarjetas de contraste. |
| `--card-brown` | `#3D4852` | `#232B31` | Gris pizarra. Tarjetas secundarias oscuras. |

### Acentos y Acciones
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--accent-primary` | `#00450D` | `#81C784` | Verde bosque (`--brand-forest`), **único acento**. Botones primarios, progreso, navegación actual. |
| `--accent-gold` | `#4F6B55` | `#A3BBA8` | Verde grisáceo. Progreso secundario. |
| `--accent-soft` | `#E8F5E9` | `#1F3D25` | Relleno suave de verde: destino actual en pestañas, encabezados de tabla y fila bajo el cursor. |
| `--accent-glow` | `rgba(27,58,100,0.12)` | `rgba(169,193,238,0.16)` | Glow de prioridad (métricas en vivo). |

### Tipografía y Contraste
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#12261A` | `#E6EDE6` | Texto principal (verde muy oscuro, no gris azulado). |
| `--text-secondary` | `#3F5A45` | `#A3BBA8` | Subtítulos y etiquetas. |
| `--text-inverted` | `#FFFFFF` | `#0B1A30` | Texto sobre acentos. |

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
| `--shadow-soft` | `0 1px 2px rgba(19,24,29,0.06)` | `0 1px 2px rgba(0,0,0,0.4)` |

## 3. Tipografía

- **Títulos:** `'Plus Jakarta Sans'` (`--font-serif`, nombre heredado: ya no es serif) — H1–H4, peso 500.
- **Texto y datos:** `'Plus Jakarta Sans'` (`--font-sans`) — cuerpo, botones, etiquetas, pesos 400–600.
- **Mono (solo cifras):** `'Geist Mono'` (`--font-mono`) — clase `font-mono-data` con `tabular-nums`. Las fuentes (Plus Jakarta Sans y Geist Mono, variables, subconjuntos latino y latino extendido) están **alojadas en el repo** (`frontend/public/fonts/`, declaradas en `styles/fonts.css`): la app no depende de Google Fonts y funciona sin conexión.

## 4. Espaciado y Layout (Bento Grid)

- **Bento Grid:** CSS Grid.
- **Gap estándar entre tarjetas:** `1.5rem` (24px).
- **Padding interno de tarjetas:** `1.5rem`–`2rem`.
- **Radio global:** `--radius: 32px` (`--radius-sm/md/lg/xl` derivados).

## 5. UI y Geometría

### Radios de Borde
- **Tarjetas:** `4px` (`--radius`; `BentoCard` y los paneles).
- **Botones (`PillButton`, enlaces-botón):** `4px` (`--radius`). Solo insignias y puntos de estado usan `rounded-full`.

### Sombras y Detalles
- **Sombras:** evitar sombras fuertes; máx. `--shadow-soft` (difusa, imperceptible). Estilo mayormente *flat*.
- **Barras de progreso:** altura `8px` (`h-2`), `rounded-full`; pista `--progress-track` (`#E6E1D8` light / translúcido dark).
- **Glassmorphism adaptativo:** `.glass-card`, `.glass-card-elevated`, `.glass-sidebar` — sombra suave en light, blur+translucidez en dark.

### Estados Interactivos
- **Hover:** `--hover-overlay` (alpha 0.05 light / 0.06 dark) — overlay sutil, no cambio brusco de color.
- **Pressed:** `--pressed-overlay` (alpha 0.1).
- **Disabled:** `--disabled-opacity: 0.5`.
- **Focus:** `--focus-ring` (verde bosque) + `outline-ring/50`.

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
- **Navegación:** `DesktopSidebar` (riel lateral fijo de 208 px, escritorio) y `MobileTabBar` (pestañas inferiores con todos los destinos, móvil) son `nav` con nombre «Navegación principal». En móvil, `MobileHeader` aloja la marca y el menú de cuenta (tema y cerrar sesión). La página actual lleva `aria-current="page"`, fondo `--accent-soft` y **negrita** (indicador que no depende del color; en móvil además una barra superior). `SectionTabs` (solo admin) muestra las pestañas de Clientes, Red y Ajustes. Fuente única de destinos y secciones: `components/navigation/items.ts`.
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
## Movimiento

`@media (prefers-reduced-motion: reduce)` (en `theme.css`) apaga animaciones y transiciones, incluidas las infinitas. Se retiró `AnimatedBackground` (fondo animado del layout raíz).


## Identidad provisional «Sensores Agrícolas» (2026-11-01)

Paquete de marca en `docs/brand/` (brief, guía visual, instrucciones y SVG). **Nombre e identidad provisionales**, no una decisión comercial definitiva. Aplicada solo en presentación:
- **Tokens** en `styles/theme.css`: `--brand-forest #00450D`, `--brand-green #2E7D32`, `--brand-lime #8BC34A` (solo acentos, nunca texto pequeño sobre blanco: 2,1:1), `--brand-mist #E8F5E9`; texto `#1F2937`. Los estados semánticos (rojo, ámbar, azul de información, verde de «en línea») no cambian.
- **Logo:** `frontend/public/brand/` (símbolo, logo, favicon, app icon). Componente `components/BrandSymbol.tsx` (versión clara u oscura según el tema). Se usa en el riel lateral, el encabezado móvil, la carga y el login; el eslogan «Tecnología que impulsa el campo.» solo aparece en el login. `index.html`: favicon, `apple-touch-icon` y `theme-color`.
- **Contrastes medidos:** texto blanco sobre verde bosque 11,3:1; acento sobre superficie en oscuro 8,8:1; texto sobre acento en oscuro 8,6:1; gris de apoyo 7,1–8,0:1.
- **Ajuste tras revisión (2026-11-01):** símbolo más grande en la navegación (40 px en el riel, 36 px en el encabezado móvil; el nombre pasa a dos líneas como en el logo), ondas del login más tenues, y texto de estados con tokens propios `--status-active-text` (`#166534`), `--status-warning-text` (`#92400E`) e `--status-info-text` (`#1D4ED8`) en claro (≥4,5:1 también sobre su fondo tintado); los colores base de estado quedan solo para puntos y rellenos. Los textos verdes pequeños de la marca (`#00450D`) ya medían 10:1.
- **Login (2026-11-01):** el panel verde profundo (`#00450D`, con las ondas decorativas muy tenues) lleva una ilustración a color donde el foco es el panel solar: panel azul oscuro con marco y cuadrícula finos en marfil (`#E8F5E9`) sobre un poste blanco con trípode y una caja del tamaño de una de fusibles; señales en arcos lima (`#8BC34A`, con menos brillo) inclinados a los lados, fuera del panel y de las plantas; un sol pequeño, disco relleno en dorado apagado (`#C9A24B`) con ocho rayos cortos; tres plantas de tamaños distintos de solo contorno; y tierra con las dos franjas curvas originales a opacidad reducida. Los sensores van enterrados y no se dibujan. Misma ilustración en escritorio y móvil (sobre el formulario). El saludo del título cambia en cada visita (`loginGreetings` en `LoginPage.tsx`; el primero depende de la hora). Al abrir la página la ilustración se dibuja por partes y la señal late despacio, cada 6 s (`auth-*` en `theme.css`; con `prefers-reduced-motion` se muestra el estado final). Logo del encabezado de 96 px en escritorio y 56 px en móvil.

## Identidad verde en el interior (2026-11-05)

El interior se sentía frío: texto gris azulado, fondos casi blancos y verde solo en botones. Ajuste de presentación, sin cambiar estructura:
- **Tema claro tintado de verde:** texto `#12261A` y secundario `#3F5A45` (antes slate `#1F2937` / `#47525B`); bordes `#D3DCCF` y sombras con base `0,69,13`; fondo de página `#F3F6F1`, superficie y tarjetas blancas con borde `--border` definido (radio 4 px, sin sombras; antes la superficie `#F8FAF6` casi no se distinguía del fondo). Se probó teñir las superficies de menta y se descartó: era lo mismo con otro color; el contraste lo dan la jerarquía y el riel de estado, no el relleno.
- **Menú lateral en verde bosque:** `--sidebar` `#00450D` con texto marfil (`#E8F5E9`), activo en blanco translúcido con realce lima a la izquierda (`--sidebar-primary` `#8BC34A`), borde `rgba(255,255,255,.14)`. Lo usan el riel de escritorio, la cabecera móvil y la barra inferior (logo en su versión clara). En el tema oscuro el menú es `#0A2A12`.
- **Jerarquía en tablas y listas** (`theme.css`, final): `thead th` con `--accent-soft` y texto `--accent-green`; filas de `divide-y` y `tbody tr` al pasar el cursor con `--accent-soft`; clase `.group-title` (texto verde de marca y marca lima a la izquierda) para títulos de grupo (nodos por predio, predios en Mis predios).
- **Bloque verde de dato principal** (`components/FocusBlock.tsx` + `.focus-block` en `theme.css`): un solo bloque verde bosque por pantalla con la cifra que resume la pantalla (Inicio: áreas al día; Equipos: equipos funcionando; Clientes: áreas sin comunicación; Alertas: sin leer; Detalles: día del ciclo; Cuenta; primer indicador de Consumo; Mis predios: áreas al día; Umbrales: activos). En el productor, la franja de tres cifras del predio, los datos prioritarios de «Ahora» y el interruptor de avisos son el propio bloque (`.focus-block` aplicado al contenedor existente), y las tarjetas de área del predio llevan riel de estado. `.focus-block` reasigna `--text-main`, `--text-muted`, `--border`, `--progress-track` y el acento para que el contenido existente se lea dentro; en oscuro es `#0B2814` con borde. El resto sigue en tarjetas blancas rectas.
- **«Otras mediciones» en «Ahora»:** dos grupos (Suelo, Ambiental) con cabecera `--accent-soft` y marca lima (`.group-title`), y cada medición como celda (etiqueta pequeña y cifra en verde de marca) separada por líneas finas, en lugar de filas de texto con línea gris.
- **Riel de estado en las listas** (`data-tone` + `theme.css`): barra de 4 px a la izquierda de cada fila — verde (al día / ciclo activo), rojo (sin comunicación / sin ciclo activo) o gris (por configurar). En Clientes, Predios, Áreas, Nodos, Equipos (funcionando / sin datos recientes / asignando nodos en azul / por vincular) y Ciclos de cultivo. Sin color de relleno: el estado se lee de un vistazo y las tarjetas siguen siendo rectas y blancas (variante «B · riel de estado» elegida el 2026-11-05).
- **Cifras clave en verde:** valor de las tarjetas de Inicio (con borde izquierdo verde) y de los datos prioritarios de «Ahora» (franja superior verde). La gráfica de humedad del Historial usa el verde de marca (era azul).
- **Tema oscuro casi neutro:** fondos `#0F1311`/`#151A16`/`#1C221D`, bordes `#2B332C`, texto secundario `#A3B0A6`, menú `#0B100D`; el verde aparece solo donde informa (bloque `#123B1C`, riel de estado, marca lima, acento `#81C784`). Se probó un fondo de verdes profundos y se descartó por «muy verdoso».
- Los estados (rojo, ámbar, azul) no cambian. Texto principal ≈ 15:1 y secundario ≈ 7:1 sobre el fondo claro; texto marfil sobre `#00450D` ≈ 10:1.
