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

**Estado de sincronización:** el archivo `openapi.yaml` (raíz) es el **contrato fuente de verdad** y se regenera desde el código FastAPI con `make openapi-sync`. Estado actual: **47 paths / 74 operaciones**. Las specs de `openspec/specs/` son la fuente de verdad del **comportamiento** de cada capacidad (ver §4).

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

### 3.2. API Key — Nodos IoT (Simulador)

Cada nodo tiene una **API Key fija** (string único, generada al registrar el nodo). El simulador la envía en cada POST de lectura:

```http
POST /api/v1/readings
X-API-Key: ak_n01_a1b2c3d4e5f6
```

Validación: si falta el header → **422** (parámetro requerido); si la key no existe o el nodo está inactivo/eliminado → **401**. La API Key **solo sirve para `POST /api/v1/readings`** — no permite consultar datos.

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

> Nota: las capacidades de Fase 2 (alerting, ai-modules) pueden estar dormidas detrás de flags en `backend/app/core/config.py` (OFF por defecto). Todos los endpoints de la tabla requieren JWT salvo el indicado.

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
| Nodes | POST | `/api/v1/nodes` | Registrar nodo (genera API Key) — Admin |
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
| Health | GET | `/health` | Verificación de estado del servicio |

**Total: 74 operaciones sobre 47 paths** (contrato `openapi.yaml`). Para payloads, schemas y ejemplos por endpoint, consulta el contrato autogenerado.