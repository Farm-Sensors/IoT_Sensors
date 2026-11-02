# Navegación de las pantallas de Fase 2 (aplicada el 2026-11-01)

> **Estado:** aprobada por JP («Asistente» sin «IA» y Consumo como pestaña) y aplicada. Menú de 5 destinos (productor) y 6 (admin), pestañas por módulo (`SectionTabs`), `?area=` en Alertas y Reglas de aviso (`useAreaFromQuery`), línea «N alertas sin leer» en Área (`AreaAlertsLink`) y enlace a las reglas del área en Detalles. En móvil, el administrador conserva sus 6 destinos con la barra desplazable (Ajustes sigue en la barra, no en el menú de cuenta). Textos y estética de cada pantalla: siguiente etapa.

Autorizado el 2026-11-01 (ver `../README.md`). Alcance: **solo navegación y arquitectura de información**; la estética va después. Sin cambios de backend, API, base de datos, permisos, flags ni lógica. Las rutas actuales **no cambian de dirección**; solo cambia dónde se llega a ellas y cómo se agrupan. Cada módulo sigue ocultándose con su flag.

## 1. Qué hay hoy (con los módulos encendidos)

| Rol | Menú lateral | Destinos |
|---|---|---|
| Productor (8) | Mis predios, Mapa, **Alertas, Asistente IA, Reportes IA, Umbrales, Notificaciones**, Cuenta | 5 de los 8 son de Fase 2, todos al mismo nivel que Mis predios |
| Admin (9) | Hoy, Clientes, Red, Ajustes, **Umbrales, Alertas, Asistente IA, Consumo IA, Reportes IA** | 5 de los 9 son de Fase 2, sin orden (Umbrales antes que Alertas) |

En móvil la barra inferior del productor pasa de 3 a 8 destinos, y la del admin de 4 a 9: no caben.

## 2. Problemas

1. **«IA» es ambiguo.** Tres entradas distintas llevan «IA» (Asistente IA, Reportes IA, Consumo IA) y no dicen qué hace cada una: una es una conversación, otra son resúmenes automáticos que llegan solos y la tercera es el gasto (solo admin).
2. **Alertas, Umbrales y Notificaciones son una sola idea** (qué me avisa, cuándo y por dónde) repartida en tres entradas del mismo nivel.
3. **Las alertas no están ligadas a las cosas.** El área, que ya tiene su propia página, no muestra ni enlaza sus alertas; el Centro de Alertas pide elegir «Predio» y «Área» en un panel de contexto aparte, aunque la URL ya dice de qué área se habla (rompe el principio «se navega por cosas»).
4. **La campana** (admin y productor) abre el Centro de Alertas, pero este no sabe de dónde vienes.
5. **Los umbrales son por área**, pero se llega a ellos desde un menú global, no desde el área.
6. **Vocabulario:** «Umbrales» es término técnico; el productor entiende «reglas de aviso».

## 3. Propuesta

### Menú (con módulos encendidos)

| Rol | Menú | Antes → Ahora |
|---|---|---|
| Productor | **Mis predios · Mapa · Alertas · Asistente · Cuenta** (5) | 8 → 5 |
| Admin | **Hoy · Clientes · Red · Alertas · Asistente · Ajustes** (6) | 9 → 6 |

Con un módulo apagado desaparece solo lo suyo: si ninguno está encendido, el menú es exactamente el de hoy (Mis predios, Mapa, Cuenta; Hoy, Clientes, Red, Ajustes).

### Pestañas dentro de cada sección (las rutas actuales, reagrupadas)

| Sección | Pestañas | Ruta | Visible si |
|---|---|---|---|
| **Alertas** | Recibidas | `…/alertas` (y `…/alertas/:id`) | `alerts` |
| | Reglas de aviso (antes «Umbrales») | `…/umbrales` | `alerts` |
| | Cómo me avisan (antes «Notificaciones», solo productor) | `/cliente/notificaciones` | `notifications` |
| **Asistente** | Preguntar (la conversación) | `…/asistente-ia` | `ai_assistant` |
| | Reportes automáticos | `…/reportes-ia` (y `…/:id`) | `ai_reports` |
| | Consumo (solo admin) | `/admin/consumo-ia` | `ai_assistant` |

Cada pestaña es la pantalla actual, sin cambios de lógica. La sección usa el mismo componente de pestañas que Clientes, Red y Ajustes (`SectionTabs`).

### Nombres

- **«Asistente»** en el menú (sin «IA»): la sección dice en su encabezado una línea de qué es cada pestaña («Pregunta sobre tus datos» / «Resúmenes que se generan solos»).
- **«Reglas de aviso»** en vez de «Umbrales» y **«Cómo me avisan»** en vez de «Notificaciones»: lo que hace, no la herramienta. Las rutas conservan sus nombres.

### Ligar las alertas a las cosas (sin pantallas nuevas)

- **Área › Ahora:** si hay alertas activas del área, una línea «N alertas sin leer» enlaza a `…/alertas?area=ID`. Sin alertas o con el módulo apagado no se muestra nada.
- **Área › Detalles:** enlace «Reglas de aviso de esta área» a `…/umbrales?area=ID`.
- **Alertas › Recibidas:** el filtro de área sale de la URL (`?area=`) en vez del panel «Contexto activo»; el panel solo se conserva como filtro opcional. El detalle de una alerta enlaza a su área.
- **La campana** sigue llevando a Alertas › Recibidas; cada fila al detalle de la alerta (como hoy).
- **Mapa y portada:** sin cambios (la portada no muestra alertas: «Atención» sigue significando problema de datos).

### Móvil

- Barra inferior del productor: **Mis predios · Mapa · Alertas · Asistente · Cuenta** (5 destinos; con módulos apagados, los 3 de hoy). Las pestañas internas van arriba de cada sección, desplazables.
- Admin móvil: **Hoy · Clientes · Red · Alertas · Asistente** y Ajustes en el menú de cuenta si no caben 6.

## 4. Qué no cambia

Rutas, módulos (flags), permisos, API, textos de negocio, alertas y su generación, umbrales y su validación, preferencias de notificación, conversación y reportes. Las rutas directas viejas siguen funcionando (con el módulo apagado, igual que hoy).

## 5. Orden de implementación

1. `items.ts`: agrupar en 5 y 6 destinos con sus pestañas por módulo (`navItemsFor`, `sectionTabsFor` para productor y admin) y actualizar `MobileTabBar`.
2. Renombrar las entradas (Asistente, Reglas de aviso, Cómo me avisan) en menú, pestañas y encabezados.
3. Enlaces entre área y alertas/reglas (`?area=`) y filtro de área desde la URL.
4. Pruebas de navegación (`items.test.ts`) y documentación (`04-paridad.md`, `design-system.md` si cambia algún patrón).

## 6. Riesgos y decisiones para JP

- **Asistente y reportes bajo una sola sección** supone que a quien solo tiene un módulo encendido se le ve una sola pestaña (se oculta la barra de pestañas si hay una sola).
- **¿«Asistente» sin «IA» en el menú?** Recomendado: sí. Si prefieres conservar «IA» como etiqueta de apoyo, se pone en el encabezado de la sección.
- **Consumo** queda como pestaña del Asistente (solo admin) en lugar de entrada de menú; es un dato de operación, no de uso diario.
- Los textos de los encabezados se afinan en la fase estética, no ahora.
