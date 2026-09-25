# Gateway v2 cutover and rollback runbook

This runbook is operational documentation only. It does not authorize production cutover.

## Switch

1. Confirm `contracts/edge-cloud/v2/` is published and Agro.io has a byte-identical vendored copy.
2. Confirm Agro.io `integration/iot-v2` and IoT_Sensors `integration/gateway-v2` contain matching heartbeat, ingest, and configuration behavior.
3. Stop legacy node-key producers.
4. Enable gateway-only ingest (`validate_gateway_credential` on readings/NDVI/heartbeat).
5. Do **not** enable node keys and gateway credentials in the same process.

## Observation window

Legacy `nodos.api_key` columns may remain populated for rollback observation. They must not authenticate.

## Rollback

1. Stop gateway traffic.
2. Redeploy the last compatible cloud/producer pair.
3. Rotate any gateway credential that may have leaked.
4. Never turn both authentication paths on together.

## Verification recorded for this documentation slice

- Frontend unit tests for gateway badge/management: run with `npm test`.
- Backend heartbeat tests were added with issue #34.
- Paired staging smoke with live Agro.io: **skipped** until an explicit acceptance of runtime cutover.
- Contract v1 remains frozen; v2 is canonical for new producers.
