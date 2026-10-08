# Gateway v2 cutover and rollback runbook

This runbook is operational documentation only. It does not authorize production cutover.

## Switch and verification

1. Confirm `contracts/edge-cloud/v2/` is published and Agro.io has a byte-identical vendored copy.
2. Confirm Agro.io `integration/iot-v2` and IoT_Sensors `main` (the deployed git SHA) contain matching heartbeat, ingest, and configuration behavior.
3. Stop legacy node-key producers.
4. Verify gateway-only ingest. There is no toggle: `validate_gateway_credential` is the only authentication on readings, NDVI and heartbeat. Check that a request with a legacy node key is rejected with `401` and that a gateway credential is accepted.
5. Do **not** enable node keys and gateway credentials in the same process.

## Observation window

Legacy `nodos.api_key` columns may remain populated for rollback observation. They must not authenticate.

Cloud gateway status derives from the last heartbeat (`backend/app/services/gateway_heartbeat.py`): `recently_seen` up to `GATEWAY_STATUS_RECENT_SECONDS` (450 s), `stale` up to `GATEWAY_STATUS_STALE_SECONDS` (900 s), then `disconnected`. Both defaults live in `backend/app/core/config.py`.

## Rollback

1. Stop gateway traffic.
2. Redeploy the last compatible cloud/producer pair (the cloud redeploy is manual in Dokploy; see `../deployment.md`).
3. Rotate any gateway credential that may have leaked.
4. Never turn both authentication paths on together.

## Verification recorded for this documentation slice

- Frontend unit tests for gateway badge/management: run with `npm test`.
- Backend heartbeat tests were added with issue #34.
- Real Raspberry validation completed on 2026-10-08 on the test device (`10.32.90.229`, release `2.0.0-alpha.2`, gateway 7 / property 8): activation, configuration poll, binding confirmed, telemetry `201`/`200`, heartbeat `204`, 1,700+ readings visible in the client dashboard. Checks: backend 490 passed, frontend typecheck clean and 58 tests passed, v2 contract validator PASS, `scripts/integration` 23 tests OK. Task 7.4 of `edge-cloud-gateway-provisioning` is closed with this evidence.
- Contract v1 remains frozen; v2 is canonical for new producers.
- Redeployed on 2026-10-08 (Dokploy compose `iot-sensors`, project IoT_Sensors / environment development, branch `main`): the deployment built `46d3adb` and reported `Docker Compose Deployed`. The containers already served the gateway v2 code from the 01:28 deployment of `ba09a33` and were not recreated, because the newer commits touch documentation and `scripts/integration` only.
- Smoke against `http://10.32.81.230:3022` (plain HTTP, no domain yet): `/health` → `{"status":"ok"}`; `/api/v1/docs` → `200`; `/` → `200` with the SPA index; `POST /api/v1/readings` without a credential and with a legacy `ak_` node key → `401`; `POST /api/v1/gateways/activate` → `422`; `POST /api/v1/ndvi-snapshots` → `401`; `GET /api/v1/users/me` → `401`; `POST /api/v1/auth/login` with unknown credentials → `401 Credenciales inválidas` (real database round-trip). Only `mysql`, `backend` and `frontend` run: no `phase2` profile service is up.
