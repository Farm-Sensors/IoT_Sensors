# Documentación de la API REST — Sistema IoT de Riego Agrícola

> **Audiencia:** Desarrolladores del equipo (frontend y backend).
> **Propósito:** Entender cómo funciona la API del sistema, qué endpoints existen y cómo autenticarse. Esta es una guía de referencia rápida; el contrato detallado (payloads, errores, ejemplos) vive en `openapi.yaml` (raíz), autogenerado desde el código FastAPI.
> **Referencia:** Arquitectura general en `docs/architecture/overview.md`. Modelo de datos en `docs/data-model.md`. Comportamiento de cada capacidad en `openspec/specs/`.

---

## 1. Cómo Encaja la API en la Arquitectura

El backend FastAPI (puerto 5050) es el único punto de contacto con MySQL 8 (puerto 3306), y Traefik (vía Dokploy) actúa como reverse proxy público (80/443) con SSL automático.

| Actor | Qué hace | Autenticación | Endpoints que usa |
|-------|---------|---------------|-------------------|
| **Gateway Agro.io / simulador** | Envía lecturas cada 10 min | `X-API-Key` de gateway + `X-Logical-Node-Id` + `X-Event-ID` | `POST /api/v1/readings`, heartbeat, config poll |
| **Frontend — Admin** | Gestiona toda la plataforma + ve todos los dashboards | `Authorization: Bearer <JWT>` | Todos los endpoints |
| **Frontend — Cliente** | Ve dashboard, histórico y exporta de SUS predios/áreas | `Authorization: Bearer <JWT>` | GET de properties, irrigation-areas, crop-cycles, nodes, readings + export |

## 2. Documentación Automática y Estado de Sincronización

Con el backend corriendo: Swagger UI en `/api/v1/docs`, ReDoc en `/api/v1/redoc`, spec crudo en `/api/v1/openapi.json`.

**Estado de sincronización:** el archivo `openapi.yaml` (raíz) es el **contrato fuente de verdad** y se regenera desde el código FastAPI con `make openapi-sync`. Conteo verificado contra la tabla de rutas FastAPI (`app.routes`): **105 operaciones sobre 75 paths** (incluye `/health`); `openapi.yaml` omite las 4 rutas de ciclo de vida de gateway marcadas `include_in_schema=False` (`activate`, `activation-references`, `credentials/rotate`, `revoke`) y se regenera con `make openapi-sync`, por lo que su conteo puede diferir hasta la siguiente regeneración. Las specs de `openspec/specs/` son la fuente de verdad del **comportamiento** de cada capacidad (ver §4).

## 3. Autenticación

El sistema tiene **dos mecanismos separados**: JWT para usuarios web y credencial de **gateway** para máquinas. Las API keys por nodo ya no autentican.

### 3.1. JWT — Usuarios web (Admin y Cliente)

El login retorna `access_token` (expira ~15-30 min) + `refresh_token` (para renovarlo en `POST /api/v1/auth/refresh`). El access_token se envía en cada petición como `Authorization: Bearer <token>`.

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "admin@sensores.com", "password": "mi_clave" }
```

```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "token_type": "bearer" }
```

**Permisos por rol:** Admin puede CRUD de todo; Cliente solo lectura (GET) de recursos de su propia cadena Cliente → Predio → Área — si intenta ver datos ajenos recibe **403 Forbidden**. Users/Clients CRUD y auditoría son Admin only.

### 3.2. Credencial de gateway (Agro.io / simulador)

Cada predio tiene **una credencial de gateway**. El edge/simulador la envía junto con el nodo lógico:

```http
POST /api/v1/readings
X-API-Key: gk_...
X-Logical-Node-Id: 12
X-Event-ID: <uuid>
```

Validación: credencial ausente o inválida (o gateway no activo/revocado) → **401**. Nodo lógico no autorizado para ese gateway → **403**. Las API keys por nodo ya no autentican.

#### Respuestas de `POST /api/v1/readings`

Cabeceras obligatorias: `X-API-Key` (gateway), `X-Logical-Node-Id` y `X-Event-ID` (UUID). Idempotencia por **gateway + nodo lógico + event ID**:

| Código | Significado |
|---|---|
| **201** | Lectura creada |
| **200** | Reintento exacto del mismo evento (mismo cuerpo); devuelve la lectura original |
| **409** | Mismo `X-Event-ID` con cuerpo distinto |

El cuerpo de respuesta (`id`, `node_id`, `timestamp`, `created_at`) serializa los timestamps en UTC con sufijo `Z`.

### 3.3. Gateway: configuración, vínculos, heartbeat

Todos usan `X-API-Key` de gateway (salvo `activate`, que usa la referencia de activación de un solo uso). Detalle de cable en `contracts/edge-cloud/v2/`; guía de integración en [`integration/README.md`](integration/README.md).

| Operación | Endpoint | Notas |
|---|---|---|
| Activar | `POST /api/v1/gateways/activate` | Consume referencia de 24 h, devuelve credencial. Fuera de `openapi.yaml` |
| Leer configuración | `GET /api/v1/gateways/me/configuration` | Ver abajo |
| Proponer vínculo | `POST /api/v1/gateways/me/binding-candidates` | Requiere `X-Event-ID`; 201 / 200 (reintento exacto) / 409 |
| Confirmar vínculo | `POST /api/v1/gateways/me/binding-candidates/{candidate_id}/confirm` | Requiere `X-Event-ID` |
| Heartbeat | `POST /api/v1/gateways/me/heartbeat` | Sin cuerpo; **204**. Actualiza `last_seen` por hora de recepción |
| Autorización de actualización | `GET /api/v1/gateways/me/update-authorization` | 200 o 204 si no hay autorización vigente |
| Confirmar actualización | `POST /api/v1/gateways/me/update-confirmations` | Requiere `X-Event-ID` |

**`GET /api/v1/gateways/me/configuration`** — cabeceras opcionales `X-Config-Version` y `X-Bindings-Revision`.

- **200**: `configuration_version`, `bindings_revision`, `property_id`, `configuration` (`gateway_id`, `property_id`, `slots[]` con `slot_id`, `logical_node_id`, `irrigation_area_id`, `hardware_profile_code`), `binding_overlay` (`slots[]` con `binding_status`, `current_binding`, `pending_binding`), `cloud_status` y `edge_status`. Cada objeto de vínculo es `{candidate_id, uid, serial, submitted_at, confirmed_at}`.
- **304**: solo si **ambas** cabeceras están presentes y coinciden con `configuration_version` activa **y** `bindings_revision`. Si falta una o difiere, se responde 200 completo.
- Errores: **401** (credencial ausente/inválida); **404** `No configuration has been published` (aún no se publicó configuración); **409** `Active gateway configuration is unavailable` (la versión activa no tiene fila); **422** (cabeceras inválidas). El contrato lista también 403; el código actual no lo emite en este endpoint.

**Admin** (JWT): `GET/POST /api/v1/gateways` (provisionar reutiliza la fila del predio si su gateway está **revocado**: vuelve a `pending_activation`, reconcilia sus slots con el nodo activo de cada área, cierra candidatos de vínculo pendientes del ciclo anterior e invalida la configuración publicada (`config_version_activa` → 0, hay que **publicar** una nueva antes de activar); responde **409** si el gateway sigue vigente, si un área de la petición ya no aplica y su slot conserva historial de vínculos, o si un slot conservado cambiaría de nodo con historial), `GET /gateways/{id}`, `POST /gateways/{id}/configuration` (publicar, 201), `GET /gateways/{id}/status`, `POST /gateways/{id}/activation-references`, `POST /gateways/{id}/credentials/rotate`, `POST /gateways/{id}/revoke` (204), `POST /gateways/{id}/update-authorizations`; plantillas en `/gateway-templates` y perfiles en `/hardware-profiles`.

### 3.4. NDVI (último punto)

`POST /api/v1/ndvi-snapshots` (gateway): evento separado de la telemetría (`contracts/edge-cloud/v2/ndvi.schema.json`): `irrigation_area_id`, `ndvi` (-1..1), `provider`, `collection` (`sentinel-2-l2a`), `scene_id`, `scene_observed_at` (UTC `Z`), `cloud_cover_percent`, `sample_method` (`point`). El área debe estar en la configuración activa del gateway (si no, **403**). Respuestas: **201** nuevo, **200** reintento idéntico, **409** escena obsoleta o conflicto de payload. Lectura para usuarios: `GET /api/v1/ndvi-snapshots/latest?irrigation_area_id=` (JWT; 404 si no hay snapshot).

## 4. Convenciones Generales

- **URLs**: inglés, plural, versionadas (`/api/v1/...`). Palabras compuestas con guión (`/irrigation-areas`, `/crop-types`).
- **Métodos**: GET (listar/detalle), POST (crear, 201), PUT (actualizar, 200), DELETE (eliminar — soft delete, 200).
- **Respuestas en JSON**. Errores con `{"detail": "..."}` (FastAPI); 422 con detalle de validación Pydantic.
- **Paginación obligatoria** en listados: `?page=1&per_page=50` (defaults 1 y 50). Respuesta: `{ "page", "per_page", "total", "data" }`.
- **Filtros de fecha** (readings, crop-cycles): `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`. Ambos opcionales; sin ellos se retorna todo paginado.
- **Presets de fecha** (semana/mes/año): se resuelven en el **frontend**, que los traduce a `start_date`/`end_date`. La API solo entiende rangos.
- **Nomenclatura**: BD en español ↔ API en inglés (los schemas Pydantic traducen, p.ej. `clientes.nombre_empresa` → `company_name`).

### Códigos de Respuesta Principales

| Código | Cuándo |
|--------|--------|
| **200** OK | GET, PUT, DELETE exitosos |
| **201** Created | POST exitoso (creación) |
| **400** Bad Request | Petición mal formada |
| **401** Unauthorized | Sin autenticación o token/key inválido |
| **403** Forbidden | Autenticado sin permisos (datos ajenos) |
| **404** Not Found | Recurso no existe |
| **409** Conflict | Conflicto de negocio (correo duplicado, ciclo activo existente) |
| **422** Unprocessable Entity | Validación de datos fallida (Pydantic) |
| **500** Internal Server Error | Error inesperado |

## 5. Tabla de Recursos

Contrato detallado (payloads, schemas, errores, ejemplos): **`openapi.yaml`** (autogenerado, `make openapi-sync`) — importable en Swagger UI / Postman. El comportamiento de cada capacidad está especificado en `openspec/specs/`: **readings** → lecturas/ingesta, **security** → auth, **alerting** → alertas/umbrales/notificaciones, **ai-modules** → IA, **data-model** → modelo de datos, **geo-visualization** → mapas.

> Nota: las capacidades de Fase 2 (alerting, ai-modules) pueden estar dormidas detrás de flags en `backend/app/core/config.py` (OFF por defecto). Los endpoints de la tabla requieren JWT salvo los marcados `X-API-Key` (gateway) y `POST /gateways/activate` (referencia de activación).

| Recurso | Método | Endpoint | Descripción |
|---------|--------|----------|-------------|
| Auth | POST | `/api/v1/auth/login` | Login, retorna access + refresh token |
| Auth | POST | `/api/v1/auth/refresh` | Renovar access token |
| Auth | POST | `/api/v1/auth/logout` | Cerrar sesión (revoca refresh token) |
| Auth | POST | `/api/v1/auth/forgot-password` | Solicitar enlace de recuperación |
| Auth | POST | `/api/v1/auth/reset-password` | Restablecer contraseña con token de un solo uso |
| Users | GET | `/api/v1/users` | Listar (paginado) — Admin |
| Users | POST | `/api/v1/users` | Crear usuario — Admin |
| Users | GET | `/api/v1/users/{user_id}` | Detalle — Admin |
| Users | PUT | `/api/v1/users/{user_id}` | Actualizar — Admin |
| Users | DELETE | `/api/v1/users/{user_id}` | Eliminar — Admin |
| Users | GET | `/api/v1/users/me` | Perfil del usuario autenticado (admin o cliente) |
| Users | PATCH | `/api/v1/users/me` | Actualizar perfil propio (nombre; email read-only) |
| Clients | GET | `/api/v1/clients` | Listar (paginado) — Admin |
| Clients | POST | `/api/v1/clients` | Crear (cliente + usuario) — Admin |
| Clients | GET | `/api/v1/clients/{client_id}` | Detalle — Admin |
| Clients | PUT | `/api/v1/clients/{client_id}` | Actualizar — Admin |
| Clients | DELETE | `/api/v1/clients/{client_id}` | Eliminar — Admin |
| Notif. Settings | GET | `/api/v1/clients/me/notification-settings` | Ver switch global de notificaciones |
| Notif. Settings | PATCH | `/api/v1/clients/me/notification-settings` | Actualizar switch global |
| Properties | GET | `/api/v1/properties` | Listar (paginado, filtro `client_id`) |
| Properties | POST | `/api/v1/properties` | Crear predio — Admin |
| Properties | GET | `/api/v1/properties/{property_id}` | Detalle |
| Properties | PUT | `/api/v1/properties/{property_id}` | Actualizar — Admin |
| Properties | DELETE | `/api/v1/properties/{property_id}` | Eliminar — Admin |
| Crop Types | GET | `/api/v1/crop-types` | Listar (paginado) |
| Crop Types | POST | `/api/v1/crop-types` | Crear tipo de cultivo — Admin |
| Crop Types | GET | `/api/v1/crop-types/{crop_type_id}` | Detalle |
| Crop Types | PUT | `/api/v1/crop-types/{crop_type_id}` | Actualizar — Admin |
| Crop Types | DELETE | `/api/v1/crop-types/{crop_type_id}` | Eliminar — Admin |
| Irrigation Areas | GET | `/api/v1/irrigation-areas` | Listar (paginado, filtro `property_id`) |
| Irrigation Areas | POST | `/api/v1/irrigation-areas` | Crear área de riego — Admin |
| Irrigation Areas | GET | `/api/v1/irrigation-areas/{area_id}` | Detalle |
| Irrigation Areas | PUT | `/api/v1/irrigation-areas/{area_id}` | Actualizar — Admin |
| Irrigation Areas | DELETE | `/api/v1/irrigation-areas/{area_id}` | Eliminar — Admin |
| Crop Cycles | GET | `/api/v1/crop-cycles` | Listar (paginado, filtro `irrigation_area_id`, fechas) |
| Crop Cycles | POST | `/api/v1/crop-cycles` | Crear ciclo de cultivo — Admin |
| Crop Cycles | GET | `/api/v1/crop-cycles/{cycle_id}` | Detalle |
| Crop Cycles | PUT | `/api/v1/crop-cycles/{cycle_id}` | Actualizar — Admin |
| Crop Cycles | DELETE | `/api/v1/crop-cycles/{cycle_id}` | Eliminar — Admin |
| Nodes | GET | `/api/v1/nodes` | Listar (paginado, filtro `irrigation_area_id`) |
| Nodes | GET | `/api/v1/nodes/geo` | Capa geoespacial (frescura; filtros client/property/area) |
| Nodes | POST | `/api/v1/nodes` | Registrar nodo lógico (sin credencial de ingest) — Admin |
| Nodes | GET | `/api/v1/nodes/{node_id}` | Detalle |
| Nodes | PUT | `/api/v1/nodes/{node_id}` | Actualizar — Admin |
| Nodes | DELETE | `/api/v1/nodes/{node_id}` | Eliminar — Admin |
| Notif. Prefs | GET | `/api/v1/notification-preferences` | Listar preferencias (paginado y filtros) |
| Notif. Prefs | PUT | `/api/v1/notification-preferences/bulk` | Upsert masivo de preferencias |
| Readings | POST | `/api/v1/readings` | Ingesta de sensor (payload 3 categorías) — **X-API-Key** |
| Readings | GET | `/api/v1/readings` | Histórico (paginado; filtros área, fechas, ciclo) |
| Readings | GET | `/api/v1/readings/latest` | Última lectura (indicador de frescura) |
| Readings | GET | `/api/v1/readings/priority-status` | Semáforo prioritario (lectura + umbrales activos) |
| Readings | GET | `/api/v1/readings/availability` | Fechas disponibles para calendario/filtros |
| Readings | GET | `/api/v1/readings/export` | Exportar CSV/XLSX/PDF (`?format=...`) |
| Thresholds | GET | `/api/v1/thresholds` | Listar (paginado y filtros) |
| Thresholds | POST | `/api/v1/thresholds` | Crear umbral |
| Thresholds | GET | `/api/v1/thresholds/{threshold_id}` | Detalle |
| Thresholds | PUT | `/api/v1/thresholds/{threshold_id}` | Actualizar |
| Thresholds | DELETE | `/api/v1/thresholds/{threshold_id}` | Eliminar |
| Alerts | GET | `/api/v1/alerts` | Listar (paginado y filtros) |
| Alerts | GET | `/api/v1/alerts/unread-count` | Conteo de no leídas |
| Alerts | GET | `/api/v1/alerts/{alert_id}` | Detalle |
| Alerts | PATCH | `/api/v1/alerts/{alert_id}/read` | Marcar leída/no leída |
| Alerts | POST | `/api/v1/alerts/read-all` | Marcar todas como leídas |
| Alerts | POST | `/api/v1/alerts/{alert_id}/recommendation` | Generar recomendación agronómica para la alerta |
| Alerts | POST | `/api/v1/alerts/scan-inactivity` | Escanear nodos inactivos — Admin |
| Alerts | POST | `/api/v1/alerts/dispatch-notifications` | Despachar notificaciones externas — Admin |
| Audit Logs | GET | `/api/v1/audit-logs` | Listar eventos (paginado y filtros) — Admin |
| Audit Logs | GET | `/api/v1/audit-logs/{audit_log_id}` | Detalle de evento — Admin |
| AI Assistant | POST | `/api/v1/ai-assistant/chat` | Consulta conversacional con contexto operativo |
| AI Assistant | GET | `/api/v1/ai-assistant/usage` | Telemetría de uso del asistente — Admin |
| AI Reports | GET | `/api/v1/ai-reports` | Listar reportes IA (paginado) |
| AI Reports | GET | `/api/v1/ai-reports/{report_id}` | Detalle de reporte IA |
| AI Reports | POST | `/api/v1/ai-reports/generate` | Generar reporte — Admin/scheduler (dormido sin `AI_REPORTS_ENABLED`) |
| Gateways (admin) | GET | `/api/v1/gateways` | Listar gateways — Admin |
| Gateways (admin) | POST | `/api/v1/gateways` | Aprovisionar gateway de un predio — Admin |
| Gateways (admin) | GET | `/api/v1/gateways/{gateway_id}` | Detalle con slots — Admin |
| Gateways (admin) | POST | `/api/v1/gateways/{gateway_id}/configuration` | Publicar configuración — Admin |
| Gateways (admin) | GET | `/api/v1/gateways/{gateway_id}/status` | Estado del gateway — Admin |
| Gateways (admin) | POST | `/api/v1/gateways/{gateway_id}/activation-references` | Emitir referencia de activación (24 h) — Admin |
| Gateways (admin) | POST | `/api/v1/gateways/{gateway_id}/credentials/rotate` | Rotar credencial — Admin |
| Gateways (admin) | POST | `/api/v1/gateways/{gateway_id}/revoke` | Revocar gateway — Admin |
| Gateways (admin) | POST | `/api/v1/gateways/{gateway_id}/update-authorizations` | Autorizar imagen de actualización — Admin |
| Properties | GET | `/api/v1/properties/{property_id}/gateway/status` | Estado simple del gateway del predio |
| Gateways (edge) | POST | `/api/v1/gateways/activate` | Activación con referencia de un solo uso |
| Gateways (edge) | GET | `/api/v1/gateways/me/configuration` | Poll de configuración (200/304) — **X-API-Key** |
| Gateways (edge) | POST | `/api/v1/gateways/me/binding-candidates` | Proponer vínculo físico — **X-API-Key** |
| Gateways (edge) | POST | `/api/v1/gateways/me/binding-candidates/{candidate_id}/confirm` | Confirmar vínculo — **X-API-Key** |
| Gateways (edge) | POST | `/api/v1/gateways/me/heartbeat` | Heartbeat (204) — **X-API-Key** |
| Gateways (edge) | GET | `/api/v1/gateways/me/update-authorization` | Autorización vigente (200/204) — **X-API-Key** |
| Gateways (edge) | POST | `/api/v1/gateways/me/update-confirmations` | Confirmación de actualización — **X-API-Key** |
| Gateway Templates | GET | `/api/v1/gateway-templates` | Listar plantillas (paginado) — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates` | Crear plantilla — Admin |
| Gateway Templates | GET | `/api/v1/gateway-templates/{template_id}` | Detalle — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates/{template_id}/versions` | Nueva versión — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates/{template_id}/versions/{version_id}/activate` | Activar versión — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates/{template_id}/versions/{version_id}/retire` | Retirar versión — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates/{template_id}/versions/{version_id}/copies` | Copiar versión a un predio — Admin |
| Gateway Templates | POST | `/api/v1/gateway-templates/{template_id}/retire` | Retirar plantilla — Admin |
| Hardware Profiles | GET | `/api/v1/hardware-profiles` | Listar perfiles de hardware (paginado) — Admin |
| Hardware Profiles | POST | `/api/v1/hardware-profiles` | Crear perfil — Admin |
| Hardware Profiles | PATCH | `/api/v1/hardware-profiles/{profile_id}` | Actualizar perfil — Admin |
| NDVI | POST | `/api/v1/ndvi-snapshots` | Ingesta del último NDVI puntual — **X-API-Key** |
| NDVI | GET | `/api/v1/ndvi-snapshots/latest` | Último NDVI del área |
| Weather | GET | `/api/v1/weather/current` | Clima actual del área (`irrigation_area_id`) |
| Health | GET | `/health` | Verificación de estado del servicio |

**Total: 105 operaciones sobre 75 paths** (tabla de rutas FastAPI; ver §2 para la diferencia con `openapi.yaml`). Para payloads, schemas y ejemplos por endpoint, consulta el contrato autogenerado.