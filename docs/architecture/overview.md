# Arquitectura del Sistema — IoT Riego Agrícola

> Documento de referencia visual de la arquitectura técnica del sistema.
> Contiene los diagramas de infraestructura, flujos de datos y autenticación para el **MVP (Fase 1)**, el estado activo de **MVP Extendido (Fase 2 Lite)** y el alcance futuro de **Fase 2 Completa**.

---

## Tabla de Contenidos

- [1. Diagrama de Arquitectura General (MVP)](#1-diagrama-de-arquitectura-general-mvp)
- [2. Flujo de Datos del Sensor](#2-flujo-de-datos-del-sensor)
- [3. Flujos de Autenticación](#3-flujos-de-autenticación)
- [4. Jerarquía de Entidades](#4-jerarquía-de-entidades)
- [5. Stack Tecnológico](#5-stack-tecnológico)
- [6. Decisiones de Arquitectura: Docker y Deployment](#6-decisiones-de-arquitectura-docker-y-deployment)
- [7. Extensión de Arquitectura: Fase 2 Lite y Fase 2 Completa](#7-extensión-de-arquitectura-fase-2-lite-y-fase-2-completa)

---

## 1. Diagrama de Arquitectura General (MVP)

Este diagrama muestra **todos los componentes del sistema y cómo se comunican entre sí** en producción.

```mermaid
graph TD
    subgraph INTERNET["🌐 Internet"]
        Browser["🖥️ Browser<br/>(Admin / Cliente)"]
        Simulator["📡 Simulador<br/>(PC Local — Script Python)"]
    end

    subgraph VPS["🐸 VPS Linux — Servidor Grogu<br/>Docker Compose"]
        subgraph NGINX_BLOCK["Nginx — Traefik<br/>:80 / :443"]
            Nginx["⚡ Reverse Proxy"]
        end

        subgraph FRONTEND_BLOCK["Contenedor Frontend"]
            Frontend["⚛️ React SPA<br/>(build estático)"]
        end

        subgraph BACKEND_BLOCK["Contenedor Backend"]
            Backend["🐍 FastAPI + Uvicorn<br/>:5050"]
            Scheduler["⏰ Schedulers<br/>(Inactividad / Notificaciones)"]
        end

        subgraph DB_BLOCK["Contenedor Base de Datos"]
            MySQL["🗄️ MySQL 8<br/>:3306"]
        end
    end

    %% --- Conexiones externas → Nginx ---
    Browser -->|"HTTPS :443<br/>JWT Bearer token"| Nginx
    Simulator -->|"HTTPS POST<br/>/api/v1/readings<br/>Header: X-API-Key"| Nginx

    %% --- Nginx rutea ---
    Nginx -->|"/ → static files"| Frontend
    Nginx -->|"/api/v1/* → :5050"| Backend

    %% --- Frontend ↔ Backend (vía Nginx) ---
    Frontend -.->|"REST API<br/>GET/POST/PUT/DELETE<br/>Authorization: Bearer"| Nginx

    %% --- Backend → BD ---
    Backend -->|"SQLAlchemy ORM<br/>:3306"| MySQL
    Scheduler -->|"SQLAlchemy<br/>:3306"| MySQL

    %% --- Backend → Servicios Externos ---
    Backend -.->|"Notificaciones"| Externos["📧 Email (SMTP)<br/>📱 WhatsApp API"]
    Scheduler -.->|"Disparador periódico"| Backend

    %% --- Estilos ---
    style INTERNET fill:#e3f2fd,stroke:#1565c0,color:#000
    style VPS fill:#f1f8e9,stroke:#33691e,color:#000
    style NGINX_BLOCK fill:#fff3e0,stroke:#e65100,color:#000
    style FRONTEND_BLOCK fill:#e8eaf6,stroke:#283593,color:#000
    style BACKEND_BLOCK fill:#fce4ec,stroke:#b71c1c,color:#000
    style DB_BLOCK fill:#f3e5f5,stroke:#4a148c,color:#000
```

**Resumen de puertos y protocolos:**

| Origen | Destino | Puerto | Protocolo / Ruta |
|--------|---------|--------|------------------|
| Browser | Nginx | 80 → 443 | HTTPS (redirect HTTP→HTTPS) |
| Simulador | Nginx | 443 | HTTPS POST `/api/v1/readings` |
| Nginx | Frontend | interno | `/` → archivos estáticos React |
| Nginx | Backend | 5050 | `/api/v1/*` → proxy pass |
| Backend | MySQL | 3306 | SQLAlchemy (conexión interna Docker) |

> **Nota:** El Frontend no se comunica directamente con el Backend. Toda petición pasa por Nginx, que actúa como reverse proxy.

---

## 2. Flujo de Datos del Sensor

Cómo viaja una lectura desde el simulador hasta la base de datos (cada 10 minutos por nodo).

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant N as ⚡ Nginx
    participant B as 🐍 Backend (FastAPI)
    participant DB as 🗄️ MySQL

    S->>N: POST /api/v1/readings<br/>Header: X-API-Key: <key><br/>Body: JSON (3 categorías)
    N->>B: Proxy pass → :5050

    B->>B: Validar API Key
    alt API Key inválida
        B-->>N: 401 Unauthorized
        N-->>S: 401 Unauthorized
    end

    B->>B: Validar payload JSON
    Note right of B: ✅ timestamp (ISO 8601 UTC)<br/>✅ soil (4 campos)<br/>✅ irrigation (3 campos)<br/>✅ environmental (5 campos)<br/>⚠️ Campos null/0 = aceptados<br/>❌ NDVI = ignorado

    alt Payload inválido
        B-->>N: 400 Bad Request
        N-->>S: 400 Bad Request
    end

    B->>DB: INSERT lecturas (marca_tiempo, nodo_id, + 12 variables de estado)
    B-->>N: 201 Created
    N-->>S: 201 Created
```

**Payload JSON enviado por el simulador:**

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

> Campos no disponibles se envían como `0` o `null`. El `timestamp` es obligatorio. Datos estáticos (GPS, cultivo, tamaño) **no** van en el payload.

---

## 3. Flujos de Autenticación

El sistema maneja **dos mecanismos de autenticación distintos**: uno para usuarios humanos y otro para nodos IoT.

### 3.1 Usuarios (Admin / Cliente) — JWT

```mermaid
sequenceDiagram
    participant U as 🖥️ Browser
    participant N as ⚡ Nginx
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    U->>N: POST /api/v1/auth/login<br/>{email, password}
    N->>B: Proxy pass → :5050
    B->>DB: SELECT usuario WHERE email = ?
    B->>B: Verificar password (bcrypt hash)

    alt Credenciales válidas
        B->>DB: INSERT token_refresco
        B-->>N: 200 OK<br/>{access_token, refresh_token}
        N-->>U: 200 OK
        Note right of U: Almacena tokens<br/>en memoria/localStorage
    else Credenciales inválidas
        B-->>N: 401 Unauthorized
        N-->>U: 401 Unauthorized
    end

    Note over U,B: --- Peticiones subsecuentes ---

    U->>N: GET /api/v1/properties<br/>Authorization: Bearer <access_token>
    N->>B: Proxy pass
    B->>B: Validar JWT (firma + expiración)
    B-->>N: 200 OK (datos)
    N-->>U: 200 OK

    Note over U,B: --- Cuando expira el access_token ---

    U->>N: POST /api/v1/auth/refresh<br/>{refresh_token}
    N->>B: Proxy pass
    B->>DB: Validar refresh_token
    B-->>N: 200 OK<br/>{nuevo access_token}
    N-->>U: 200 OK
```


### 3.2 Recuperación de Contraseña

```mermaid
sequenceDiagram
    participant U as 🖥️ Browser
    participant N as ⚡ Nginx
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL
    participant E as 📧 Email

    U->>N: POST /api/v1/auth/forgot-password<br/>{email}
    N->>B: Proxy pass
    B->>DB: Verificar email existe
    B->>DB: INSERT token_recuperacion (hash, expira_en)
    B->>E: Enviar email con link y token en claro
    B-->>N: 200 OK (Mensaje genérico)
    N-->>U: 200 OK

    Note right of U: Usuario abre el link<br/>desde el correo
    U->>N: POST /api/v1/auth/reset-password<br/>{token, new_password}
    N->>B: Proxy pass
    B->>DB: Verificar token_hash, vigencia y no usado
    B->>B: Hashear nueva contraseña
    B->>DB: UPDATE usuario (nuevo hash)
    B->>DB: UPDATE token_recuperacion (usado_en)
    B-->>N: 200 OK
    N-->>U: 200 OK
```

### 3.3 Gateways Agro.io — credencial de predio

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant N as ⚡ Nginx
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    Note right of S: Credencial de gateway del predio<br/>+ X-Logical-Node-Id

    S->>N: POST /api/v1/readings<br/>X-API-Key + X-Logical-Node-Id + X-Event-ID
    N->>B: Proxy pass → :5050
    B->>DB: Validar hash de gateway y nodo autorizado

    alt Credencial válida
        B->>B: Asociar lectura al nodo lógico
        B->>DB: INSERT lectura + datos categorías
        B-->>N: 201 Created
        N-->>S: 201 Created
    else Credencial inválida
        B-->>N: 401 Unauthorized
        N-->>S: 401 Unauthorized
    end
```

**Comparativa rápida:**

| Aspecto | Usuarios (JWT) | Gateway Agro.io |
|---------|---------------|---------------------|
| Header | `Authorization: Bearer <token>` | `X-API-Key` (gateway) + `X-Logical-Node-Id` |
| Expiración | Access token expira (minutos), refresh renueva | Rotación/revocación de gateway |
| Flujo | Login → obtener tokens → enviar Bearer | Activación → credencial de predio |
| Permisos | CRUD completo según rol (Admin/Cliente) | Lecturas, heartbeat, config, NDVI |

---

## 4. Jerarquía de Entidades

Cómo se organizan los datos del sistema de arriba hacia abajo. Esta jerarquía **define los permisos**: un Cliente solo ve lo que cuelga debajo de él.
```mermaid
graph TD
    U["👤 Usuario<br/>(Admin o Cliente)"]
    C["🏢 Cliente<br/>ej: Agrícola López S.A."]
    P["🏡 Predio<br/>ej: Rancho Norte"]
    AR["🌱 Área de Riego<br/>ej: Nogal Norte — 15.5 ha"]
    TC["📋 Tipo de Cultivo<br/>(catálogo administrable)<br/>ej: Nogal"]
    CC["📅 Ciclo de Cultivo<br/>ej: 2026-02-01 → ..."]
    ND["📡 Nodo IoT<br/>(relación 1:1 con Área)<br/>GPS: lat/lon"]
    UM["⚖️ Umbral<br/>ej: Humedad < 20%"]
    AL["🚨 Alerta<br/>ej: Alerta Humedad Baja"]
    PN["🔔 Preferencia Notificación<br/>ej: Enviar SMS a Juan"]

    U -->|"1:1 (si rol=cliente)"| C
    C -->|"1:N"| P
    P -->|"1:N"| AR
    TC -->|"1:N"| AR
    AR -->|"1:N"| CC
    AR -->|"1:1"| ND
    AR -->|"1:N"| UM
    AR -->|"1:N"| PN
    UM -->|"1:N"| AL
    ND -->|"1:N"| AL
    ND -->|"1:N"| L["📊 Lecturas<br/>144/día"]

    style U fill:#e3f2fd,stroke:#1565c0,color:#000
    style C fill:#bbdefb,stroke:#1565c0,color:#000
    style P fill:#c8e6c9,stroke:#2e7d32,color:#000
    style AR fill:#a5d6a7,stroke:#2e7d32,color:#000
    style TC fill:#fff9c4,stroke:#f9a825,color:#000
    style CC fill:#ffe0b2,stroke:#e65100,color:#000
    style ND fill:#e1bee7,stroke:#6a1b9a,color:#000
    style L fill:#f8bbd0,stroke:#880e4f,color:#000
    style UM fill:#ffccbc,stroke:#e64a19,color:#000
    style AL fill:#ffcdd2,stroke:#d32f2f,color:#000
    style PN fill:#d1c4e9,stroke:#7b1fa2,color:#000
```

**Reglas clave:**
- El **Admin** puede ver y gestionar todo (CRUD completo).
- El **Cliente** solo accede a sus propios predios, áreas y lecturas; además puede gestionar umbrales y preferencias de notificación dentro de su ownership.
- Cada Área de Riego tiene **exactamente 1 Nodo** (relación 1:1).
- Cada Área puede tener **múltiples Ciclos de Cultivo** (historial de temporadas), pero solo **1 activo** a la vez.
- El **catálogo de tipos de cultivo** es administrable por el Admin. Valores iniciales: Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón.

---

## 5. Stack Tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Frontend** | React (SPA) | Interfaz web. Build estático servido por Nginx. Dashboard, histórico, exportación. |
| **Backend** | Python 3.11+ / FastAPI / Uvicorn | API REST. Recibe lecturas de sensores + atiende CRUD del frontend. Async. |
| **Base de Datos** | MySQL 8 | Almacenamiento relacional. 14 tablas activas en el estado actual. ORM: SQLAlchemy. Migraciones: Alembic. |
| **Reverse Proxy** | Nginx | Punto de entrada público. SSL termination. Rutea `/` → frontend, `/api/v1/*` → backend. |
| **Contenedores** | Docker + Docker Compose | Orquestación de Frontend+Nginx, Backend, MySQL y schedulers opcionales para inactividad/notificaciones en la VPS. |
| **Servidor** | VPS Linux ("Servidor Grogu") | Infraestructura. Puertos expuestos: 80, 443. Internos: 5050, 3306. |

**Convenciones del API:**
- URLs en **inglés**, plural, versionadas: `/api/v1/clients`, `/api/v1/properties`, `/api/v1/readings`
- Paginación obligatoria en listados: `?page=1&per_page=50`
- Filtros de fecha: `?start_date=2026-01-01&end_date=2026-01-31`
- Exportación: `GET /api/v1/readings/export?format=csv|xlsx|pdf`

---

## 6. Decisiones de Arquitectura: Docker y Deployment

El sistema ha sido estructurado para un despliegue moderno, ligero y seguro utilizando contenedores y un orquestador estilo PaaS (Dokploy).

### 6.1 Desacoplamiento de Servicios
En lugar de tener un servidor monolítico, la arquitectura divide las responsabilidades en 3 contenedores aislados:
1. **Base de Datos (MySQL):** Aislada de la lógica de negocio. Sus datos persisten en un "Volume" independiente, garantizando que el contenedor pueda ser destruido o actualizado sin pérdida temporal ni permanente de las lecturas de los sensores.
2. **Backend (FastAPI):** Se encarga únicamente del cálculo, ingesta de datos y consultas a la BD. Delega el alojamiento de páginas web a Nginx. Usa `uv` en su build para una gestión de dependencias estricta y extremadamente rápida.
3. **Frontend (React + Nginx Interno):** Dedicado en exclusiva a servir la interfaz de usuario.

### 6.2 Multi-stage Build del Frontend (React -> Nginx)
Una de las decisiones clave de optimización fue el uso de un patrón "Multi-stage" en el `Dockerfile` del Frontend.

En desarrollo habitual utilizamos Node.js (`npm run dev`), pero en producción esto es ineficiente y expone una superficie de ataque. La arquitectura establece que:
- **Stage 1 (Construcción):** Un contenedor temporal levanta Node.js, descarga las librerías NPM, transpila React/TypeScript y genera los activos puros estáticos (Paso de empaquetado).
- **Stage 2 (Servicio):** El contenedor final **descarta** Node.js. En su lugar, utiliza un servidor **Nginx base de 30MB** al que se le copian solo los archivos estáticos resultantes.
- **Por qué:** Nginx es nativamente más rápido, requiere de ~10MB de RAM (contra los ~300MB de un framework JS en ejecución), reduce enormemente el tamaño de la imagen Docker final y blinda el código fuente original.

### 6.3 Routing y Proxy a través de Traefik (Dokploy)
Se confió la entrada pública del tráfico a **Traefik**, integrado naturalmente por el gestor de VPS, Dokploy.

- **Por qué Traefik sobre Nginx perimetral manual:** Traefik ofrece "Service Discovery". En lugar de cablear las rutas manualmente en un archivo complejo, los contenedores declaran sus rutas como "etiquetas" (labels) en el archivo `docker-compose.yml`. Al arrancar, Traefik lee estas etiquetas y auto-configura el ruteo.
- **Let's Encrypt nativo:** Traefik intercepta el dominio asignado y genera un certificado SSL HTTPS en el acto antes de que el tráfico toque nuestros contenedores, haciendo innecesaria una configuración criptográfica en FastAPI o en el Frontend.
- Todas las peticiones al dominio raíz son derivadas al **Paso 6.2 (Frontend/Nginx estático)**, excepto si la URL contiene el bloque `/api/*`, en cuyo caso es derivada directamente al puerto 5050 del **Paso 6.1 (Backend/FastAPI)**.

---
---

## 7. Extensión de Arquitectura: Fase 2 Lite y Fase 2 Completa

Esta sección separa lo que ya está activo en el sistema de lo que continúa como roadmap.

### 7.1 Estado Actual: MVP Extendido (Fase 2 Lite) — Finalizado

Componentes activos a la fecha:

- Tablas activas en base de datos: `umbrales`, `alertas`, `audit_log`, `preferencias_notificacion`.
- Endpoints activos: `/api/v1/thresholds`, `/api/v1/alerts`, `/api/v1/alerts/unread-count`, `/api/v1/alerts/scan-inactivity`, `/api/v1/alerts/dispatch-notifications`, `/api/v1/notification-preferences`, `/api/v1/clients/me/notification-settings`, `/api/v1/audit-logs`, `/api/v1/readings/priority-status`.
- Endpoint activo para despacho: `/api/v1/alerts/dispatch-notifications` (Admin).
- Política de despacho activa por preferencias configurables de cliente/área/tipo/severidad/canal.
- Evaluación de umbrales durante la ingesta de `POST /api/v1/readings`.
- Escaneo periódico de inactividad con `inactivity_scheduler` en Docker Compose.
- Despacho periódico opcional de notificaciones con `notification_scheduler` en Docker Compose.
- Visualización en frontend: campana de notificaciones, centro de alertas, vista administrativa de auditoría, gestión de umbrales y configuración de preferencias de notificación en cliente.
- Semáforos de prioridad en dashboard cliente para humedad de suelo, flujo y ETO.

```mermaid
graph TD
    subgraph INTERNET["🌐 Internet"]
        Browser["🖥️ Browser<br/>(Admin / Cliente)"]
        Simulator["📡 Simulador<br/>(PC Local)"]
    end

    subgraph VPS["🐸 VPS Linux — Servidor Grogu<br/>Docker Compose"]
        Nginx["⚡ Nginx / Traefik"]
        Frontend["⚛️ React SPA<br/>Alertas UI"]
        Backend["🐍 FastAPI :5050<br/>Threshold Engine"]
        Scheduler["⏰ inactivity_scheduler<br/>scan-inactivity"]
        MySQL["🗄️ MySQL 8<br/>umbrales + alertas + audit_log"]
    end

    Browser -->|HTTPS| Nginx
    Simulator -->|POST /api/v1/readings<br/>X-API-Key| Nginx
    Nginx --> Frontend
    Nginx -->|/api/v1/*| Backend
    Backend --> MySQL
    Scheduler -->|POST /api/v1/alerts/scan-inactivity| Backend
```

### 7.2 Flujo Activo: Lectura -> Evaluación -> Alerta

```mermaid
sequenceDiagram
    participant S as 📡 Simulador
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    S->>B: POST /api/v1/readings (X-API-Key)
    B->>DB: INSERT lectura
    B->>DB: SELECT umbrales del area

    alt Valor fuera de rango
        B->>DB: INSERT alerta tipo=threshold
    end

    B-->>S: 201 Created
```

### 7.3 Flujo Activo: Inactividad de Nodo

```mermaid
sequenceDiagram
    participant SCH as ⏰ Scheduler
    participant B as 🐍 Backend
    participant DB as 🗄️ MySQL

    SCH->>B: POST /api/v1/alerts/scan-inactivity
    B->>DB: Buscar nodos sin datos >= 20 min

    alt Nodo inactivo sin alerta vigente
        B->>DB: INSERT alerta tipo=inactivity
    end

    B-->>SCH: Resumen de escaneo
```

### 7.4 Fase 2 Completa (En Ejecución)

Estado actual de Fase 2 Completa:

- Sprint 1 geoespacial base completado.
- Endpoint `GET /api/v1/nodes/geo` activo con ownership por rol y filtros jerárquicos.
- UI de mapas activa para Cliente (`/cliente/mapa`) y Admin (`/admin/mapa`).
- Mapa admin con clustering y capas por estado de frescura.
- Carga diferida y prefetch condicional de rutas geoespaciales en frontend.

Funcionalidades que permanecen en roadmap y no forman parte de la implementación activa final:

- Integración de IA conversacional con Azure OpenAI.
- Automatización asíncrona con n8n.
- Visualización geoespacial avanzada en mapas.

### 7.5 Checklist de Estado

#### Implementado (Fase 2 Lite)
- [x] Migración y uso de tablas `umbrales`, `alertas`, `audit_log`.
- [x] CRUD de umbrales (Admin/Cliente con ownership por área).
- [x] Listado/detalle/marcado de alertas (Admin/Cliente por ownership).
- [x] Escaneo de inactividad (`/api/v1/alerts/scan-inactivity`) y scheduler en compose.
- [x] Despacho de notificaciones de alertas (`/api/v1/alerts/dispatch-notifications`) por backend directo.
- [x] Integración externa configurable: SMTP (email) y WhatsApp Cloud API.
- [x] Preferencias de notificación por cliente/área/severidad/canal (`/api/v1/notification-preferences`) y switch global (`/api/v1/clients/me/notification-settings`).
- [x] Recuperación de contraseña por correo (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`) con token temporal de un solo uso.
- [x] UI de alertas (popover + centro de alertas).
- [x] Endpoint y vista de auditoría administrativa (`/api/v1/audit-logs`, `/admin/auditoria`).
- [x] UI de umbrales para Admin y Cliente (`/admin/umbrales`, `/cliente/umbrales`).
- [x] Semáforos visuales de umbral en dashboard cliente (parámetros prioritarios).

#### Pendiente (Fase 2 Completa)
- [ ] Sprint 2: NDVI (ingesta, histórico y exportación).
- [ ] Sprint 3: Notificaciones avanzadas (horarios y ventanas de silencio).
- [ ] Sprint 4: Analítica asíncrona (n8n + Azure OpenAI).
- [ ] Sprint 5: Asistente conversacional (Azure OpenAI).
