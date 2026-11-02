# Paridad funcional

> **Completo respecto de `main` (`af67be8`) tras la auditoría del 2026-10-31.** Fuentes: `routes.tsx`, `items.ts`, `v2/audit/results/controls.json` (controles visibles de cada pantalla), `crawl.json` y los flujos medidos. **Ninguna fila queda sin destino.** Las filas marcadas ⚠ requieren decisión del usuario.
>
> **Cómo se usa:** la implementación (fase 7, limpieza) verifica esta tabla fila por fila. La columna «Verificación» es la comprobación mínima; «ejecutable» indica que `frontend/e2e/` ya tiene una prueba equivalente (no se ejecutaron en esta sesión).

Convenciones: **P** = productor, **A** = admin. Rutas de `main`. API relativa a `/api/v1`.

## Productor

| ID | Función | Ruta en `main` | Rol | API | Destino v2 | Verificación |
|---|---|---|---|---|---|---|
| P1 | Métricas prioritarias: humedad, flujo, E.T.O. | `/cliente` | P | `/readings/latest`, `/readings` | Área › Ahora | Los tres valores coinciden con `/readings/latest`; un `null` se ve «—», nunca 0 |
| P2 | Estado del riego (encendido/apagado, acumulado), frescura y estado del equipo | `/cliente` | P | `/readings/latest`, `/properties/:id/gateway/status` | Área › Ahora | Último dato con fecha y «hace N»; umbral 20 min |
| P3 | Suelo (4 campos) y ambiente (5 campos) | `/cliente` | P | `/readings/latest` | Área › Ahora | Unidades fijas del contrato; 12 campos en total contando riego |
| P4 | Gráfica de humedad (últimas 12 lecturas) | `/cliente` | P | `/readings` | Área › Ahora (24 h en el prototipo) | Mismas lecturas que la tabla de Historial |
| P5 | Tarjetas según preferencias del cliente | `/cliente` | P | `/clients/me/dashboard-preferences` | Área › Ahora, misma regla | Ocultar un campo en el admin lo oculta aquí |
| P6 | Clima de referencia (Open-Meteo) | `/cliente` | P | `/weather/current` | Área › Ahora | Con flag apagado el 409 no rompe la pantalla (**hoy da 409 visible en consola**, hallazgo 16) |
| P7 | NDVI de último punto | `/cliente` | P | `/ndvi-snapshots/latest` | Área › Ahora | 404 = «sin dato», sin error visible |
| P8 | Selector de predio y de área | `/cliente`, `/cliente/historico`, `/cliente/exportar`, `/cliente/mapa` | P | `/properties`, `/irrigation-areas` | **Mis predios** (elige por fila) y migas del área | Se llega a cualquier área en ≤ 1 clic desde la portada |
| P9 | Lista de predios y áreas con humedad, estado y frescura | `/cliente/areas` | P | `/readings` por área | Mis predios | Aparecen **todas** las áreas, incluidas las sin nodo (hoy `/nodes/geo` no las trae: combinar con `/irrigation-areas`) |
| P10 | Estado «Equipo pendiente» por predio | `/cliente/areas`, `/cliente/predio/:id` | P | `/properties/:id/gateway/status` | Área › Detalles ⚠ | ⚠ Decisión 4: ¿lo ve el productor? |
| P11 | Detalle de predio: ubicación, nodos, áreas | `/cliente/predio/:id` (**huérfana**) | P | `/nodes`, `/readings` | Mis predios › panel de predio | Ruta antigua redirige; predio sin ubicación muestra «Sin ubicación registrada», no una ciudad inventada (`PropertyDetail.tsx:179`) |
| P12 | Mapa de nodos, filtros predio/área, «Actualizar capa» | `/cliente/mapa` | P | `/nodes/geo` | **Mapa** (página propia del productor, `#/mapa`) | Refresco 30 s; nodos sin GPS listados aparte, sin avisos de consola |
| P13 | Histórico: presets (Hoy, 7 días, 30 días, Este mes, Este año, Personalizado) | `/cliente/historico` | P | `/readings`, `/readings/availability` | Área › Historial | Mismos rangos que `useReadingFilters`; fechas en UTC con aviso |
| P14 | Filtro por ciclo de cultivo | `/cliente/historico`, `/cliente/exportar` | P | `/crop-cycles` | Área › Historial | Se aplica junto con el rango |
| P15 | Selector de métrica de la gráfica (6) | `/cliente/historico` | P | `/readings` | Área › Historial | Humedad suelo, H. relativa, Temp. suelo, Temp. aire, Flujo, E.T.O. |
| P16 | Tabla con paginación (Inicio, Anterior, Siguiente) | `/cliente/historico` | P | `/readings?page=` | Área › Historial | Mismo total y orden |
| P17 | Descargar CSV, Excel, PDF | `/cliente/historico`, `/cliente/exportar` | P | `/readings/export` | Área › Historial | **Misma consulta** que `main`; el CSV se descargó correctamente en la auditoría (`export_<área>_<fecha>.csv`) |
| P18 | Perfil: ver y editar nombre | `/cliente/perfil` | P | `/users/me` (GET, PATCH) | Cuenta | Solo el nombre es editable; correo bloqueado |
| P19 | «Ver Planes», «Plan Profesional», «Cambiar Contraseña» | `/cliente/perfil` | P | Ninguna | Ocultos (fase 6) | Decisión 3 aplicada como recomendado: no hacían nada; reversible |
| P20 | Cambiar tema y cerrar sesión | Menú lateral | P | Local; `localStorage` | Menú de cuenta | Tema persiste; cerrar sesión limpia el token |
| P21 | Redirección de rutas desconocidas | `/cliente/*` → `/cliente` | P | — | Misma | Cualquier ruta ajena llega a Mis predios |
| P22 | Estados vacíos y de error de cada pantalla | Varias | P | — | Cada pantalla | Cada vacío indica el siguiente paso (prototipo: ejemplos) |

## Admin

| ID | Función | Ruta en `main` | Rol | API | Destino v2 | Verificación |
|---|---|---|---|---|---|---|
| A1 | Totales (clientes, predios, nodos habilitados, lecturas hoy) y nodos deshabilitados | `/admin` | A | `/clients?per_page=1`, `/properties?per_page=1`, `/nodes?per_page=200`, `/readings?per_page=1&start_date=` | Hoy | **Mismas peticiones y sondeo de 3 s**; los totales coinciden |
| A2 | Atajos «Nuevo Cliente», «Nuevo Nodo» (hoy solo navegan) | `/admin` | A | — | Hoy: «Nuevo cliente» abre el formulario | El clic abre el formulario (arregla hallazgo 8) |
| A3 | «Configurar Umbrales», «Ver Auditoría» | `/admin` | A | — | Hoy y Ajustes | Enlaces conservados; Umbrales es Fase 2 (módulo apagado) |
| A4 | **Pendientes** (áreas sin comunicación, sin datos, sin nodo, sin ciclo, equipo por vincular) | — (no existe) | A | Derivados de `/nodes/geo`, `/irrigation-areas`, `/crop-cycles`, `/gateways` | Hoy | **Clase B** (presentación nueva de datos existentes, sin endpoint nuevo) |
| A5 | Listar y buscar clientes | `/admin/clientes` | A | `/clients` | Clientes (Directorio) | Búsqueda por nombre, correo o teléfono |
| A6 | Crear, editar y borrar cliente | `/admin/clientes` | A | `/clients` (POST, PUT, DELETE) | Directorio › panel del cliente | Mismos campos: empresa, contacto, correo, contraseña temporal, teléfono, dirección |
| A7 | Preferencias del dashboard del cliente (8 casillas, «Volver a automático», «Guardar») | `/admin/clientes/:id/dashboard` | A | `/clients/:id/dashboard-preferences` | Directorio › Cliente | El cambio se refleja en P5 |
| A8 | Crear, editar y borrar predio | `/admin/clientes/:id/predios` | A | `/properties` | Directorio › panel del predio | Nombre y ubicación (opcional) |
| A9 | Crear, editar y borrar área (nombre, cultivo, tamaño) | `/admin/predios/:id/areas` | A | `/irrigation-areas`, `/nodes/geo` | Directorio › panel del área | Cultivo del catálogo; tamaño opcional |
| A10 | Crear y eliminar ciclo de cultivo | `/admin/ciclos` (**sin enlace**) | A | `/crop-cycles` | Directorio › Área › Ciclos | **Alcanzable desde la interfaz** (arregla hallazgo 5); sin edición, como hoy; solo 1 activo por área |
| A11 | Listar, crear, editar y eliminar nodo | `/admin/nodos` | A | `/nodes` | Red › Nodos; acceso desde el área | Campos: área, nombre, serie, lat/lon opcionales |
| A12 | Detalle de nodo: «Editar nodo», «Datos para soporte» | `/admin/nodos/:id` | A | `/nodes/:id`, `/readings` | Red › Nodo | Mismos datos |
| A13 | Lista de equipos y «Ver avance» | `/admin/gateways` | A | `/gateways` y `/gateways/:id/status` | Red › Equipos | Todos los equipos (los revocados se pueden agrupar; hallazgo 19) |
| A14 | Asistente «Nuevo equipo» (3 pasos: rancho y áreas, vincular, revisar) | `/admin/gateways` | A | `POST /gateways`, `/gateways/:id/configuration` | Red › Equipos | `equipos.spec` (ejecutable) y la lógica de `GatewayManagement` intactas |
| A15 | Detalle de equipo: «Revocar enlace», «Cambiar el equipo de este rancho», «Ver avance» | `/admin/gateways/:id` | A | `/gateways/:id`, `/gateways/:id/revoke` | Red › Equipo | `RevokeLinkButton` conserva su comportamiento |
| A16 | Aprobar o denegar código de emparejamiento | `/pair`, `/admin/gateways/pair` | A | `/gateways/pairing-sessions/lookup` y `/:id/deny` | **Misma ruta** | **Contrato con la Raspberry:** `/pair?code=` y `/admin/gateways/pair` no cambian |
| A17 | Mapa global: filtros cliente/predio/área, marcadores o clusters, 3 casillas, «Actualizar capa» | `/admin/mapa` | A | `/nodes/geo` | Red › Mapa | Refresco 30 s; mismos filtros |
| A18 | Catálogo de cultivos: crear, editar, eliminar | `/admin/cultivos` | A | `/crop-types` | Ajustes › Catálogo | Valores iniciales: Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón |
| A19 | Bitácora de auditoría (filtros acción, entidad, fechas) | `/admin/auditoria` | A | `/audit-logs` | Ajustes › Auditoría | **Fase 2: lógica sin tocar.** Solo cambia el marco |
| A20 | Rol admin viendo lo que ve un cliente | — (no existe) | A | `validate_area_access` ya lo permite | **Pendiente: clase C** ⚠ | ⚠ Decisión 2. **Solo con autorización.** No se implementa |
| A21 | Redirecciones: `/admin/recorrido-v2` → `/admin/gateways`; rutas desconocidas → `/admin` | — | A | — | Equivalentes en v2 | Cada ruta antigua llega a su destino |
| A22 | Tema y cerrar sesión | Menú lateral | A | Local | Menú de cuenta | Igual que P20 |

## Fase 2 (rediseño de navegación aplicado, 2026-11-01)

Se conservan **ruta, módulo (gate) y comportamiento**. El menú agrupa las pantallas en dos secciones con pestañas (`20-navegacion-fase-2.md`): **Alertas** (Recibidas, Reglas de aviso, Cómo me avisan) y **Asistente** (Preguntar, Reportes automáticos, Consumo). Cada pestaña aparece solo si su módulo está encendido; con todos apagados el menú es el de siempre. No se encienden flags ni se arranca el perfil `phase2` en entornos compartidos.

| ID | Función | Ruta(s) | Rol | Módulo | Destino v2 | Verificación |
|---|---|---|---|---|---|---|
| F1 | Centro de alertas y detalle | `/cliente/alertas`, `/admin/alertas`, `…/:alertId` | P, A | `alerts` | Alertas › Recibidas; Área › Ahora enlaza las alertas sin leer del área (`?area=`) | `items.test.ts`; la ruta carga con módulo apagado, como hoy |
| F2 | Umbrales | `/cliente/umbrales`, `/admin/umbrales` | P, A | `alerts` | Alertas › Reglas de aviso; Área › Detalles enlaza las de esa área | Idem |
| F3 | Preferencias de notificación | `/cliente/notificaciones` | P | `notifications` | Alertas › Cómo me avisan | Idem |
| F4 | Asistente IA | `/cliente/asistente-ia`, `/admin/asistente-ia` | P, A | `ai_assistant` | Asistente › Preguntar | Idem |
| F5 | Reportes IA y detalle | `/cliente/reportes-ia`, `/admin/reportes-ia`, `…/:reportId` | P, A | `ai_reports` | Asistente › Reportes automáticos | Con módulo apagado la API responde 503 (hallazgo 17): no empeorar |
| F6 | Consumo IA | `/admin/consumo-ia` | A | `ai_assistant` | Asistente › Consumo (solo admin) | Idem |
| F7 | Recuperar y restablecer contraseña | `/recuperar-contrasena`, `/restablecer-contrasena` | Público | — | Sin cambio | Enlace «¿Olvidé mi contraseña?» del inicio de sesión conservado |
| F8 | Inicio de sesión | `/` | Público | — | Sin cambio de lógica | Login con JWT; redirige por rol |

## Estados que ninguna pantalla puede perder

| Estado | Regla |
|---|---|
| `null` ≠ `0` | Nunca mostrar `null` como 0; un cero medido sigue siendo 0 (prototipo: potencial hídrico `null` = «—»; flujo 0 = «0.0») |
| Frescura | Último dato + tiempo transcurrido, por área; 20 min |
| Carga, vacío, error | Cada pantalla los resuelve y el vacío dice el siguiente paso |
| Rol | El cliente solo ve lo suyo; sin cambios de permisos |

## Cómo verificar la paridad

1. Antes de implementar: guardar una grabación de las peticiones de cada tarea de `main`.
2. Por cada fase: repetir las tareas en v2 y comparar peticiones (mismas rutas y parámetros).
3. Fase 7: recorrer esta tabla fila por fila con evidencia (captura o prueba).
