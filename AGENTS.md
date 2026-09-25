Actúa como un arquitecto de software y desarrollador Senior. Estoy construyendo desde cero un sistema web IoT para el monitoreo de sensores de riego agrícola para un cliente. A continuación, te presento el contexto técnico, la arquitectura y las restricciones de la fase actual del proyecto (MVP). Debes basar todas tus respuestas, sugerencias de código y diseños en este contexto:

1. ESTADO ACTUAL Y RESTRICCIONES (MVP)
- El alcance actual es un Producto Mínimo Viable (MVP) enfocado estrictamente en la ingesta de datos, gestión de usuarios y visualización.
- RESTRICCIÓN: No diseñes ni implementes **nuevas** funcionalidades de Inteligencia Artificial (Azure OpenAI), n8n, ni agentes autónomos. **Nota de estado:** el código de Fase 2 (IA, alertas de umbral/inactividad, notificaciones email/WhatsApp, password reset, auditoría) **ya existe implementado**, pero está **dormido detrás de flags (OFF por defecto)** — ver sección 4 y `ALERTS_ENABLED`/`AI_ASSISTANT_ENABLED`/`AI_REPORTS_ENABLED` en `backend/app/core/config.py`. No lo borres ni lo expandas sin autorización; el MVP corre con todos esos flags apagados (los schedulers requieren `docker compose --profile phase2 up`).

### Approved integration-week override

The latest **point-sampled NDVI** result from Agro.io is approved as a bounded integration addition. It MUST use the separate `contracts/edge-cloud/v2/ndvi.schema.json` event and MUST NOT become a thirteenth telemetry field. Polygon/history NDVI remains deferred. All other Phase 2 restrictions in this file remain unchanged. How the system works: `docs/system.md`. Integration: `docs/integration/README.md`.

### Integration agent

Si el trabajo asignado es una carpeta `openspec/changes/integration-*`, esa carpeta es el brief. Lee también las rutas de Scope de esa proposal y los contratos o evidencia que nombra. Implementa `tasks.md`. No sigas `docs/integration/week-plan.md` ni Agro.io. No sigas `docs/integration/work-packets/` para implementar. Si te bloqueas, detente. Los PRs de IoT siguen la política ordinaria de IoT_Sensors (este repo no es producción Agro; no apliques la regla de Agro sobre `main`). **No** trates `main` de Agro.io como destino de merge. Si el cambio asignado está en Agro.io (no debería ocurrir desde este repo), detente. El PR usa `Closes #N` cuando exista un issue; el issue solo nombra esa carpeta.

2. ARQUITECTURA TÉCNICA
El sistema sigue una arquitectura cliente-servidor tradicional, separando la recolección de datos, el backend y el frontend.
- Infraestructura: Todo el entorno de servidor ("Servidor Grogu") estará montado en una VPS con Linux.
- Módulo de Control (Simulador de Hardware): No tengo acceso físico a los sensores reales ni a los servidores del cliente. Una PC local actuará como simulador. Correrá un script que enviará peticiones HTTP POST cada **10 minutos** a través de internet hacia la API pública del servidor, simulando el envío de lecturas (**144 lecturas diarias por nodo**). Cada petición envía un **payload JSON unificado** que contiene las **3 categorías dinámicas** de datos del sensor: Suelo, Riego y Ambiental (ver sección 2.1). Los datos "Generales" (Cultivo, Tamaño) son estáticos y ya están registrados en la BD, **NO** se envían en cada lectura. Si un campo dinámico no está disponible para un nodo determinado, se envía como `0` o `null`. Las coordenadas GPS **NO** se incluyen en el payload; son un dato estático que se registra una sola vez al configurar el nodo.
- Backend / Web Service (Puerto 5050): Es el orquestador central. Recibe los payloads (POST) del Módulo de Control (solo escritura) y los guarda en la base de datos. También expone una API REST con operaciones CRUD completas para que el Frontend la consuma.
- Base de Datos (Puerto 3306): Base de datos relacional con la siguiente jerarquía de entidades:
  - **Cliente** → posee uno o más **Predios** (terrenos/propiedades)
  - **Predio** → contiene una o más **Áreas de Riego**
  - **Área de Riego** → tiene asignado exactamente **1 Tipo de Cultivo** (del catálogo administrable) y exactamente **1 Nodo IoT** (relación 1:1)
  - **Nodo IoT** → genera el histórico de **Lecturas** (una cada 10 min)
  - Cada **Área de Riego** tiene un **Ciclo de Cultivo** con fecha de inicio y fecha de fin, para agrupar datos por temporada agrícola.
  - Cada **Lectura** lleva un `timestamp` obligatorio (fecha y hora exacta) para permitir consultas por rangos de fecha.
  - Catálogo **administrable** de cultivos (gestionado por el Admin). Valores iniciales: **Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón**. El Admin puede agregar, editar o eliminar tipos de cultivo desde la plataforma.
- Frontend (Web App): Aplicación web desacoplada que consume la API del Backend para mostrar la interfaz a los usuarios (dashboard multicategoría, históricos con filtros, exportación).

2.1. MODELO DE DATOS DEL SENSOR (PAYLOAD)
El payload contiene **3 categorías dinámicas** (12 campos en total). Los datos "Generales" (Cultivo, Tamaño, GPS) son **estáticos**, ya registrados en la BD al configurar el nodo/área, y **NO se envían en cada lectura**. Los campos no disponibles se envían como `0` o `null`:

- **Suelo** (4 campos):
  - `soil.conductivity` — Conductividad eléctrica (dS/m)
  - `soil.temperature` — Temperatura del suelo (°C)
  - `soil.humidity` — Humedad del suelo (%) ⭐ (dato prioritario)
  - `soil.water_potential` — Potencial Hídrico (MPa, valores negativos)

- **Riego** (3 campos):
  - `irrigation.active` — Status on/off (booleano: true/false)
  - `irrigation.accumulated_liters` — Litros acumulados (L)
  - `irrigation.flow_per_minute` — Flujo por minuto (L/min) ⭐ (dato prioritario)

- **Ambiental** (5 campos):
  - `environmental.temperature` — Temperatura ambiente (°C)
  - `environmental.relative_humidity` — Humedad Relativa (%)
  - `environmental.wind_speed` — Velocidad del viento (km/h)
  - `environmental.solar_radiation` — Radiación solar (W/m²)
  - `environmental.eto` — E.T.O. Evapotranspiración (mm/día) ⭐ (dato prioritario)

- **Datos Estáticos (NO van en el payload, se registran al configurar nodo/área):**
  - Tipo de Cultivo (del catálogo administrable, asignado al Área de Riego)
  - Tamaño del área
  - GPS latitud/longitud (registrado en el Nodo)

> **Note:** NDVI remains excluded from telemetry. The approved latest-point exception uses the separate event defined by the override and contract above.

2.2. DATOS PRIORITARIOS
Los siguientes datos son los de mayor importancia para el cliente y deben tener prominencia en el dashboard y las alertas:
1. **Humedad del suelo** — Indicador principal del estado del riego.
2. **Flujo / Consumo de agua** — Monitoreo del uso de recursos hídricos.
3. **E.T.O. (Evapotranspiración)** — Referencia para la demanda hídrica del cultivo.

2.3. INDICADOR DE FRESCURA DE DATOS
- Cuando un nodo deja de enviar lecturas, el sistema debe mostrar la **fecha y hora del último dato recibido** junto con el **tiempo transcurrido** desde esa última lectura (ej. "Último dato: hace 2 horas 30 min").
- Esto permite al usuario identificar rápidamente qué nodos/áreas están sin comunicación.

2.4. DECISIONES TÉCNICAS DE IMPLEMENTACIÓN

**Stack Tecnológico:**
- **Backend:** Python 3.11+ con **FastAPI** (async, tipado estricto, documentación automática Swagger/OpenAPI).
- **Frontend:** **React** (SPA desacoplada que consume la API REST).
- **Base de Datos:** **MySQL 8** (puerto 3306). ORM: **SQLAlchemy** con **Alembic** para migraciones.
- **Deployment:** **Docker + Docker Compose** en la VPS Linux gestionado vía **Dokploy**. Contenedores: MySQL, Backend (FastAPI + Uvicorn), Frontend (Build estático servido por Nginx interno). **Traefik (Dokploy)** actúa como reverse proxy público y service discovery, ruteando `/api/*` al backend y `/` al frontend, además de gestionar los certificados SSL automáticamente.

**Autenticación y Seguridad:**
- **Usuarios (Admin/Cliente):** JWT (JSON Web Tokens). Login retorna access token + refresh token. El frontend envía el token en el header `Authorization: Bearer <token>`.
- **Gateways Agro.io:** cada predio tiene una credencial de gateway. El simulador/edge envía `X-API-Key` (gateway) + `X-Logical-Node-Id` + `X-Event-ID`. Las API keys por nodo ya no autentican telemetría.

**Convenciones del API:**
- URLs en **inglés**, plural, versionadas: `/api/v1/clients`, `/api/v1/properties`, `/api/v1/irrigation-areas`, `/api/v1/nodes`, `/api/v1/readings`, `/api/v1/crop-cycles`, `/api/v1/crop-types`.
- Métodos estándar: GET (listar/detalle), POST (crear), PUT (actualizar), DELETE (eliminar).
- Respuestas en JSON. Paginación obligatoria en endpoints de listado (`?page=1&per_page=50`).
- Filtros de fecha como query params: `?start_date=2026-01-01&end_date=2026-01-31`.
- Presets de fecha resueltos en el **frontend** (semana/mes/año se traducen a start_date/end_date antes de llamar al API).

**Estructura del Payload del Sensor (JSON exacto):**
El simulador/edge envía un POST a `/api/v1/readings` con `X-API-Key` (gateway), `X-Logical-Node-Id`, `X-Event-ID` y el siguiente body:

```json
{
  "timestamp": "2026-02-24T14:30:00Z",
  "soil": {
    "conductivity": 2.5,
    "temperature": 22.3,
    "humidity": 45.6,
    "water_potential": -0.8
  },
  "irrigation": {
    "active": true,
    "accumulated_liters": 1250.0,
    "flow_per_minute": 8.3
  },
  "environmental": {
    "temperature": 28.1,
    "relative_humidity": 55.0,
    "wind_speed": 12.5,
    "solar_radiation": 650.0,
    "eto": 5.2
  }
}
```

> Si un campo no está disponible, se envía como `0` o `null` (ej. `"eto": null`).
> El campo `timestamp` es **obligatorio** (formato ISO 8601 UTC).
> El campo `irrigation.active` es **booleano** (true/false). `accumulated_liters` y `flow_per_minute` son campos numéricos separados.

**Unidades de Medida (fijas, no se envían en el payload):**

| Campo | Unidad | Descripción |
|-------|--------|-------------|
| `soil.conductivity` | dS/m | Conductividad eléctrica del suelo |
| `soil.temperature` | °C | Temperatura del suelo |
| `soil.humidity` | % | Humedad volumétrica del suelo |
| `soil.water_potential` | MPa | Potencial hídrico (valores negativos) |
| `irrigation.active` | bool | true = encendido, false = apagado |
| `irrigation.accumulated_liters` | L | Litros acumulados en el ciclo actual |
| `irrigation.flow_per_minute` | L/min | Flujo instantáneo |
| `environmental.temperature` | °C | Temperatura ambiente |
| `environmental.relative_humidity` | % | Humedad relativa del aire |
| `environmental.wind_speed` | km/h | Velocidad del viento |
| `environmental.solar_radiation` | W/m² | Radiación solar incidente |
| `environmental.eto` | mm/día | Evapotranspiración de referencia |

**Ciclos de Cultivo:**
- Cada área de riego puede tener **múltiples ciclos de cultivo** (historial de temporadas: 2025, 2026...).
- Solo **1 ciclo puede estar activo** a la vez por área (el que no tiene fecha_fin o cuya fecha_fin es futura).
- Tabla independiente `crop_cycles` con: `id`, `irrigation_area_id`, `start_date`, `end_date`, `created_at`.
- El usuario puede filtrar el histórico de lecturas por ciclo de cultivo específico.

**Exportación de Datos:**
- Formatos soportados: **CSV**, **Excel (.xlsx)** y **PDF**.
- La exportación se genera en el **backend** (endpoint dedicado) con los mismos filtros del histórico.
- Endpoint: `GET /api/v1/readings/export?format=csv&start_date=...&end_date=...&irrigation_area_id=...`

3. ROLES Y CASOS DE USO PRINCIPALES
- **Administrador:** Gestiona toda la plataforma. Sus responsabilidades incluyen:
  - Crear/editar **Clientes** (CRUD).
  - Crear/editar **Predios** y asignarlos a un cliente (CRUD).
  - Gestionar el **catálogo de tipos de cultivo** (agregar/editar/eliminar).
  - Crear/editar **Áreas de Riego** dentro de cada predio, asignando el tipo de cultivo del catálogo administrable.
  - Definir **Ciclos de Cultivo** (fecha inicio/fin) para cada área de riego.
  - Registrar **Nodos IoT**, configurando sus datos estáticos (GPS latitud/longitud, tamaño) y vincularlos a un área de riego específica (relación 1:1).
  - Supervisar el estado general: puede ver el dashboard e histórico de **cualquier** cliente/predio/área.

- **Cliente (Usuario Final):** Solo tiene acceso a sus propios predios y áreas de riego (ej. Nogal, Alfalfa). Sus capacidades:
  - **Dashboard multicategoría:** Visualiza en tiempo real los datos de las 3 categorías dinámicas de sensores (Suelo, Riego, Ambiental) junto con los datos estáticos del área/nodo, con énfasis visual en los **datos prioritarios** (Humedad de suelo, Flujo de agua, E.T.O.).
  - **Indicador de frescura:** Ve cuándo fue la última lectura y el tiempo transcurrido sin actualización para cada nodo/área.
  - **Navegación jerárquica:** Selecciona Predio → Área de Riego → ve los datos de esa área.
  - **Histórico con filtros:** Consulta datos filtrando por rango libre de fechas, presets rápidos (semana, mes, año) y por ciclo de cultivo (inicio/fin definido por el Admin).
  - **Exportar datos:** Descarga los datos filtrados.

- **Nodo IoT (Actor de Sistema):** El simulador/edge transmite lecturas cada 10 minutos. Se autentica con la credencial de **gateway** del predio (`X-API-Key`) más `X-Logical-Node-Id` y `X-Event-ID`. Campos no disponibles van como `0` o `null`.

4. ROADMAP Y ESCALABILIDAD (FASE 2 - NO IMPLEMENTAR AÚN)
La arquitectura de la base de datos y la API del MVP deben diseñarse preparando el terreno para la futura integración de funcionalidades avanzadas. A continuación se documenta todo lo planificado para la Fase 2, organizado por módulo:

4.1. INTELIGENCIA ARTIFICIAL Y AGENTES (n8n + Azure OpenAI)
- A) Asistente Conversacional Interactivo: IA (Azure OpenAI) que permite a Clientes y Administradores hacer preguntas en lenguaje natural en la plataforma. Usará la API (Function Calling) para extraer datos específicos en tiempo real y dar consejos agronómicos.
- B) Análisis Asíncrono y Reportes: Tareas programadas nocturnas donde n8n extraerá grandes bloques de datos históricos, los enviará a la IA para buscar patrones o anomalías, y generará reportes automáticos o alertas tempranas para el cliente.

4.2. SISTEMA DE ALERTAS Y UMBRALES
- El usuario (Cliente) podrá configurar **rangos personalizados de humedad** por cada área de riego (ej. Rango Óptimo 20-30%, Déficit <10%). El sistema generará alertas automáticas cuando los valores de los sensores salgan de los rangos configurados.
- **Indicadores de color por umbrales en el dashboard:** Código de colores (verde = óptimo, amarillo = exceso/riesgo leve, rojo = falta de agua/nivel crítico) basado en los umbrales configurados por el usuario.
- Esto requerirá **nuevas tablas en BD:** `umbrales` (rangos configurados por área y parámetro) y `alertas` (historial de alertas generadas con timestamp, nodo, parámetro, valor y severidad).
- **Nuevos endpoints:** CRUD de umbrales por área, listado/detalle de alertas, marcado de alertas como leídas.

4.3. NOTIFICACIONES PUSH EXTERNAS
- Las alertas críticas podrán configurarse para ser enviadas por **correo electrónico** y/o **WhatsApp**.
- Requiere integración con servicio de email (SMTP o servicio cloud) y API de WhatsApp Business.
- El usuario podrá elegir qué alertas envían notificación y por qué canal.
- **Notificaciones Avanzadas (pendiente):** reglas de horario y ventanas de silencio por cliente/área/canal (preferencias extendidas + motor de despacho horario). Actualmente `preferencias_notificacion` solo modela tipo_alerta/severidad/canal/habilitado, sin ventana horaria.

4.4. ALERTA ACTIVA POR INACTIVIDAD DE NODO
- En el MVP existe un indicador visual pasivo de frescura (último timestamp + tiempo transcurrido). En Fase 2 se implementará una **alerta backend activa** cuando un nodo lleve ≥20 minutos (2 lecturas consecutivas perdidas) sin enviar datos, generando una notificación push al usuario.

4.5. NDVI (ÍNDICE DE VEGETACIÓN)
- Synchronizing and displaying Agro.io's latest point NDVI is approved through a separate event with Sentinel-2 provenance.
- Historical and polygon-sampled NDVI remain deferred to a later phase.
- NDVI is not added to the `lecturas` table or telemetry payload.

4.6. VISUALIZACIÓN GEOESPACIAL (MAPAS)
- Integración con API de mapas (Google Maps u otra) para renderizar ubicación de predios y nodos sobre mapa interactivo, tipo "Google Earth".
- GPS ya se almacena en la tabla `nodos` como dato estático (latitud/longitud). Esta funcionalidad los visualizará en un mapa.
- Al seleccionar un predio en el mapa, se mostrarán sus áreas de riego con indicadores de estado.

4.7. RECUPERACIÓN DE CONTRASEÑA
- Flujo de "Olvidé mi contraseña" con envío de correo electrónico de recuperación (enlace con token temporal).
- Requiere servicio de email configurado (mismo que se use para notificaciones).

4.8. LOGS DE AUDITORÍA
- Vista para que el Administrador pueda ver quién hizo cada cambio en la plataforma (qué usuario, qué acción, en qué entidad, cuándo).
- Las tablas del MVP ya registran `creado_en` y `actualizado_en` como base. En Fase 2 se agregaría una tabla dedicada `audit_log`.

4.9. CONFIGURACIÓN DEL CLIENTE
- En el MVP el Cliente es solo visor (dashboard, histórico, exportación). En Fase 2, el Cliente podrá configurar sus propios umbrales de alertas y preferencias de notificación por área de riego.

4.10. REQUISITO DE DISEÑO ACTUAL (para soportar Fase 2)
- Para soportar todas las modalidades futuras, la base de datos del MVP debe estar perfectamente normalizada. Las tablas y endpoints de la API deben garantizar trazabilidad total (timestamps precisos en cada lectura, IDs de cultivos/nodos/predios/áreas) y permitir tanto consultas rápidas filtradas (para el chat de IA) como extracciones masivas de datos históricos (para los reportes nocturnos). El volumen estimado es de **3 categorías × 12 campos dinámicos × 144 lecturas/día × N nodos**, lo cual debe considerarse en el diseño de índices y particionamiento.

> **IMPORTANT:** When the remaining Phase 2 work is implemented, update the database schema (new `umbrales`, `alertas`, and `audit_log` tables; separate NDVI snapshot storage, never a telemetry field), SRS, use cases, and activity diagrams.

5. INSTRUCCIONES PARA TUS RESPUESTAS
- Cuando te pida diagramas, código, o diseño de base de datos/endpoints, apégate a esta arquitectura y la jerarquía: **Cliente → Predios → Áreas de Riego (→ Tipo de Cultivo + Nodo IoT 1:1)**.
- **Stack:** Python/FastAPI (backend), React (frontend), MySQL 8 (BD), Docker Compose (deploy). Ver sección 2.4 para detalles.
- Mantén las soluciones simples y modulares para un entorno Linux.
- When designing sensor payloads, use the **three dynamic categories** in section 2.1 with the exact JSON keys from section 2.4. Do not include static crop, size, or GPS data. Unavailable values may be `0` or `null` in the legacy baseline; the edge-cloud v1 contract requires `null`. NDVI is never telemetry and uses its separate latest-point contract.
- El catálogo de cultivos es **administrable** por el Admin (CRUD). Valores iniciales de seed: **Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón**.
- Toda lectura debe llevar `timestamp` (ISO 8601 UTC). Todo endpoint de consulta debe soportar filtros por rango de fechas (`start_date`, `end_date`).
- Contempla el indicador de frescura de datos (último timestamp + tiempo transcurrido) en diseños de dashboard.
- **Auth:** JWT para usuarios, API Key (`X-API-Key` header) para gateways Agro.io.
- **API:** URLs en inglés, plural, versionadas (`/api/v1/...`). Paginación en listados. Exportación en CSV/Excel/PDF.
- **Ciclos de cultivo:** Múltiples por área (historial). Solo 1 activo a la vez.
