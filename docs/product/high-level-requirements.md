# Requerimientos de Alto Nivel (Negocio / Usuario)

> Qué debe lograr el sistema desde el punto de vista de negocio. La especificación de comportamiento detallada (requirements + scenarios) vive en `openspec/specs/`.

## Jerarquía del dominio

- Un **Cliente** posee uno o más **Predios**; cada Predio contiene **Áreas de Riego**; cada Área tiene exactamente **1 Tipo de Cultivo** y **1 Nodo IoT** (relación 1:1).
- Cada Área puede tener múltiples **Ciclos de Cultivo** (temporadas) pero solo 1 activo a la vez.

## Requerimientos funcionales de alto nivel

| # | Requerimiento (negocio) | Dónde se especifica |
|---|---|---|
| R1 | Recibir lecturas de nodos IoT cada 10 minutos (144/día) con 3 categorías: suelo (4 campos), riego (3), ambiental (5) | `openspec/specs/readings` |
| R2 | Los campos no disponibles se envían como `0`/`null`; los datos estáticos (cultivo, tamaño, GPS) NO viajan en la lectura | `openspec/specs/readings` |
| R3 | Mostrar dashboard multicategoría con énfasis en los **3 datos prioritarios**: humedad del suelo, flujo de agua y E.T.O. | `openspec/specs/readings` |
| R4 | Mostrar **frescura** de datos: último dato recibido + tiempo transcurrido por nodo/área | `openspec/specs/readings` |
| R5 | Consultar histórico por rango de fechas, presets (semana/mes/año) y ciclo de cultivo | `openspec/specs/readings` |
| R6 | Exportar datos filtrados en CSV, Excel y PDF | `openspec/specs/readings` |
| R7 | El Cliente solo accede a sus predios/áreas; el Admin gestiona todo (multi-tenant) | `openspec/specs/security` |
| R8 | Catálogo administrable de cultivos (seed: Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón) | `openspec/specs/data-model` |
| R9 | Navegación jerárquica: Cliente → Predio → Área → datos | `docs/architecture/frontend.md` |
| R10 | Los gateways se autentican con credencial de predio; los usuarios con JWT | `openspec/specs/security` |

## Requerimientos no funcionales de alto nivel

- **Disponibilidad**: el sistema corre 24/7 en la VPS; ingesta tolerante a fallos transitorios de red del simulador.
- **Escalabilidad (MVP)**: diseñado para N nodos × 144 lecturas/día × 12 campos (índices por nodo+fecha).
- **Idiomas de interfaz**: español (UI); API en inglés (convención técnica).
- **Seguridad**: separación estricta de datos entre clientes; secretos configurables por entorno.
- **Trazabilidad**: timestamps UTC en cada lectura; auditoría de acciones críticas (Fase 2).

## Fuera del alcance del MVP (roadmap Fase 2)

- IA conversacional y reportes automáticos (dormidos tras flags).
- Alertas de umbral/inactividad y notificaciones email/WhatsApp (dormidos tras flags).
- NDVI.
- Recuperación de contraseña y auditoría: **implementadas** como utilidades de seguridad (no son objetivo de negocio del MVP pero existen y son necesarias).

## [TODO: completar]

- Prioridades de negocio del cliente (qué área funcional es más crítica).
- Requerimientos regulatorios o de reporte del socio (p. ej. entregar datos a alguna institución).