# Gateway v2 integration entry point

Issue #28 delivers the contract package under `contracts/edge-cloud/v2/`. Its accepted Git commit and the SHA-256 digest of `SHA256SUMS` must be recorded by each consumer. Run the validator and regression suite described in that package's README. Passing offline contract checks is not acceptance of a live producer or cloud release.

## Ownership and acceptance gates

| Boundary | IoT_Sensors evidence (Ricky unless noted) | Agro.io evidence (external; not implemented here) |
|---|---|---|
| Shared contract | #28: full package, matching checksums, credential-free fixtures, frozen v1 | Vendor byte-identical accepted v2 package; reject missing/unpublished or mismatched package |
| Activation | #29–#30: additive MySQL persistence, one gateway/property, atomic single-use 24-hour reference and protected credential lifecycle | JP: prepared image with no identity/secrets, online activation, protected credential storage, cleanup and local installation UI |
| Pairing (device authorization, RFC 8628) | `gateway-device-pairing`: additive `sesiones_emparejamiento` table, hashed/HMAC codes, machine start/poll routes and admin lookup/approve/deny, all behind `GATEWAY_PAIRING_ENABLED` (**OFF by default**); reference activation untouched | Agro.io: edge pairing client (`gateway/pairing.py`, CLI `pair`) and the InstallView pairing step — paired work on `integration/iot-v2`, not implemented in this repository |
| Configuration and bindings | #31: immutable monotonic configuration, both-revision 304, live overlay, selected-slot ownership and reassignment history | JP: atomic last-valid cache and polling; Fabián: local discovery and explicit technician selection/confirmation |
| Telemetry | #32: gateway + logical node + event ID authorization and 201/200/409 behavior, 12 fields, capture-time ordering | JP: confirmed-binding normalization, durable outbox, stable identity/retries, 30-day confirmed retention and pending-data disk-pressure protection |
| NDVI | #33: separate latest-point event, configuration-area authorization, scene/payload replay and conflict | JP: separate Sentinel-2 point publisher; no polygon/history or telemetry field |
| Heartbeat | #34: receive-time heartbeat at 300-second target cadence; gateway status distinct from node freshness | JP: five-minute client and independent gateway/reading clocks |
| Prepared-image update | #34: own authorization retrieval and matching technician confirmation, no software execution | JP + Fabián: local prepared-image workflow and technician confirmation without edge JWT |
| UI and operational preparation | Fabián #35: management/status UI; Ricky #36: simulator/manifests; Fabián #37: documentation/runbook | Local UI first; phone assistance deferred; complete paired validation evidence |

Alan coordinates dependency acceptance and merge order; he is not an implementation owner. Each later package waits for all predecessors listed in its issue to be accepted. Agro.io changes may be made from this workspace, but only on branches based on `integration/iot-v2`; nothing is committed or pushed to Agro.io `main`.

## Gateway v2 is live and gateway-only

The v2 runtime is implemented on `main` and is the only telemetry path (how it works: [`../system.md`](../system.md)). Node API keys never authenticate; retained `nodos.api_key` columns exist for rollback observation only. There is **no dual-auth window**: rollback means stopping traffic and redeploying the last compatible cloud/producer pair, never enabling both authentication paths in one process.

Verified flow (cloud endpoints in [`../api.md`](../api.md); wire contract in `contracts/edge-cloud/v2/`):

1. **Obtain the gateway credential: pairing (primary path), reference (fallback).** Pairing is the primary path when `GATEWAY_PAIRING_ENABLED` is on (it is **OFF by default**, and the recorded smoke below used the fallback): the device shows a short code + QR, an admin approves it from a phone at `/pair`, and the edge polls `POST /api/v1/gateways/pairing-sessions/token` until it receives the `gk_` credential once. The fallback is unchanged: an admin provisions the gateway and issues a single-use 24-hour reference, and the edge calls `POST /api/v1/gateways/activate`. Neither path creates the client, property, area or logical node, and neither infers anything from the UID.
2. **Configuration poll**: `GET /api/v1/gateways/me/configuration` returns `200`, or `304` only when both `X-Config-Version` and `X-Bindings-Revision` match.
3. **Bind**: the technician-selected slot is proposed with `POST /api/v1/gateways/me/binding-candidates` and confirmed with `.../{candidate_id}/confirm`.
4. **Telemetry**: `POST /api/v1/readings` with `X-API-Key`, `X-Logical-Node-Id` and `X-Event-ID` returns `201` (new), `200` (exact retry) or `409` (same event ID, different body).
5. **Heartbeat**: `POST /api/v1/gateways/me/heartbeat` returns `204`.
6. **NDVI**: `POST /api/v1/ndvi-snapshots` carries the separate latest-point event; it is never a telemetry field.

A paired smoke of this flow was run on 2026-10-06 through the Agro.io headless harness, and the full cutover verification (task 7.4 of the archived `2026-10-08-edge-cloud-gateway-provisioning` change) was completed on 2026-10-08 on the real Raspberry test device (activation, configuration poll, binding, telemetry `201`/`200`, heartbeat `204`; see [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md)). Pairing stayed behind its flag (**OFF**), so that credential step used the reference fallback; the pairing path is implemented but not yet exercised against the live stack. Offline contract checks alone are not acceptance of a live producer. Agro.io changes are made only on branches based on `integration/iot-v2`; its v2 line grows there and is never merged to Agro.io `main` (see [`agro-release-and-update.md`](agro-release-and-update.md)).

Deploys of this cloud are manual: a push to `main` does not redeploy the private Dokploy. See [`../deployment.md`](../deployment.md).

OTA delivery, automated rollback, gradual rollout, phone helpers, AI, schedulers, active alerts and notifications remain out of scope. NDVI remains latest-point-only and separate from telemetry.

The cutover/rollback steps live in [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md). How Agro.io builds, publishes and installs releases on a Raspberry Pi is in [`agro-release-and-update.md`](agro-release-and-update.md).

## Development environment

The integration is exercised with this cloud plus a dedicated test Raspberry running the Agro.io v2 line. Current values (lab, not production configuration):

| Piece | Where it runs | How it is reached |
|---|---|---|
| IoT_Sensors cloud (API, MySQL, dashboard) | the server `10.32.81.230` (Docker/Dokploy) | `http://10.32.81.230:3022` by IP:port; the public domain is unreliable, so use the address |
| Agro.io edge agent (v2 line, `2.0.0-alpha.N`) | test Raspberry `10.32.90.229` | sends telemetry through the v2 lane when there are readings; it currently runs `mode: demo` with `demo_nodes: 0` (silent demo): the gateway keeps heartbeating and nothing is fabricated. Switch it in `Agro.io` `docs/configuration-ui.md` |
| Agro.io UI viewer (Xvfb + `x11vnc` + noVNC) | test Raspberry | `http://10.32.90.229:6080/vnc.html`; the Avalonia UI renders on a virtual display over the device's live database |
| Agro.io reference receiver (`apps/ui-web/telemetry_server.py`) | the server `10.32.81.230` (container with a published port) | `http://10.32.81.230:8090/`; the device's `http_sync.endpoint` targets it (stand-in for the client's own backend) |

- Deploys of this cloud are manual: GitHub cannot reach the private-network Dokploy, so autodeploy never fires. Trigger the deploy from the Dokploy UI or its MCP after pushing.
- Cloud-side checks after a change: `GET /api/v1/readings?irrigation_area_id=<id>`, `GET /api/v1/gateways/<id>/status` (edge status, binding, latest reading), and the client dashboard (predio → área) which shows the freshness indicator and the gateway status. The running state is read from the systems, not from this document; dashboard credentials live in [`../test-data.md`](../test-data.md).
- Adding a slot to a gateway that already published a configuration is not supported by the API (the template copy refuses once a configuration exists, and there is no slot-update route). If it is done out of band for a lab fixture, bump `pasarelas.bindings_revision` in the same change: the overlay content changed, and a device that cached that revision refuses changed content inside an accepted revision (by contract design, verified on 2026-10-08).
- The device-side pieces (release install, viewer service, demo vs serial mode, the receiver path, and why none of it ships in a release) are documented in Agro.io `docs/integration/v2-release-line.md`; the harness that runs the agent alone is in `docs/integration/headless-harness.md` there.
- This lab stack runs with **`GATEWAY_PAIRING_ENABLED=true`** and `PAIRING_VERIFICATION_BASE_URL=http://10.32.81.230:3022` (IP:port, per the lab rule). The product default stays `false`; the variables reach the backend only because `docker-compose.yml` forwards them. Dokploy stores that env encrypted, so it is edited through its UI or API, never with SQL. Verified end to end on 2026-10-08: a `pair --replace` session approved by the admin rotated the gateway credential, the previous credential answered `401`, and the existing bindings survived.
