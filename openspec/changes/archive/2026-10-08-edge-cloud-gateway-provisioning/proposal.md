# Proposal: Edge-Cloud Gateway Provisioning

## Intent

Replace direct per-node ingestion with a cloud-owned gateway model: one authorized Agro.io gateway per property provisions and represents multiple logical area nodes, then sends normalized telemetry and latest-point NDVI events to IoT_Sensors. This change establishes a secure, versioned cloud control plane and a deterministic ingest identity while keeping the current MySQL 8 stack and preserving canonical history.

## Scope

### In Scope

- Add cloud-side gateway provisioning for one gateway per property, including safe 24-hour one-time QR/token-reference activation, credential issuance/rotation boundaries, global admin templates, prepared area slots, hardware profiles, and partial activation.
- Add cloud-authoritative, versioned property configuration with conditional polling (`304` only when both configuration and binding overlay are current), logical-node-to-physical UID/serial binding history, technician-selected candidate slots, and gateway-authenticated confirmation that preserves history by capture time.
- Accept five-minute gateway heartbeats and expose simple gateway status separately from logical-node reading freshness, mapping cloud status to edge `pending`, `connected`, `delayed`, or `disconnected`.
- Replace per-node ingest authentication with one property-scoped gateway credential and authorize each event against the gateway's active configuration and logical node/area identity.
- Preserve the 12-field normalized telemetry contract: unavailable values are `null`, measured zero remains `0`, capture timestamps remain canonical, and anomalous timestamps are retained with a suspicious marker.
- Re-key telemetry idempotency to gateway + logical node + event ID (the endpoint is implicit in the telemetry persistence domain) while preserving exact-retry and conflict behavior.
- Keep latest-point NDVI as a separately validated **edge-cloud v2** event and storage model with Sentinel-2 provenance; it must never become a telemetry field and retains distinct replay semantics.
- Define the complete v2 machine contract for activation, configuration poll/overlay, candidate submission/confirmation, heartbeat, telemetry, NDVI, and centrally authorized locally confirmed prepared-image updates, including headers, schemas, errors, and retries; no JWT is stored on edge.
- Update cloud tests, simulator/integration fixtures, contracts, OpenSpec baselines, and architecture/API/security/stack documentation so all surfaces describe the same cutover.

### Out of Scope

- Agro.io implementation, including its local UI, device discovery, prepared image, config cache, outbox, 30-day retention, disk-pressure policy, retry execution, and update execution; these are required paired work in the Agro.io repository.
- Physical actuator commands or remote control of irrigation equipment.
- Mobile/GPS installation helpers.
- OTA delivery, automated rollback, or gradual fleet rollout; the first release remains a locally prepared image with central authorization and technician confirmation.
- Active inactivity/threshold alerts, external notifications, AI assistants/reports, n8n expansion, or any other dormant Phase 2 behavior.
- PostgreSQL migration, TimescaleDB, partitioning, or replacement of the existing MySQL 8 operational stack.
- Polygon NDVI sampling, NDVI history, or adding NDVI to telemetry.
- A dual-auth production window or a gateway proxy that continues using per-node credentials.

## Capabilities

### New Capabilities

- `gateway-provisioning`: Cloud-side property gateway lifecycle covering safe one-time activation, gateway credentials, global templates copied into property working sets, versioned authoritative configuration, prepared logical-node slots, hardware profiles, canonical physical binding states, partial activation, heartbeat acceptance, simple gateway status, and paired external acceptance contracts.
- `ndvi-snapshots`: Gateway-authenticated latest-point NDVI ingestion and retrieval using the edge-cloud v2 contract, with separate validation, storage, replay semantics, and Sentinel-2 provenance; polygon/history behavior remains excluded.

### Modified Capabilities

- `readings`: Replace per-node authentication and identity with authorized gateway + logical-node identity; require normalized `null` semantics, gateway-scoped idempotency, canonical capture-time history, and suspicious timestamp retention while preserving the 12 telemetry fields.
- `security`: Replace fixed node API keys with property-scoped gateway activation and credentials, including single-use expiry, secret handling, rotation boundaries, and strict separation from user JWT authentication.
- `data-model`: Introduce gateway, protected activation-reference, global-template, versioned configuration, hardware-profile, binding-history, and heartbeat records in MySQL 8; retain logical node-to-area 1:1 semantics and separate NDVI storage.

## Approach

Keep MySQL 8 and extend the existing FastAPI, SQLAlchemy, and Alembic architecture with additive gateway control-plane tables and portable composite uniqueness. PostgreSQL-specific JSONB, partial-index, and notification features are unnecessary for the required constraints and would add an unrelated stack migration.

Publish a new versioned edge-cloud contract rather than silently changing the current per-node contract. Build the cloud path as issue-sized deliverables: additive domain and activation; versioned configuration and bindings; gateway-authenticated telemetry/idempotency and separate NDVI; heartbeat/status; then contract, simulator, and documentation cutover. Runtime acceptance changes completely to gateway credentials—legacy node credentials are not accepted concurrently.

Cloud configuration is authoritative. Global templates are versioned admin assets that copy expected existing areas, pending node slots, and hardware-profile links into an independent property working set before that property configuration is published. Ingest resolves the property and logical node from the authenticated gateway and active configuration, validates the event against that scope, and stores history under the logical area node using edge capture time. Physical reassignment creates binding history instead of rewriting prior readings. Agro.io consumes the published contract and performs the paired local workflows without changes from this repository.

Implementation is published as one complete PR per GitHub issue. Verify the entire issue scope and preserve the change-level rollback boundary; there is no authored-line limit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/models/`, `backend/alembic/versions/` | Modified/New | Add MySQL 8 gateway, activation, configuration, profile, binding, and heartbeat persistence; re-key ingest identity without merging NDVI into readings. |
| `backend/app/core/deps.py`, `backend/app/api/v1/endpoints/` | Modified/New | Add activation/config/binding/heartbeat APIs and replace node-key ingest dependencies for readings and NDVI. |
| `backend/app/services/`, `backend/app/schemas/` | Modified/New | Enforce property scope, versioned config, candidate validation, binding history, normalized event semantics, and status responses. |
| `backend/tests/` | Modified/New | Cover activation expiry/single use, authorization, config versions, binding transitions, idempotency, late/suspicious timestamps, heartbeat, and NDVI separation. |
| `frontend/src/` | Modified/New | Support cloud-side admin provisioning and present simple gateway status separately from node data freshness. |
| `contracts/edge-cloud/` | Modified/New | Publish the gateway-authenticated contract version and fixtures while keeping telemetry and NDVI as separate events. |
| `simulator/`, `scripts/integration/manifests/` | Modified | Replace per-node key assumptions with gateway identity/config and gateway-compatible test manifests. |
| `openspec/specs/readings/spec.md`, `openspec/specs/security/spec.md`, `openspec/specs/data-model/spec.md` | Modified | Remove per-node-auth contradictions and define normalized gateway ingest and logical-node semantics. |
| `openspec/config.yaml`, `AGENTS.md` | Modified | Align project-level architecture and authentication guidance with the gateway cutover and MySQL 8 decision. |
| `docs/api.md`, `docs/security.md`, `docs/stack.md`, `docs/architecture/`, `docs/integration/README.md` | Modified | Keep API, security, architecture, integration entry point, and stack documentation consistent with the final contract. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| IoT_Sensors and Agro.io deploy incompatible contract versions | High | Publish and validate the new contract first, require paired Agro.io readiness, and coordinate the cutover without silently mutating the current contract. |
| Incorrect gateway/logical-node idempotency creates duplicates or rejects valid retries | Medium | Define the full identity tuple in specs and enforce it with MySQL composite uniqueness plus exact-retry/conflicting-payload tests. |
| Activation references or gateway credentials leak through responses, logs, or fixtures | Medium | Store only protected credential material where feasible, return secrets only at controlled issuance, redact logs, and keep fixtures credential-free. |
| Partial activation or reassignment violates one-area/one-logical-node invariants | Medium | Separate logical slots from physical binding history, validate active-binding uniqueness, and require field confirmation before reassignment. |
| Late or anomalous timestamps corrupt latest/freshness behavior | Medium | Preserve edge capture time, mark suspicious values explicitly, and compute latest from accepted capture timestamps rather than arrival order. |
| Contract, specs, simulator, and operational docs drift during the cutover | High | Treat consistency surfaces as acceptance criteria and complete the final documentation/fixture slice before declaring the change ready. |
| The change exceeds reviewer capacity | High | Keep one PR per issue and provide complete scope, focused tests, and full validation evidence for review. |

## Rollback Plan

Use additive migrations and retain legacy node credential data through a defined observation window, but never enable both authentication paths in the same runtime. Before contract cutover, rollback by disabling the new gateway routes and reverting the corresponding issue-level change. After cutover, stop gateway traffic, redeploy the last compatible cloud release, and coordinate Agro.io rollback to its matching contract; keep additive gateway tables intact if they contain operational history. Reverse or remove new tables only when they are empty and an Alembic downgrade has been validated. Defer destructive removal of legacy columns until the gateway release is stable and rollback is no longer required.

## Dependencies

- Paired Agro.io work is required to implement local UI, online activation, discovery, binding proposals, config caching/polling, durable retries, 30-day confirmed retention, pending-data disk protection, five-minute heartbeat emission, prepared-image operations, and central-authorization/technician-confirmed updates against the published contract. This repository must not modify Agro.io; OTA, rollback automation, and gradual rollout remain later work.
- The edge-cloud contract version and coordinated deployment order must be agreed before disabling legacy producers.
- Existing MySQL 8, SQLAlchemy, Alembic, Docker Compose, JWT user auth, and property/area ownership controls remain prerequisites.

## Success Criteria

- [ ] An admin can provision exactly one gateway for a property, issue a safe 24-hour single-use QR/token reference, create/version global templates, copy a template's expected areas/pending slots/profile links into an independent property working set, and publish monotonically versioned configuration.
- [ ] A gateway can activate once, poll only its authorized property configuration with a live binding overlay, submit a candidate only after the technician selects a prepared pending slot/area, operate with partial bindings, and send five-minute heartbeats.
- [ ] Gateway confirmation can activate only its own previously submitted authorized candidate for the selected slot; physical reassignment preserves binding history and prior telemetry remains associated with the area valid at capture time.
- [ ] `POST /api/v1/readings` accepts only an authorized gateway identity plus configured logical-node identity; direct per-node credentials are rejected after cutover.
- [ ] Telemetry preserves exactly 12 dynamic fields, treats `null` as unavailable and `0` as measured zero, and stores late events by original capture time with anomalous timestamps marked suspicious.
- [ ] Exact telemetry retries return the existing record, while reuse of an event ID with a different body is rejected under the gateway + logical-node identity scope in the dedicated telemetry domain.
- [ ] Latest-point NDVI remains a separate validated **edge-cloud v2** event and storage model with its distinct scene-plus-payload replay semantics and provenance; no telemetry schema, reading row, or dashboard telemetry field gains NDVI.
- [ ] The v2 machine contract defines activation, conditional configuration poll/overlay, candidate submit/confirmation, heartbeat, telemetry, NDVI, update authorization/confirmation, headers, schemas, errors, and retry semantics without creating a physical contract file in this planning change.
- [ ] The coordinated external acceptance matrix records local UI first, phone deferral, prepared-image online activation, polling/cache, retry/30-day retention/pending-data protection, five-minute heartbeat, central update authorization plus gateway-recorded technician confirmation, and later OTA/rollback/rollout without asserting Agro.io implementation in this repository.
- [ ] Gateway status and logical-node reading freshness are exposed as distinct concepts, with canonical cloud status mapped to edge `pending`, `connected`, `delayed`, or `disconnected`, without enabling active inactivity alerts.
- [ ] MySQL 8 migrations upgrade a clean database successfully, relevant backend/frontend/contract tests pass, and no PostgreSQL dependency or dialect-specific design is introduced.
- [ ] Contracts, OpenSpec baselines, simulator/manifests, `AGENTS.md`, project config, and API/security/architecture/stack/integration documentation contain no per-node-ingest contradictions.
- [x] Implementation is delivered in one complete PR per GitHub issue, with validation across the full issue scope.
