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
| `--accent-primary` | `#6D7E5E` | `#8CA478` | Verde olivo. Botones primarios, progreso. |
| `--accent-gold` | `#A68A61` | `#BDA077` | Marrón dorado. Progreso secundario. |
| `--accent-glow` | `rgba(109,126,94,0.15)` | `rgba(140,164,120,0.16)` | Glow de prioridad (métricas en vivo). |

### Tipografía y Contraste
| Token | Light | Dark | Descripción |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#2C2621` | `#ECE6DE` | Marrón casi negro / off-white. Texto principal. |
| `--text-secondary` | `#6E6359` | `#A79B8D` | Marrón grisáceo. Subtítulos. |
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
2. **Frescura siempre visible:** indicador de último dato + tiempo transcurrido en el header del dashboard y en metric cards (`FreshnessIndicator`).
3. **Jerarquía de navegación:** Cliente → Predio → Área de Riego, consistente en toda la app.
4. **Interacciones simples y predecibles:** sin efectos ruidosos; animaciones sutiles (fade-in-up, stagger, glow solo en métricas prioritarias en vivo).

## 8. Referencia del diseño original

- Figma: https://www.figma.com/design/oC6tGH2eDH091njUEnkRPk/IoT-Agricultural-Irrigation-App