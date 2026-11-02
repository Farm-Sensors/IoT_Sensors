# Auditoría UI

Capturas en `docs/redesign/screenshots/` (60 del recorrido completo + 12 en modo oscuro + 5 de flujos). Nombre: `<rol>-<ruta>-<ancho>[-dark].png`, con `desktop` = 1366 px, `tablet` = 768 px, `mobile` = 390 px. Las capturas «mobile» a página completa muestran la barra inferior a media altura: es un artefacto de `fullPage` con un elemento fijo, no un defecto.

Los problemas de contenido y flujo están en `ux-audit.md`; aquí solo lo visual.

## Lo que ya funciona (se conserva)

Paleta cálida con acento verde, tipografía serif en títulos y mono en datos, tarjetas redondeadas, estados con icono y texto (no solo color), foco visible, un `h1` por página. El modo oscuro se aplica correctamente (ver sección propia). La base es coherente; el margen está en estructura y densidad, no en colores.

## Hallazgos

| # | Problema | Dónde (captura) | Prioridad |
|---|---|---|---|
| U1 | Tabla de clientes corta sus acciones: 5 botones con el mismo peso, contenedor de 980 px frente a 1 135 px de tabla. A 768 px solo se ven 3 columnas (Empresa, Contacto, Email): Estado, Teléfono y **todas las acciones** quedan fuera de la vista, sin indicio de que hay más | `admin-admin-clientes-desktop.png`, `admin-admin-clientes-tablet.png` | Alta · resuelto (etapa 2) |
| U2 | Barra inferior móvil cortada: «Perfil» / «Catálogo» a medias, sin indicio claro de más ítems | `cliente-cliente-mobile.png`, `admin-admin-mobile.png` | Alta · resuelto (etapa 1) |
| U3 | Tarjetas de totales del admin: unos 175 px de alto cada una y sin enlace; en móvil las cuatro ocupan casi una pantalla completa antes de lo accionable | `admin-admin-mobile.png` | Media · resuelto (etapa 4) |
| U4 | Tres variantes de tarjeta (`sand`, `light`, oscura) usadas sin regla visible: en el panel admin las de métricas son arena y las de contenido, claras; en el dashboard del cliente las prioritarias son casi negras | `admin-admin-desktop.png`, `cliente-cliente-desktop.png` | Media · resuelto (etapa 6) |
| U5 | Estado «sin datos recientes» con la misma intensidad que «datos actuales»: tarjetas oscuras de humedad y flujo sin atenuar | `cliente-cliente-desktop.png` | Media · resuelto (etapa 5) |
| U6 | Histórico: el panel de filtros es más alto que la gráfica visible (la gráfica queda bajo 900 px) y «Filtros activos» ocupa un bloque entero para repetir los controles | `cliente-cliente-historico-desktop.png` | Media · resuelto (etapa 3) |
| U7 | Tabla de Nodos con celdas de dos líneas y GPS con 7 decimales; acciones solo con icono (lápiz/papelera) sin texto | `admin-admin-nodos-desktop.png` | Baja · parcial (etapa 2): acciones con texto; GPS con 7 decimales sigue |
| U8 | Dashboard: el anillo de humedad es un arco parcial sin leyenda; el espacio bajo «Flujo de Agua» y «E.T.O.» queda vacío (tarjetas de la misma altura sin contenido) | `cliente-cliente-desktop.png` | Baja · resuelto (etapa 5) |
| U9 | Objetivos táctiles de menos de 44 px en mapas (16 admin, 9 cliente) | `admin-admin-mapa-mobile.png` | Media · resuelto (etapa 6) |
| U10 | Textos sin tilde en mayúsculas («SIN COMUNICACION», «Hace 1 dia») | `cliente-cliente-desktop.png` | Baja · parcial (etapa 5): dashboard resuelto; «Hace 1 dia» sigue en `utils/datetime.ts` |
| U11 | En modo oscuro las tarjetas prioritarias (humedad, flujo, E.T.O.) dejan de destacar: casi no se distinguen del resto de tarjetas, porque en claro su énfasis viene de ser las únicas oscuras. Contradice `AGENTS.md` §2.2 (prominencia de datos prioritarios) | `cliente-cliente-desktop-dark.png` frente a `cliente-cliente-desktop.png` | Media · resuelto (etapa 6) |
| U12 | Movimiento decorativo: pulso infinito en cada punto de frescura y en el de «Estado del Riego»; tres orbes difuminados flotando de fondo en oscuro; cada página entra subiendo 0,4 s con tarjetas escalonadas; sin `prefers-reduced-motion` | `FreshnessIndicator.tsx`, `DesktopDashboard.tsx`, `AnimatedBackground.tsx`, `PageTransition.tsx` | Media · resuelto (etapa 0) |
| U13 | Tres familias tipográficas por tarjeta: serif en el título, sans en el cuerpo, mono en el dato; el serif a 18 px compite con el dato prioritario | `cliente-cliente-desktop.png` | Baja · resuelto (etapa 6) |
| U14 | Radios sin regla: 32, 24 y 16 px más píldora, mezclados en la misma pantalla (visto en código: `AdminDashboard`, `ExportData`, `SelectionScopeBar`, `BentoCard`) | código | Baja · resuelto (etapa 6) |
| U15 | El mismo ciclo de cultivo se muestra en tres formatos de fecha: `2026-10-01 — Sin fecha de fin` (selector del histórico), `30 de septiembre de 2026 - Actual` (Ciclos), `25/10/2026` (filtros) | `cliente-cliente-historico-desktop.png`, `admin-admin-ciclos-desktop.png` | Baja · resuelto (etapa 6) |
| U16 | Punto sin etiqueta en «Estado del Riego» (gris cuando no riega, verde con pulso cuando sí) | `cliente-cliente-desktop.png` | Baja · resuelto (etapa 5) |
| U17 | Vidrio con desenfoque en las dos barras de navegación (`glass-sidebar`) y en `BentoCard` (`glass-card`), es decir, también sobre contenedores de datos | `MobileTabBar.tsx`, `DesktopSidebar.tsx`, `BentoCard.tsx` | Baja · resuelto (etapa 6) |

## Responsive

- **1366 px:** barra lateral de 272 px más contenido; correcto salvo U1.
- **768 px:** `useIsMobile` solo considera móvil por debajo de 768, así que aquí se usa el diseño de escritorio con la barra lateral de 272 px y el contenido útil queda en unos 450 px. Es el ancho más dañado: en Clientes las acciones desaparecen (U1). No hay un punto intermedio pensado. Solo revisé `/admin/clientes` a este ancho con la imagen; el resto de las capturas de 768 px las generé pero no las inspeccioné una a una.
- **390 px:** sin desbordamiento horizontal de página en las 20 rutas de cada rol. Los problemas son de la barra inferior (U2) y la longitud (U3).

## Modo oscuro

Capturas `*-dark.png` (cliente: dashboard, histórico, exportar; admin: panel, clientes, equipos; escritorio y móvil). En las 12 se aplicó la clase `dark`; inspeccioné a ojo solo el dashboard del cliente en escritorio, que es legible y consistente (salvo U11). No medí contraste con una herramienta en oscuro (el suite a11y no pudo ejecutar tres de sus páginas, ver `ux-audit.md`).

## Lo que no pude comprobar

Fuentes tipográficas exactas cargadas en esta máquina, rendimiento y ningún ancho entre 391 y 767 px. El mapa se capturó con WebGL por software, por lo que su aspecto puede variar en un navegador normal.
