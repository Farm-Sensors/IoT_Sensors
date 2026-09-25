# Operación (Demo, Simulador, Schedulers, Scripts)

> Guía operativa: demo reproducible, simulador, ubicaciones del socio, schedulers de Fase 2, scripts de mantenimiento. El despliegue en producción está en `docs/deployment.md`.

## 1. Modelado de ubicaciones del socio (sin fallback)

Script idempotente para crear la estructura real del socio en el cliente `alan2203mx@gmail.com`:

- Predio `Granja Hogar` + área `Area Granja Hogar` + `Nodo Granja Hogar`
- Predio `Campus Reforestado` + área `Area Campus Reforestado` + `Nodo Campus Reforestado`
- Renombra estructura legado a `DEMO - ...` (sin cambios de esquema)
- Clona lecturas y umbrales desde el área demo fuente (`DEMO - Nogal Norte` por default)
- Opcional: clona preferencias de notificación si pasas password del cliente

```bash
# Local
python3 scripts/setup_partner_locations.py \
  --base-url http://localhost:5050/api/v1 \
  --admin-email admin@sensores.com \
  --admin-password admin123 \
  --write-keys-file simulator/keys_partner_local.txt

# VPS
python3 scripts/setup_partner_locations.py \
  --base-url https://sensores.alanrz.bond/api/v1 \
  --admin-email admin@sensores.com \
  --admin-password TU_PASSWORD \
  --client-password PASSWORD_CLIENTE_ALAN \
  --write-keys-file simulator/keys_partner_vps.txt

# Con otra área demo como fuente
python3 scripts/setup_partner_locations.py \
  --base-url https://sensores.alanrz.bond/api/v1 \
  --admin-email admin@sensores.com \
  --admin-password TU_PASSWORD \
  --source-demo-area-name "DEMO - Alfalfa Este"
```

Luego usa esas keys en el simulador:

```bash
cd simulator
python3 simulator_fast.py --api-keys-file ./keys_partner_local.txt --mode demo-alerts --interval 2
```

## 2. Simulador IoT

Requiere credencial de gateway y nodo lógico (ver [`simulator/README.md`](../simulator/README.md)):

```bash
cd simulator
python3 simulator.py --gateway-key gk_... --logical-node-id 12

python3 simulator.py --gateway-key gk_... --logical-node-id 12 --interval 30

python3 simulator.py --gateway-key gk_... --logical-node-id 12 --backfill 7
```

La key del ejemplo corresponde al **Nodo Granja Hogar**, vinculado a `alan2203mx@gmail.com`.

## 3. Demo Rápida (Reproducible)

Deja el entorno listo con datos históricos coherentes + umbrales + simulación en vivo.

### Opción A — Un solo comando (seed clásico)

Ejecuta: 1) `app.db.seed` (usuarios/predios/áreas/nodos) + 2) `app.db.demo_seed run-all` (snapshot + purga + recarga 30 días + umbrales).

```bash
cd backend
DEBUG=true uv run python -m app.db.seed_demo
# o desde raíz: make demo-seed
```

Por defecto carga el dataset demo para `alan2203mx@gmail.com`.

### Opción B — Demo sobre otro cliente local

```bash
cd backend
DEBUG=true uv run python -m app.db.seed_demo \
  --skip-base-seed \
  --client-email tu_cliente@dominio.com \
  --days 30 \
  --seed 20260423
```

Notas: excluye áreas sin nodo activo; solo toca datos dinámicos del cliente (lecturas/alertas/umbrales); conserva entidades estáticas y `notification_preferences`.

### Orden seguro de purga (si se hace manual)

1. Resolver IDs reales: `user → client → properties → irrigation_areas → nodes`.
2. Eliminar alertas del cliente (por `area_riego_id` y/o `nodo_id`).
3. Eliminar lecturas del cliente (por `nodo_id`).
4. Limpiar preferencias de notificación solo si se requiere reset completo.
5. Limpiar umbrales previos (respetando la convención de soft delete).
6. Validar conteos en cero antes de recargar.

Preflight obligatorio: confirmar usuario objetivo, lista de áreas/nodos activos, snapshot de conteos y min/max timestamps, timestamps en UTC. Nunca tocar datos de otros clientes.

### Simulación en vivo (multi-nodo)

```bash
cd simulator
python3 simulator_fast.py --quick-demo     # o desde raíz: make demo-live
```

`--quick-demo` activa: preset de 4 nodos del seed local, modo `demo-alerts`, despacho periódico de notificaciones, trigger de reporte IA semanal (ventana 7 días), credenciales admin locales (`admin@sensores.com` / `admin123`).

Alternativas:

```bash
# Breaches visibles de umbral en dashboard/alertas:
python3 simulator_fast.py --preset seed-demo --mode demo-alerts --demo-spike-every 6 --interval 2

# Demo ejecutiva de ubicaciones productivas del socio:
python3 simulator_fast.py --preset partner-socio --mode demo-alerts --interval 2
```

### Trigger manual del Reporte IA semanal

```bash
cd simulator
python3 simulator_fast.py \
  --api-keys-file ./keys.txt \
  --mode demo-alerts \
  --interval 2 \
  --ai-weekly-report \
  --ai-weekly-report-force \
  --ai-weekly-report-days 7 \
  --ai-weekly-report-initial-delay 30 \
  --ai-weekly-report-interval 120 \
  --admin-email admin@sensores.com \
  --admin-password admin123
```

Opcional para reducir scope: `--ai-weekly-report-client-id <ID>` y `--ai-weekly-report-irrigation-area-id <ID>`.

### Checklist demo completa

1. `make demo-seed`.
2. Iniciar backend y frontend.
3. `simulator_fast.py` con las 4 API keys.
4. Dashboard/centro de alertas: aumentan lecturas y alertas.
5. Alertas de umbral en ingesta: `ALERTS_ENABLED=true` en `backend/.env`.
6. Correo/WhatsApp: `NOTIFICATIONS_ENABLED=true`, `NOTIFICATIONS_EMAIL_ENABLED=true`, `NOTIFICATIONS_WHATSAPP_ENABLED=true` + credenciales SMTP/WhatsApp.
7. Reporte IA semanal: `AI_REPORTS_ENABLED=true` (si no, `POST /ai-reports/generate` responde 503).
8. Despacho manual sin `--quick-demo`:

```bash
# 1) Login admin (copia el access_token)
curl -s http://localhost:5050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sensores.com","password":"admin123"}'

# 2) Despachar notificaciones pendientes
curl -X POST "http://localhost:5050/api/v1/alerts/dispatch-notifications?limit=200&only_unread=true" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

### Misma demo en otra PC (reproducible)

```bash
git clone <URL_DEL_REPO> && cd <repo>
docker compose up -d mysql
cd backend && cp .env.example .env && uv sync && uv run alembic upgrade head
DEBUG=true uv run python -m app.db.seed_demo
```

Luego levantas frontend y corres `simulator_fast.py`.

### Troubleshooting

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `Access denied for user 'root'` | Falta el `.env` o `DB_PASSWORD` vacío | Ejecutar el **Paso 0** de setup local |
| `Can't connect to MySQL server` | Contenedor MySQL no listo | Esperar ~10s y reintentar, o `docker compose logs mysql` |
| `Connection refused` (localhost) | Problema de socket en Windows/WSL | `DB_HOST=localhost` → `DB_HOST=127.0.0.1` en `.env` |
| `500` en `/api/v1/alerts` o `/api/v1/thresholds` | Esquema desactualizado | `cd backend && uv run alembic upgrade head` |

## 4. Schedulers de Fase 2 (dormant, profile `phase2`)

Los 3 schedulers viven detrás del profile `phase2` de compose: no arrancan con `docker compose up` normal; se activan con `docker compose --profile phase2 up -d`. La generación de alertas de umbral en ingesta requiere `ALERTS_ENABLED=true`.

### Inactivity

`inactivity_scheduler` ejecuta periódicamente `POST /api/v1/alerts/scan-inactivity` (alertas por nodos inactivos).

Variables: `SCHEDULER_ADMIN_EMAIL`, `SCHEDULER_ADMIN_PASSWORD`, `INACTIVITY_SCAN_INTERVAL_SECONDS` (recomendado `300`), `INACTIVITY_SCAN_MINUTES` (default `20`).

### Notificaciones

`notification_scheduler` ejecuta `POST /api/v1/alerts/dispatch-notifications`.

Variables: `NOTIFICATIONS_ENABLED`, `NOTIFICATIONS_EMAIL_ENABLED`, `NOTIFICATIONS_WHATSAPP_ENABLED`, `FRONTEND_PUBLIC_URL` (links de WhatsApp), `SMTP_*`, `WHATSAPP_PROVIDER` (`meta`|`twilio`), `WHATSAPP_MESSAGE_MODE` (`text`|`template`), Meta (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE_CODE`), Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_CONTENT_SID`, `TWILIO_WHATSAPP_FROM`/`TWILIO_MESSAGING_SERVICE_SID`), `NOTIFICATION_DISPATCH_INTERVAL_SECONDS` (recomendado `300`), `NOTIFICATION_DISPATCH_LIMIT` (default `200`), `NOTIFICATION_DISPATCH_ONLY_UNREAD`.

Implementación **backend directo** (sin n8n): Email vía SMTP (compatible Gmail con app password); WhatsApp con proveedor intercambiable y templates aprobados.

**WhatsApp con link a recomendación:** las alertas con WhatsApp habilitado envían un template con link al detalle (`/cliente/alertas/:alertId` o `/admin/alertas/:alertId`). Para pruebas locales con celular, no uses `localhost` en `FRONTEND_PUBLIC_URL`; expón el frontend con un túnel HTTPS:

```bash
cd frontend
VITE_API_BASE_URL=/api/v1 npm run dev -- --host 0.0.0.0
# En otra terminal: ngrok http 5173
```

Y en `backend/.env`: `FRONTEND_PUBLIC_URL=https://tu-tunnel.ngrok-free.app`, `WHATSAPP_PROVIDER=twilio`, `WHATSAPP_MESSAGE_MODE=text`. En Dokploy usa el dominio real (mismo patrón con proxy Vite/Nginx/Traefik).

### Reportes IA

`ai_report_scheduler` ejecuta `POST /api/v1/ai-reports/generate` una vez al día en horario UTC configurable. Requiere profile `phase2` y `AI_REPORTS_SCHEDULER_ENABLED=true`.

Endpoints: `GET /api/v1/ai-reports`, `GET /api/v1/ai-reports/{id}`, `POST /api/v1/ai-reports/generate` (admin/scheduler).

Variables: `AI_REPORTS_ENABLED`, `AI_REPORTS_DEFAULT_NOTIFY`, `AI_REPORTS_SCHEDULER_ENABLED`, `AI_REPORTS_SCHEDULER_POLL_SECONDS` (60), `AI_REPORTS_SCHEDULE_HOUR_UTC` (2), `AI_REPORTS_SCHEDULE_MINUTE_UTC` (0), `AI_REPORTS_HTTP_TIMEOUT_SECONDS` (30).

Azure OpenAI (opcional): `AZURE_OPENAI_ENABLED`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_TEMPERATURE`, `AZURE_OPENAI_MAX_TOKENS`, `AZURE_OPENAI_TIMEOUT_SECONDS`. Con `AZURE_OPENAI_ENABLED=false` el backend usa un **fallback determinístico** (resumen/hallazgos/recomendación) y el flujo operativo no se rompe.

## 5. Asistente Conversacional IA

> **Dormant por defecto:** requiere `AI_ASSISTANT_ENABLED=true` (default `false`); apagado, `POST /api/v1/ai-assistant/chat` responde 503.

- Endpoint: `POST /api/v1/ai-assistant/chat` · Vistas: `/cliente/asistente-ia`, `/admin/asistente-ia`.
- Capacidades: respuesta en lenguaje natural con contexto real (áreas, lecturas, alertas, frescura, reportes recientes), fallback operativo sin Azure, widgets dinámicos (`kpi_cards`, `table`, `line_chart`).
- Guardrails: rate limit por usuario (`AI_ASSISTANT_RATE_LIMIT_WINDOW_MINUTES`, `AI_ASSISTANT_RATE_LIMIT_MAX_REQUESTS`); límites de contexto (`AI_ASSISTANT_MAX_AREAS`, `AI_ASSISTANT_MAX_ALERTS`, `AI_ASSISTANT_MAX_HISTORY_MESSAGES`).
- Observabilidad: `GET /api/v1/ai-assistant/usage` + vista `/admin/consumo-ia`; por request se registra `source`, `provider`, `model`, `tokens_prompt`, `tokens_completion`, `latency_ms`, `status_code`.

## 6. Scripts de mantenimiento

- **Sincronizar OpenAPI** (contrato runtime → archivos): `./scripts/sync_openapi.sh` o `make openapi-sync` (URL por defecto `http://127.0.0.1:5050/api/v1/openapi.json`; override con `OPENAPI_URL`).
- **Upsert de umbrales del socio** (para que `demo-alerts` dispare consistentemente en Granja Hogar / Campus Reforestado): `./scripts/upsert_partner_thresholds.py` (vía API admin).
- **Smoke backend** (incluye check multi-tenant): `./scripts/smoke_backend.sh` con `CLIENT_EMAIL`, `CLIENT_PASSWORD`, `CLIENT_FOREIGN_AREA_ID` (debe dar 403), `CLIENT_OWN_AREA_ID` (200).
- **Smoke post-deploy**: `./scripts/dokploy_smoke_check.sh <tu-dominio>`.
- **Smoke IA reports** (login + generate + list + detail): `./scripts/smoke_ai_reports.sh --base-url https://sensores.alanrz.bond --admin-password 'TU_PASSWORD'`.
- **Sync BD local → VPS** (con backup remoto): `./scripts/sync_db_to_vps.sh --ssh usuario@vps --remote-db-pass 'PASSWORD_VPS' --yes`.