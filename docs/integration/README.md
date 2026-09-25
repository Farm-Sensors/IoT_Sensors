# Gateway v2 integration entry point

Issue #28 delivers the contract package under `contracts/edge-cloud/v2/`. Its accepted Git commit and the SHA-256 digest of `SHA256SUMS` must be recorded by each consumer. Run the validator and regression suite described in that package's README. Passing offline contract checks is not acceptance of a live producer or cloud release.

## Ownership and acceptance gates

| Boundary | IoT_Sensors evidence (Ricky unless noted) | Agro.io evidence (external; not implemented here) |
|---|---|---|
| Shared contract | #28: full package, matching checksums, credential-free fixtures, frozen v1 | Vendor byte-identical accepted v2 package; reject missing/unpublished or mismatched package |
| Activation | #29–#30: additive MySQL persistence, one gateway/property, atomic single-use 24-hour reference and protected credential lifecycle | JP: prepared image with no identity/secrets, online activation, protected credential storage, cleanup and local installation UI |
| Configuration and bindings | #31: immutable monotonic configuration, both-revision 304, live overlay, selected-slot ownership and reassignment history | JP: atomic last-valid cache and polling; Fabián: local discovery and explicit technician selection/confirmation |
| Telemetry | #32: gateway + logical node + event ID authorization and 201/200/409 behavior, 12 fields, capture-time ordering | JP: confirmed-binding normalization, durable outbox, stable identity/retries, 30-day confirmed retention and pending-data disk-pressure protection |
| NDVI | #33: separate latest-point event, configuration-area authorization, scene/payload replay and conflict | JP: separate Sentinel-2 point publisher; no polygon/history or telemetry field |
| Heartbeat | #34: receive-time heartbeat at 300-second target cadence; gateway status distinct from node freshness | JP: five-minute client and independent gateway/reading clocks |
| Prepared-image update | #34: own authorization retrieval and matching technician confirmation, no software execution | JP + Fabián: local prepared-image workflow and technician confirmation without edge JWT |
| UI and operational preparation | Fabián #35: management/status UI; Ricky #36: simulator/manifests; Fabián #37: documentation/runbook | Local UI first; phone assistance deferred; complete paired validation evidence |

Alan coordinates dependency acceptance and merge order; he is not an implementation owner. Each later package waits for all predecessors listed in its issue to be accepted. No Agro.io files are modified from this repository.

## Runtime remains deferred

The accepted v2 contract is the first gate. Final runtime cutover additionally requires a matching Agro.io build and cloud release, repository checks, byte-identical vendored provenance, and an explicitly passed paired staging smoke record. None is asserted by the offline fixtures. Until paired readiness is accepted, keep the active v1 producer/cloud pair and leave future gateway routes unused.

There is **no dual-auth window**: after the coordinated switch, legacy node keys must never authenticate. Retained legacy columns are for rollback observation only. Rollback means stopping traffic and redeploying the last compatible cloud/producer pair, never enabling both authentication paths in one process. Activation, telemetry and configuration publication are not performed by #28.

OTA delivery, automated rollback, gradual rollout, phone helpers, AI, schedulers, active alerts and notifications remain out of scope. NDVI remains latest-point-only and separate from telemetry.

The cutover/rollback steps live in [`gateway-v2-cutover-runbook.md`](gateway-v2-cutover-runbook.md).
