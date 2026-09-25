# Greenfield Dokploy acceptance deployment

The first IoT_Sensors installation is a **pre-release acceptance stack**. No production users or production data exist beforehand. Dokploy deploys **only this cloud**. Agro.io stays on each Raspberry, or a headless harness, and calls this stack over HTTPS. Alan owns the Dokploy setup and may call the same stack production only after the sign-off in section 6.

How the system works: `docs/system.md`. Wire contract: `contracts/edge-cloud/v2/`. This guide has no secret values. Put credentials only in Dokploy.

## Quick path

1. In Dokploy, create a Compose app from `Farm-Sensors/IoT_Sensors`, branch `main`, compose file `docker-compose.yml`.
2. Set `DOMAIN`, `SECRET_KEY`, `DB_PASSWORD`, `FRONTEND_PUBLIC_URL`, and `PASSWORD_RESET_URL_BASE`. Leave Phase 2 flags off. Do not publish MySQL or the backend port.
3. Deploy `main`. The backend container runs `alembic upgrade head` before Uvicorn. Use an empty database.
4. Run `scripts/dokploy_smoke_check.sh <domain>`. HTTPS `/health` must be `{"status":"ok"}`.
5. In the admin UI, create the hierarchy and one gateway per property. Node API keys do not authenticate.
6. Point each sender at `https://<domain>`. Dokploy does not start those senders.

Several Raspberries means several properties, each with one gateway. One property never has two gateways.

## What this deploy does not do

- It does not install Agro.io, LoRa, or a Raspberry image.
- It does not create clients, properties, or readings by itself.
- It does not enable a dual-auth window. After this stack is up, ingest is gateway-only.
- It is not production until section 6.

## 1. Dokploy application

| Setting | Acceptance value |
|---|---|
| Project type | Compose |
| Repository | `Farm-Sensors/IoT_Sensors` |
| Branch | `main` |
| Compose path | `docker-compose.yml` |
| Public host | `DOMAIN` (Traefik label default is `sensores.alanrz.bond` if unset) |
| State | Pre-release until manual sign-off |

Traefik on the `dokploy-network` routes the host to the frontend container. That container proxies `/health` and `/api/` to the backend. Do not bind MySQL (`MYSQL_PORT_BIND`) or the backend (`BACKEND_PORT_BIND`) on a public address.

Set these in Dokploy, not in the repo:

| Variable | Test value |
|---|---|
| `DOMAIN` | The acceptance hostname |
| `FRONTEND_PUBLIC_URL` | `https://<domain>` |
| `PASSWORD_RESET_URL_BASE` | `https://<domain>/restablecer-contrasena` |
| `SECRET_KEY` | A long random value. Do not keep the compose default |
| `DB_PASSWORD` | A strong database password. Do not keep `rootpass` |
| `DB_NAME` | `sensores_riego` unless you change it on purpose |

## 2. Flags

Do not start Compose with `--profile phase2`. A normal deploy starts only `mysql`, `backend`, and `frontend`.

```env
DEBUG=false
ALERTS_ENABLED=false
NOTIFICATIONS_ENABLED=false
NOTIFICATIONS_EMAIL_ENABLED=false
NOTIFICATIONS_WHATSAPP_ENABLED=false
AI_ASSISTANT_ENABLED=false
AI_REPORTS_ENABLED=false
AI_REPORTS_DEFAULT_NOTIFY=false
AI_REPORTS_SCHEDULER_ENABLED=false
AI_ALERT_RECOMMENDATIONS_ENABLED=false
AZURE_OPENAI_ENABLED=false
OPEN_METEO_ENABLED=false
OPEN_METEO_API_KEY=
```

Weather stays off until a commercial Open-Meteo key exists in Dokploy secrets. Never store that key in the repo.

## 3. Database

This installation is greenfield. There is no production database to preserve.

1. Start from an empty MySQL 8 volume.
2. Deploy. `backend/Dockerfile` runs `alembic upgrade head` and then Uvicorn.
3. Record the git SHA, the Alembic revision, and that the database had no application rows before the first admin login.
4. If the backend stays unhealthy, read its logs before redeploying. Do not point this stack at an old database.

Gateway tables come from the `e29a*` migrations already on `main`. After go-live, later migrations must preserve data. This empty-database exception ends at sign-off.

## 4. Prove the pair before calling it ready

Cloud code on `main` is enough to boot the stack. It is not proof that a Raspberry build matches it.

Compare `contracts/edge-cloud/v2/` on the deployed git SHA with `contracts/iot-sensors/v2/` on Agro.io `integration/iot-v2`. The JSON files must be byte-identical. A local copy is not a cutover. Agro.io has no Dokploy path.

## 5. Senders

Dokploy does not run the edge. After smoke and an admin login, create client, property, irrigation area, logical node, and a one-time activation reference. Each additional Raspberry is another property and another gateway.

| Sender | Where it runs | Identity |
|---|---|---|
| Agro.io `integration/iot-v2` | Raspberry, or a headless harness | Activates with `ar_…`, then sends `X-API-Key: gk_…` |
| `simulator/simulator.py` | Any machine that can reach the domain | `--gateway-key` and `--logical-node-id`. `--api-key` is rejected |

Telemetry is `POST /api/v1/readings` with `X-Logical-Node-Id` and `X-Event-ID`. The same gateway, logical node, event id, and body returns `200`. The same id with a different body returns `409`. NDVI, if tested, is `POST /api/v1/ndvi-snapshots` and never a telemetry field.

## 6. Checks

Record the deployed SHA, the domain, and the observed results.

Required before using the stack as a test target:

- `/health` returns `{"status":"ok"}` over HTTPS.
- `/api/v1/docs` and the frontend load over HTTPS.
- JWT login and gateway `X-API-Key` stay separate.
- Phase 2 services are not running.

Required before calling the stack production:

- One contract-valid reading lands in MySQL and appears in latest, history, and the dashboard.
- Idempotency behaves as in section 5.
- Latest-point NDVI, if included, uses its own event and storage.
- Contract files match the Agro.io ref you will run.
- Alan records the accepted refs and the sign-off time.

The 1-node, 8-node, and 16-node harness counts are sign-off evidence, not a requirement to boot Dokploy. Weather and NDVI do not block core telemetry, and they do not replace a failed core check.

## 7. Rollback

Rollback is redeploying the previous `main` SHA. There is no automatic production promotion. If acceptance fails, keep the label **pre-release**, fix the bounded change, and repeat only the failed check.
