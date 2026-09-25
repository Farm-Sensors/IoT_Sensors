# Tasks: Edge-Cloud Gateway Provisioning

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,000–3,000 authored lines across 9 autonomous slices; generated migrations/fixtures excluded from the estimate |
| 400-line budget risk | Not applicable under the user's issue-based PR policy |
| Chained PRs recommended | No; one PR per GitHub issue |
| Suggested split | One PR per issue; issue #30 includes tasks 3.1 and 3.2 |
| Delivery strategy | One complete PR per issue |
| Chain strategy | No authored-line cap |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: One PR per issue
400-line budget risk: Not applicable

## Execution Branch and Publication Prerequisite

- **IoT_Sensors path:** `main` → `integration/gateway-v2` → per-issue `feat/<issue>`. Every IoT implementation PR targets `integration/gateway-v2`.
- **Agro.io path:** `origin/integration/iot-v1` → `integration/iot-v2` → per-issue `feat/<issue>`. Every Agro implementation PR targets `integration/iot-v2`; v1 stays intact.
- Before publishing an implementation issue, record its required base, `feat/<issue>` branch, and PR target in the issue template. Do not push directly to `main`, `integration/gateway-v2`, or `integration/iot-v2`.
- Alan is the cross-repository integrator/coordinator, not an implementation issue owner. He coordinates dependency acceptance and merge order.

### Cross-repository blockers

- **Agro.io paired readiness is required before runtime cutover:** local activation, discovery, prepared-image behavior, configuration cache/poll, outbox retry and pending-data protection, five-minute heartbeat, and technician-confirmed update workflow are external deliverables. Do not modify Agro.io from this repository.
- **Contract v2 publication is the first implementation gate:** publish and validate the versioned contract before disabling legacy producers or deploying the gateway-only ingest dependency.
- **No dual-auth window:** the cloud cutover and the Agro.io producer cutover must be one coordinated release train; legacy node keys remain stored only for rollback observation and are never accepted after cutover.
- **Deployment blocker:** confirm a matching Agro.io build and cloud release before enabling gateway traffic; if either side is not ready, keep the new routes unused and do not replace the active producer path.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Publish the normative edge-cloud v2 contract and consumer fixtures | PR 1 | Contract validator plus v1 frozen-fixture check | Credential-free fixture validation; N/A for live gateway until Agro.io is ready | Remove only v2 contract assets and restore the v1 README pointer before runtime cutover |
| 2 | Add control-plane persistence and migration | PR 2 | `cd backend && uv run pytest backend/tests/unit/test_gateway_service.py` | `alembic upgrade head` on an empty MySQL 8 database | Disable gateway routes; downgrade only when new tables are empty; retain additive history otherwise |
| 3 | Implement activation, credential lifecycle, templates, and admin provisioning | PR 3 | `cd backend && uv run pytest backend/tests/unit/test_gateway_service.py backend/tests/integration/test_gateways_api.py` | Admin provisions a property, issues a QR-ready reference, and activates once in a test client | Disable activation/provisioning routes; keep additive records and rotate/revoke issued credentials if necessary |
| 4 | Implement authoritative configuration and physical binding history | PR 4 | `cd backend && uv run pytest backend/tests/unit/test_gateway_config_service.py backend/tests/unit/test_binding_service.py` | Poll with matching/stale revisions, submit selected candidates, confirm reassignment | Disable candidate/confirmation routes; preserve immutable configs and binding history |
| 5 | Cut telemetry authentication and idempotency to gateway scope | PR 5 | `cd backend && uv run pytest backend/tests/integration/test_gateway_ingest.py backend/tests/integration/test_reading_idempotency.py` | Gateway sends valid, duplicate, conflicting, late, and suspicious telemetry events | Stop gateway traffic and redeploy the last compatible cloud/producer pair; never enable node and gateway auth together |
| 6 | Move latest-point NDVI ingestion to gateway authorization without merging it into telemetry | PR 6 | `cd backend && uv run pytest backend/tests/integration/test_ndvi_api.py` | Submit authorized point NDVI, exact replay, conflict, unauthorized area, and polygon rejection | Disable gateway NDVI route and redeploy the matching compatible pair; retain existing separate snapshot rows |
| 7 | Add heartbeat, status mapping, update authorization, and local confirmation | PR 7 | `cd backend && uv run pytest backend/tests/integration/test_gateways_api.py backend/tests/unit/test_gateway_service.py` | Five-minute heartbeat/status boundary checks and matching/mismatched prepared-image confirmation | Disable heartbeat/update routes; preserve last-seen and audit records, with no OTA rollback |
| 8 | Add admin/client gateway UI while preserving node freshness semantics | PR 8 | `cd frontend && npm test && npm run typecheck` | Admin lifecycle walkthrough and client view showing gateway status beside reading freshness | Revert frontend routes/components only; backend control-plane data remains intact |
| 9 | Cut over simulator/manifests, OpenSpec baselines, project guidance, and operational docs | PR 9 | `cd backend && uv run pytest`; `cd frontend && npm test`; contract checks | Credential-free manifest review plus coordinated staging producer smoke test with Agro.io | Revert documentation/simulator assets; before cutover keep v1 producer and cloud release paired |

## Phase 1: Contract Publication First

- [x] 1.1 **Contract lane** — Create `contracts/edge-cloud/v2/README.md`, `telemetry.schema.json`, `ndvi.schema.json`, `fixtures/**`, and `SHA256SUMS` (edit targets) defining activation, conditional configuration poll/overlay, selected-slot candidates, confirmation, heartbeat, telemetry, NDVI, update authorization, and update confirmation exactly as specified in `machine-contract.md`; keep secrets out of fixtures and document the common error/retry envelope.
- [x] 1.2 **Contract compatibility tests** — Add or update contract validation so v2 fixtures cover required headers, `304` only when both revisions match, gateway/logical-node telemetry identity, separate NDVI replay, and forbidden static/NDVI telemetry fields; verify `contracts/edge-cloud/v1/**` (read-only) remains byte-stable except for its frozen-runtime pointer in `README.md`.
- [x] 1.3 **External gate record** — Document in `docs/integration/README.md` the Agro.io paired acceptance matrix, ownership lanes, and the rule that v2 publication and paired readiness precede runtime cutover; do not claim Agro.io implementation in this repository.

### Issue #28 local implementation evidence

- Branch: `feat/28`, based on `origin/integration/gateway-v2` at `4753987`. The user explicitly approved a single change exceeding the 400-authored-line target for this contract-only package on 2026-09-23.
- Created the nine-operation package, request/response/header/path schemas, 46 credential-free machine examples, body fixtures, complete package checksums, and a full v1 freeze manifest. Runtime backend/frontend behavior is unchanged.
- Local validation: 15 contract regression tests pass (including full-package validation), four existing H0 harness tests pass, Ruff passes, and `git diff --check` passes. CI now includes a dedicated contract job; remote CI has not run for this work.
- Publication accepted: #28 was merged through PR #38 (contract commit `d7c2652`); backend, frontend and contract CI passed. The user accepted the evidence and authorized closing #28 before starting #29. Paired Agro.io readiness, runtime cutover and deployment remain unclaimed.

## Phase 2: Control Plane Persistence and Provisioning

- [x] 2.1 **Control-plane models** — Create `backend/app/models/gateway.py`, `activation_reference.py`, `gateway_template.py`, `hardware_profile.py`, `gateway_slot.py`, `gateway_config.py`, and `physical_binding.py`; export them from `backend/app/models/__init__.py` and link `backend/app/models/property.py` and `node.py` while preserving logical node/area 1:1 semantics.
- [x] 2.2 **Additive migrations** — Create `backend/alembic/versions/<rev>_add_gateway_control_plane.py` revising `d4a8c2e67190`, with MySQL 8 portable uniqueness for one gateway/property, configuration version, active binding, and gateway-scoped event identities; use generic SQLAlchemy JSON and provide the documented SQLite computed-column fallback if needed.
- [x] 2.3 **Ingest columns migration** — Create `backend/alembic/versions/<rev>_add_gateway_ingest_columns.py` adding nullable `lecturas.pasarela_id`, `marca_tiempo_sospechosa`, the gateway/logical-node/event unique index, and nullable `nodos.api_key`; do not drop legacy keys or introduce PostgreSQL/partitioning behavior.
- [x] 2.4 **Persistence RED tests** — Add `backend/tests/unit/test_gateway_service.py` cases for duplicate property gateway, duplicate configuration version, active-binding uniqueness, protected activation material, and clean MySQL migration acceptance; make failures observable before service implementation.

### Issue #29 implementation and acceptance evidence

- Scope: tasks 2.1–2.4 only; `feat/29` from `integration/gateway-v2` at `d7c2652`, PR target `integration/gateway-v2`. The user approved a single change exceeding 400 authored lines and requested a separate PR for each issue.
- Specs read: `specs/data-model/spec.md`, `specs/security/spec.md`, `specs/gateway-provisioning/spec.md`, plus the published v2 contract, proposal, tasks and design. Eight tables persist gateways, protected activation metadata, hardware profiles, templates/versions, prepared slots, configuration snapshots and physical binding history. Latest heartbeat is a gateway timestamp, not a telemetry row.
- Migrations: `d4a8c2e67190 → e29a01c7b901 → e29a02c7b902`. Existing node keys and legacy event uniqueness remain intact; new nullable gateway identity and a false-by-default suspicious-time flag preserve historical readings. Runtime auth and all endpoints are unchanged. Service-layer lifecycle, monotonic publication, property/node authorization and gateway-only ingestion remain for #30–#32.
- RED evidence: the new persistence suite initially failed to collect because `ActivationReference` and the gateway models did not exist. After implementation, all eight focused persistence tests and four existing reading concurrency/migration tests pass.
- MySQL 8 acceptance passed on a fresh disposable database: full upgrade, empty downgrade/re-upgrade, preservation of pre-v2 readings and keys, property/config/binding uniqueness, confirmation provenance, scoped event duplicates, and refusal to downgrade when gateway reading metadata would be lost. SQLite supports the stored computed columns; no fallback table is needed.
- Final local checks: `.venv/bin/pytest -q` → 431 passed, 1 skipped (the opt-in MySQL test); the dedicated MySQL invocation → 1 passed. Ruff and `git diff --check` pass. Published v1/v2 contract files are unchanged.
- Automated MySQL acceptance: provide an **empty disposable** database named `issue29_*`, then run `GATEWAY_MYSQL_TEST_URL=mysql+pymysql://root@127.0.0.1:PORT/issue29_test .venv/bin/pytest tests/mysql/test_gateway_migrations.py -q` from `backend/`. The test refuses nonempty databases and is skipped without the explicit URL; the dedicated CI job supplies MySQL 8.
- Rollback is permitted only when new control-plane tables are empty, no gateway reading metadata exists, and no node needs a null legacy key. Populated installations must retain additive history and use the coordinated operational rollback; no credentials are fabricated or deleted.

## Phase 3: Activation, Templates, Configuration, and Binding

- [x] 3.1 **Activation and provisioning services/API** — Create `backend/app/schemas/gateway.py`, `backend/app/services/gateway.py`, and `backend/app/api/v1/endpoints/gateways.py` for admin provisioning, 24-hour opaque single-use references, atomic consumption, controlled credential issuance/rotation/revocation, status, and secret-redacted responses; add router wiring in `backend/app/api/v1/router.py`.
- [x] 3.2 **Template and property working-set behavior** — Implement versioned global templates, hardware profiles, active-template copy isolation, existing-area/node resolution, and publishable property working sets without implicit gateway, area, node, or physical binding creation; seed only non-secret hardware profiles in `backend/app/db/seed.py`.
- [x] 3.3 **Configuration service** — Publish immutable monotonic gateway snapshots and poll conditionally; return bodyless `304` only when both `X-Config-Version` and `X-Bindings-Revision` match, otherwise return the snapshot plus current binding overlay.
- [x] 3.4 **Binding state machine** — Implement selected-slot candidate submission and same-gateway confirmation with `unbound → pending_initial → confirmed` and `confirmed → pending_reassignment → confirmed`; close prior records atomically and retain capture-time logical-node history.
- [x] 3.5 **Binding/config tests** — Add `backend/tests/unit/test_gateway_config_service.py`, `backend/tests/unit/test_binding_service.py`, and `backend/tests/integration/test_gateway_config_binding_api.py` for monotonic snapshots, cross-property/slot isolation, stale overlay `200`, exact-match `304`, duplicate-event replay, duplicate candidates, foreign confirmation, and reassignment history.

### Issue #30 delivery evidence

- Scope: tasks 3.1 and 3.2 only — property gateway provisioning, one-time activation references, credential lifecycle, hardware-profile catalog, versioned templates, and copying an active template into an existing property's working set.
- All copied slots resolve existing areas and logical nodes. This issue does not create gateways, areas, nodes, or physical bindings implicitly.
- Validation: 21 focused integration tests and Ruff passed. The complete issue is in PR #42; backend suite evidence is recorded with that PR. Tasks 3.3 and later remain outside issue #30.

### Issue #31 delivery evidence

- Scope: tasks 3.3–3.5 only — immutable configuration publication, gateway-scoped conditional polling/live binding overlay, idempotent selected-slot candidates, gateway-owned confirmation, and reassignment history.
- Configuration versions increase monotonically and retain immutable profile snapshots. Polling returns bodyless `304` only for an exact match of both current revisions; a stale overlay returns `200` without changing the configuration version.
- Candidate submission requires the authenticated gateway, active published slot identity, logical node, area, UID, serial, and `X-Event-ID`. Exact retries return the original result; conflicting or duplicate candidates are rejected. Confirmation is limited to that gateway's pending candidate and selected slot; reassignment closes the old binding only after valid confirmation.
- Migration `e29a03c7b903` adds gateway-scoped proposal/confirmation replay identities while preserving existing binding history. No ingest, NDVI, heartbeat, UI, simulator, Agro.io, or Phase 2 behavior is included.
- Validation: focused control-plane tests and full backend suite, plus Ruff and `git diff --check`; exact results are recorded in PR #43.

## Phase 4: Gateway Ingestion and NDVI

- [x] 4.1 **Telemetry gateway authentication boundary** — Use `validate_gateway_credential` for telemetry, stop generating/returning node keys, and reject legacy node credentials on `POST /api/v1/readings` without granting JWT/admin access.
- [x] 4.2 **Telemetry cutover** — Require gateway auth, `X-Logical-Node-Id`, `X-Event-ID`, exact 12-field `extra=forbid` payloads, explicit `Z` timestamps, gateway/logical-node idempotency, canonical capture-time ordering, and suspicious timestamp retention.
- [x] 4.3 **Telemetry RED tests** — Cover 201/200/409 behavior, same event ID on different logical nodes, legacy-key 401, unconfigured/cross-property 403, extra/static/NDVI 422, null versus measured zero, naive timestamp 422, and late-event latest selection.
- [ ] 4.4 **NDVI authorization** — Modify `backend/app/api/v1/endpoints/ndvi_snapshots.py` and `backend/app/services/ndvi.py` to authorize `irrigation_area_id` through the active gateway configuration while retaining separate `ndvi_ultimos` storage and scene-plus-payload replay semantics; reject polygon/history and telemetry-shaped NDVI.
- [ ] 4.5 **NDVI RED tests** — Update `backend/tests/integration/test_ndvi_api.py` for gateway authorization, unauthorized area, exact replay, conflicting scene replay, invalid provenance/polygon, and telemetry-with-NDVI rejection; verify no `lecturas` NDVI column or export field is introduced.

### Issue #32 delivery evidence

- Scope: tasks 4.1–4.3 only — telemetry authenticates one active gateway and accepts only logical nodes in its current published configuration. Node creation no longer generates or returns direct credentials.
- Telemetry replay identity is `(gateway, logical node, event ID)`. Migration `e29a04c7b904` replaces the legacy node/event unique index; downgrade refuses when rows cannot fit the previous identity.
- Requests require exactly the 12 dynamic fields, `null` for unavailable values, and ISO 8601 timestamps ending in `Z`. Late readings retain capture time; readings over one hour in the future or over 30 days old are retained and marked suspicious.
- NDVI remains a separate operation in issue #33. Do not deploy the telemetry cutover by itself; the coordinated gateway-only release remains deferred until paired integration readiness.
- Branch: `feat/32`, based on `feat/31` while PR #43 is open; the PR is temporarily stacked so its diff contains only issue #32. Retarget it to `integration/gateway-v2` after #43 merges.
- Validation: focused gateway/reading suite → 147 passed; full backend suite → 470 passed, 1 skipped (opt-in MySQL migration test); Ruff and `git diff --check` pass. GitHub CI runs the MySQL 8 acceptance test.

## Phase 5: Heartbeat, Status, and Prepared Updates

- [x] 5.1 **Heartbeat/status implementation** — Add configured thresholds in `backend/app/core/config.py`, heartbeat persistence/service/API, and property status responses with `inactive|never_seen|recently_seen|stale|disconnected` mapped to `pending|connected|delayed|disconnected`; keep status independent from `FreshnessIndicator` and add no scheduler or Phase 2 alert.
- [x] 5.2 **Update authorization/confirmation** — Add gateway-scoped persistence, schemas, services, and routes for admin-created prepared image version/digest authorizations, gateway retrieval, and technician-confirmed matching results; store no image bytes, OTA command, JWT, rollback, or rollout state.
- [x] 5.3 **Status/update RED tests** — Add integration coverage for heartbeat credential rejection, `204` heartbeat, all threshold boundaries, gateway-connected/node-stale distinction, no active authorization (`204`), mismatched/expired update confirmation, exact retry, and secret/JWT absence.

## Phase 6: Frontend Control-Plane and Status UX

- [x] 6.1 **Gateway management client/UI** — Create `frontend/src/app/services/gateways.ts`, `pages/admin/GatewayManagement.tsx`, and routes/components for provisioning, one-time QR-ready activation reference display, templates/configuration, binding confirmation, rotation, and redacted status; never retain credential/reference after the controlled display lifecycle.
- [x] 6.2 **Status separation UI** — Create `frontend/src/app/components/GatewayStatusBadge.tsx` and test it; modify property/dashboard pages, navigation, node management/detail, and `FreshnessIndicator` so gateway connectivity is shown beside logical-node data freshness and `api_key` is absent from types and rendered views.
- [x] 6.3 **Frontend verification** — Add `frontend/src/app/components/GatewayStatusBadge.test.tsx` and management-page tests for status labels, secret non-rendering after navigation, client/admin visibility, and preservation of freshness copy.

## Phase 7: Simulator, Manifests, Documentation, and Cutover

- [x] 7.1 **Producer fixtures** — Modify `simulator/simulator.py`, `simulator/simulator_fast.py`, and `scripts/integration/manifests/h1-*.json` to use gateway secret references, logical-node IDs, and event IDs; reject node-key flags and keep credentials absent from committed fixtures.
- [x] 7.2 **Project guidance and baselines** — Modify `openspec/config.yaml`, `openspec/specs/readings/spec.md`, `openspec/specs/security/spec.md`, `openspec/specs/data-model/spec.md`, and `AGENTS.md` so gateway-only ingest, MySQL 8, null semantics, separate NDVI, and Phase 2 boundaries are consistent.
- [x] 7.3 **Operational/API documentation** — Modify `docs/api.md`, `docs/security.md`, `docs/stack.md`, `docs/architecture/overview.md`, `backend.md`, `frontend.md`, `decisions.md`, `docs/data-model.md`, and `docs/testing.md`; create `docs/integration/README.md` with the external acceptance matrix, deployment order, rollback, and explicit Agro.io boundary.
- [ ] 7.4 **Full cutover verification** — Deferred: paired staging smoke is not claimed. Local frontend tests and existing backend suites are the recorded checks. — Run backend migrations/tests, frontend tests/typecheck, v1/v2 contract checks, and a staging paired smoke test only after Agro.io readiness is confirmed; verify no per-node authentication contradictions remain and record every failed/skipped check before declaring ready.
- [x] 7.5 **Cutover/rollback runbook** — Document the coordinated switch to `validate_gateway_credential`, the observation window for unused legacy columns, stop-traffic/redeploy rollback, secret rotation response, and the prohibition on enabling node and gateway authentication in one process.

## Implementation Order

Publish and validate v2 first, then land additive persistence, activation/provisioning, immutable configuration and binding history, gateway-only telemetry, separate NDVI authorization, heartbeat/status and prepared updates, frontend support, and finally producer/documentation cutover. Each work unit must remain independently verifiable and reversible; Agro.io readiness blocks the final runtime switch but not cloud-side contract and test preparation.

## Key Learnings

1. The gateway cutover requires a new v2 contract before any producer or authentication switch.
2. MySQL 8 portable uniqueness keeps control-plane constraints testable without PostgreSQL-specific features.
3. Binding history preserves logical-area telemetry ownership across physical reassignment.
4. Gateway connectivity and logical-node reading freshness are independent clocks and UI concepts.
5. Agro.io owns paired edge workflows and remains outside this repository's edit scope.
