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
- Paired smoke via the Agro.io headless harness on 2026-10-06 (activation, configuration poll, binding, telemetry `201`/`200`, heartbeat `204`; evidence in Agro.io `odd/tasks/wire-gateway-v2.md`). The full cutover verification (task 7.4) stays open until the real Raspberry validation.
- Contract v1 remains frozen; v2 is canonical for new producers.
