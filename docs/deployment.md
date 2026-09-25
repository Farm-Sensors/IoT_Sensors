# Greenfield Dokploy acceptance deployment

The first IoT_Sensors installation is a **pre-release acceptance deployment**. No production deployment, live users, or production data exist beforehand. Alan (Integrator) owns its Dokploy setup and CD and may designate this same stack as production only after all acceptance evidence is recorded and manually signed off. A separate staging stack is safer optional isolation, not a hard blocker.

This guide does not contain secret values. Alan coordinates environment and secret configuration in Dokploy without copying values into repositories, issues, fixtures, logs, or documentation.

## 1. Pre-deployment gates

- Deploy accepted refs from `main` only after required PR checks and contract parity pass.
- Record the canonical edge-cloud contract ref and prove its JSON files are byte-identical to Agro.io's vendored copy.
- Use a new empty MySQL database and coordinate a clean `alembic upgrade head` proof before admitting application data.
- Prepare the `Client → Property → Irrigation Area → Crop Type + IoT Node (1:1)` mappings and node API keys without exposing key values.
- Keep full Agro.io/Avalonia/systemd off the VPS. CI or an ephemeral headless harness may simulate the edge path; ARM64 Raspberry remains the real device target.
- Agro.io has no Dokploy or VPS CD path. Alan's deployment authority here applies only to IoT_Sensors.

## 2. Dokploy application

| Setting | Acceptance value |
|---|---|
| Project type | Compose |
| Repository | `Alanzphy/IoT_Sensors` |
| Branch | `main` |
| Compose path | `docker-compose.yml` |
| Deployment state | Pre-release until manual sign-off |

Configure the deployment-specific domain and URL values (`DOMAIN`, `FRONTEND_PUBLIC_URL`, and `PASSWORD_RESET_URL_BASE`), strong application/database credentials, and loopback port bindings. Do not publish MySQL or backend ports directly; Traefik/Dokploy owns public routing and TLS.

## 2.1 Continuous delivery (IoT_Sensors only)

Trigger from an accepted `main` ref only. Record the image and git ref. Rollback is redeploying the previous accepted `main` ref. There is no automatic production promotion.

1. Deploy only a `main` ref that already passed required PR checks and contract parity.
2. Record the deployed image digest/tag and git SHA before smoke.
3. Run `scripts/dokploy_smoke_check.sh <domain>`. HTTPS `/health` must be exactly `{"status":"ok"}` (optional whitespace allowed). Docs and frontend checks stay required. A 2xx SPA HTML body is a failure.
4. Keep weather off until commercial Open-Meteo credentials exist in Dokploy secrets (`OPEN_METEO_ENABLED=false`, empty API key). Never store that key in the repo.
5. After smoke, the stack remains pre-release until the manual sign-off in section 6.

Agro.io has no Dokploy or VPS CD path.

## 3. MVP feature flags

The acceptance deployment runs the MVP only. These controlling gates must remain off:

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

`.env.docker.example` could not be updated in this unit: agent `.env*` permissions deny read/write. Compose pass-through defaults match these MVP-off gates, including Open-Meteo disabled with an empty API key. Align that example file later with filesystem access; do not put commercial keys in the repository.

Do not start Compose with the `phase2` profile. A normal Compose deployment starts only the MVP services:

- `mysql`
- `backend`
- `frontend`

The `inactivity_scheduler`, `notification_scheduler`, and `ai_report_scheduler` services run only through `docker compose --profile phase2 up` and are not part of MVP acceptance. Their credentials and provider settings are unnecessary while the profile and controlling gates remain off.

## 4. Fresh-database migration gate

The historical flatten migration drops old category tables, but this confirmed greenfield installation has no existing database or production data to preserve. The current acceptance requirement is therefore:

1. Start from an empty acceptance database.
2. Run `alembic upgrade head` through the approved deployment procedure.
3. Record the command, exit result, resulting Alembic revision, and absence of pre-existing application rows.
4. Confirm the application can create and read the expected hierarchy and one contract-valid telemetry event.

After go-live, this greenfield exception ends. Future migrations must preserve existing data, avoid destructive drop/rewrite behavior without an approved copy-and-verify path, and include backup, rollback/recovery, and row-count evidence.

## 5. Acceptance checks

Alan records exact refs, commands, response codes, counts, and observed results:

- `/health` returns `{"status":"ok"}` over HTTPS.
- `/api/v1/docs` and the frontend load over HTTPS through Traefik.
- JWT user access and gateway `X-API-Key` ingestion remain separate authentication boundaries.
- Nested reading JSON contains `soil`, `irrigation`, and `environmental` with exactly 12 dynamic fields and uppercase UTC `Z` timestamps.
- The same node/endpoint/`X-Event-ID` and body produces one canonical MySQL row; the same ID with a different body returns `409` without mutation.
- One-node, 8-node, and 16-node harness counts reconcile. The 16-node run includes a forced HTTPS failure and same-ID retry.
- Latest/history/export/freshness/dashboard use canonical cloud data.
- Phase 2, notification, and AI gates are false; no `phase2` scheduler service is running.
- Latest point NDVI, if included in acceptance, uses its separate event/storage path with Sentinel-2 provenance and never appears in telemetry.

Central weather and latest point NDVI are independent lanes. They do not block core telemetry, and they cannot replace a failed core E2E gate.

## 6. Manual production designation

Until manual sign-off, label the stack and all evidence **pre-release acceptance** and admit no client traffic or production data. After all required gates pass, Alan records the accepted refs and time of sign-off, then may designate the same stack as production. If acceptance fails, keep it pre-release, correct the bounded work unit, and repeat only the affected evidence gate.
