# Design: Edge-Cloud Gateway Provisioning

Cloud-owned property gateways replace per-node ingest. IoT_Sensors stays on **MySQL 8** and publishes a **new edge-cloud v2 contract**. Runtime cutover accepts only gateway credentials. Agro.io remains an external paired consumer; this repository does not modify it.

## Quick path

1. Add additive MySQL 8 control-plane tables (`pasarelas`, protected activation references, global templates, versioned configs, slots, profiles, binding history).
2. Authenticate machine traffic with a hashed gateway credential; authorize each event against the gateway's active configuration.
3. Keep telemetry (12 fields) and latest-point NDVI as separate events; re-key telemetry idempotency to gateway + logical node + event ID, with the endpoint implicit in telemetry's dedicated persistence domain.
4. Cut over simulator, fixtures, OpenSpec baselines, and docs together with contract v2. No dual-auth window.

## Technical Approach

This maps to proposal Approach 1 (complete gateway cutover) and the five specs:

| Spec | How this design implements it |
|------|-------------------------------|
| `gateway-provisioning` | Admin provisions one gateway per property, issues safe 24h one-time activation references, manages/copies global templates, publishes monotonic configs, authorizes prepared-image updates, while gateways submit and confirm selected candidates, poll/overlay state, heartbeat, and local technician update confirmation. |
| `readings` | `POST /api/v1/readings` authenticates a gateway, resolves a configured logical node, stores capture-time history, marks suspicious timestamps, forbids extra/NDVI/static fields. |
| `ndvi-snapshots` | Same gateway credential; edge-cloud v2 NDVI contract, still `ndvi_ultimos`; scene+payload replay; never a telemetry field. |
| `security` | Secrets hashed at rest, returned only at activation/rotation; JWT remains user-only; node keys rejected after cutover. |
| `data-model` | Portable MySQL 8 uniqueness; logical node 1:1 area unchanged; physical UID/serial lives in binding history. |

Existing layering is preserved: thin FastAPI endpoints → services → SQLAlchemy models → Pydantic schemas. Spanish table names, English API paths, JWT for users, `X-API-Key` header **repurposed** as the gateway credential (same header name, different identity).

**Explicitly deferred (no tables, routes, or UI):** mobile/GPS helper, physical commands/actuators, OTA, automated rollback, gradual fleet rollout, PostgreSQL/TimescaleDB/partitioning, polygon/history NDVI, dual-auth, Phase 2 alerts/AI/n8n expansion.

**External dependency:** Agro.io must implement local activation, discovery, candidate proposals, config cache/poll, durable retries, and the prepared image against contract v2. This design only publishes the cloud contract and APIs.

## Architecture Decisions

### Decision: Keep MySQL 8; portable uniqueness only

**Choice**: Stay on `mysql:8.0` / `mysql+pymysql`. Model new constraints as ordinary UNIQUE keys and nullable generated columns. Use generic SQLAlchemy `JSON`, not JSONB or partial indexes.

**Alternatives considered**: Migrate to PostgreSQL for partial unique indexes and JSONB; add TimescaleDB; partition `lecturas` now.

**Rationale**: Research (`research.md`) showed every required constraint is feasible on MySQL 8. PostgreSQL would rewrite Compose, Alembic history, driver, SRS, and docs without unlocking ingest behavior. Partitioning collides with event-id uniqueness on **both** engines. Tests remain SQLite in-memory (`backend/tests/conftest.py`); dialect-specific features would be unproven.

### Decision: Publish contract v2; freeze v1

**Choice**: Add `contracts/edge-cloud/v2/` as the gateway-authenticated contract. Leave `contracts/edge-cloud/v1/` byte-stable as the historical per-node contract. Runtime cutover serves only v2 semantics.

**Alternatives considered**: Silently mutate v1 README/headers; name it v1.1 inside the same folder.

**Rationale**: Proposal forbids silent mutation. Agro.io vendors exact copies. A new folder makes incompatible auth/identity obvious and gives a coordinated rollback target (redeploy cloud + Agro on matching version). Telemetry JSON body stays the 12-field schema; v2 changes **headers/identity**, not the 12 fields.

### Decision: One gateway credential in `X-API-Key`; logical node in `X-Logical-Node-Id`

**Choice**: Reuse header `X-API-Key` for the gateway secret. Require `X-Logical-Node-Id` on telemetry. NDVI continues to name `irrigation_area_id` in the body, authorized against the gateway config. Replace `validate_api_key` with `validate_gateway_credential`. Do not accept `nodos.api_key` on any machine endpoint after cutover.

**Alternatives considered**: `X-Gateway-Key`; put `logical_node_id` in the telemetry body; dual-auth window; gateway proxy that still posts per-node keys.

**Rationale**: Spec requires complete replacement, not dual auth. Keeping the 12-field body identical lets v2 reuse `telemetry.schema.json` and avoids extra/static fields. A distinct logical-node header is the untrusted identity the cloud then **authorizes** against config. Same header name reduces simulator churn but the dependency no longer looks up `nodos.api_key`.

### Decision: Activation reference and controlled issuance

**Choice**: The QR carries only a high-entropy opaque activation reference, never a gateway credential or secret-derived value. Store its SHA-256 hex and audit-safe issuer/issue/expiry/consumption/outcome metadata. The administrator issues it; the unactivated gateway consumes it online. Return the new gateway credential only once through a successful activation or rotation response. List/detail/status/config/node/property and audit responses omit references, secrets, and secret-derived values. Logs, fixtures, seeds, and docs never contain live secrets.

**Alternatives considered**: bcrypt (too slow for 10-minute ingest); plaintext like current `nodos.api_key`; overlapping rotation window.

**Rationale**: Gateway keys and activation references are high-entropy, so SHA-256 is appropriate and cheap on every POST. bcrypt would add latency to ingest. Atomic consume prevents duplicate issuance; indistinguishable invalid/expired/consumed responses prevent an activation-state oracle. Instant invalidation at rotation matches the security spec. Current node keys stay in the column for a rollback observation window but are not issued or accepted.

### Decision: Authoritative config = immutable published snapshot + live binding overlay

**Choice**: Admin publish writes a new `configuraciones_pasarela` row with `UNIQUE(predio_id, version)` and a JSON snapshot of slots/profiles. The gateway pointer `pasarelas.config_version_activa` advances monotonically. Poll returns that snapshot merged with live canonical slot/binding state (`unbound | pending_initial | confirmed | pending_reassignment`). Slot/profile edits that are not published do not affect poll. Binding mutations increment `bindings_revision` without rewriting old config rows.

**Alternatives considered**: Mutate a single JSON document in place; bump version on every candidate; serve only published bindings (hiding pending).

**Rationale**: Spec requires immutable versions on admin publish (`version 4` remains `version 4`) and poll that still shows pending/unbound slots. Splitting admin version from binding revision satisfies both without PostgreSQL JSONB operators.

### Decision: Binding history is temporal; technician selection is explicit

**Choice**: Physical UID/serial lives in `vinculos_fisicos`. The local technician first selects an existing prepared pending slot/area. The gateway submits UID/serial with that slot identity; the cloud never infers a slot from UID/serial. A candidate remains `pending` until the same authenticated gateway confirms its own previously submitted authorized candidate for that slot. Confirmation closes the previous `confirmed` row (`cerrado_en`) and activates the selected candidate. Readings always store `nodo_id` (logical area node) and capture time; they are never rewritten on reassignment. No user JWT is stored or sent by the edge.

**Alternatives considered**: Overwrite `nodos.numero_serie`; move historical readings to the new device; require a physical bind before ingest.

**Rationale**: Explicit selection prevents accidental or adversarial UID-to-area inference. Gateway scope plus candidate and slot ownership makes confirmation non-escalating without giving the edge a user JWT. Logical 1:1 `nodos.area_riego_id` already exists and remains the ingest identity.

### Decision: Global templates and property working sets

**Choice**: Admins manage lifecycle-versioned global templates with expected-area selectors, pending logical-node slot definitions, and hardware-profile links. Copying a selected active template version resolves only existing areas/nodes in the selected property into an independent, editable property working set. The working set becomes authoritative only when it is published as that property's configuration version.

**Rationale**: Global reuse reduces repeated provisioning setup while property copies preserve tenant scope and reviewability. A template cannot implicitly create a property, gateway, area, logical node, or physical binding; later template changes cannot mutate prior copies or published configuration.

### Decision: Canonical slot/binding state machine

**Choice**: Use only `unbound`, `pending_initial`, `confirmed`, and `pending_reassignment` for the slot-visible state. `unbound → pending_initial → confirmed` is initial activation. A replacement proposal transitions `confirmed → pending_reassignment`; the prior confirmed binding remains effective until local technician confirmation is recorded through the owning gateway's candidate-confirmation operation. A gateway may be active in every state, including partial activation with unbound or pending slots.

**Rationale**: This separates a prepared but unbound slot from a candidate awaiting confirmation and makes reassignment non-destructive. Binding-history rows retain proposal, confirmation, and closure times; readings remain assigned to the logical area node by capture time.

### Decision: Heartbeat last-seen columns and edge status mapping

**Choice**: Store `ultimo_heartbeat_en` (accepted at) on `pasarelas`. Compute simple status in the service. Do not insert a row per 5-minute beat. Do not create alerts or notifications.

**Alternatives considered**: Append-only heartbeat table; reuse Phase 2 inactivity alerts; encode status only in the frontend from reading freshness.

**Rationale**: Spec asks for the most recent accepted evidence, separate from reading freshness, and forbids active inactivity alerts. 288 rows/gateway/day would be noise. Existing `FreshnessIndicator` stays capture-time-based. The machine response maps cloud `inactive` and `never_seen` to edge `pending`, `recently_seen` to `connected`, `stale` to `delayed`, and `disconnected` to `disconnected`.

### Decision: Prepared-image update authorization, not OTA

**Choice**: An administrator may create a bounded update authorization for a named locally prepared image identity (version and immutable digest). The gateway retrieves only its own active authorization using its gateway credential. After the technician confirms locally, the gateway records that confirmation with the authorization identity and result. The cloud never transmits an image, executes an update, stores a user JWT on the edge, performs rollback, or coordinates gradual rollout.

**Rationale**: The v2 boundary supports auditable central control and local consent without expanding into fleet-management behavior.

### Decision: Additive Alembic; no dual-auth; chained PR slices

**Choice**: New tables and nullable columns only. `nodos.api_key` becomes nullable and unused for auth. Destructive drop of `api_key` is a later change after the observation window. Delivery uses chained PRs under `ask-on-risk` with a 400 authored-line target.

**Alternatives considered**: One PR with full cutover; drop `api_key` in the first migration; feature-flag both auth paths.

**Rationale**: Proposal rollback plan: additive until stable; never both auth paths in one runtime. Review budget is 400 lines.

## Data Flow

### Provision, activate, poll

```
Admin JWT                    Cloud                         Agro.io gateway
    │                          │                                │
    ├─ POST /properties/{id}/gateway ─► create pasarela+slots  │
    │                          │     publish config v1          │
    ├─ POST .../activation-references ─► hash opaque reference, 24h expiry │
    │                          │                                │
    │                          │◄── POST /gateways/activate ────┤
    │                          │    consume reference, issue gk_* │
    │                          │── credential once ────────────►│
    │                          │                                │
    │                          │◄── GET /gateways/me/configuration
    │                          │── snapshot vN + live bindings ►│
```

### Candidate bind and field-confirmed reassignment

```
Agro                         Cloud                         Admin JWT
 │                             │                              │
 ├─ POST /me/binding-candidates ─► pending vinculo            │
 │                             │   bindings_revision++        │
 │                             │                              │
    ├─ POST /me/binding-candidates/{id}/confirm ─► confirm own selected candidate
    │                             │   close previous confirmed   │
    │                             │   activate new; keep history │
 │◄─ poll shows confirmed ─────┤                              │
```

Temporal rule:

```
vinculo A  confirmed_at=T1  cerrado_en=T3
vinculo B  pending_at=T2    confirmed_at=T3  cerrado_en=NULL

lectura @ capture 12:00  → nodo lógico del área (unchanged when B replaces A)
```

### Gateway ingest (telemetry and NDVI)

```
Agro ── X-API-Key (gateway) + X-Event-ID + X-Logical-Node-Id ──► POST /readings
         │
         ├ validate_gateway_credential (hash, active, not revoked)
         ├ authorize logical node in active config (same property)
         ├ reject extra/static/NDVI/naive timestamp
         ├ mark suspicious if capture clock is anomalous
         ├ UNIQUE(gateway_id, nodo_id, event_id) + payload_hash
         └ store lecturas.marca_tiempo = capture time (not arrival)

Agro ── X-API-Key (gateway) + body.irrigation_area_id ──► POST /ndvi-snapshots
         │
         ├ same gateway auth
         ├ area must be in active config
         └ existing ndvi_ultimos scene+payload replay (unchanged storage)
```

### Heartbeat vs freshness

```
POST /gateways/me/heartbeat ──► pasarelas.ultimo_heartbeat_en = now_utc()
GET  /properties/{id}/gateway/status ──► recently_seen | stale | never_seen | inactive

GET  /readings/latest ──► max(marca_tiempo) for the area's logical node
UI FreshnessIndicator ──► elapsed from that capture timestamp (unchanged)
```

These two clocks are independent. A live gateway with a silent node is valid.

## Data Model

Spanish tables, English API. Alembic head today: `d4a8c2e67190`. Next revision revises that id.

### New tables

**`pasarelas`** — at most one per property

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `predio_id` | INT FK `predios.id` UNIQUE | One gateway per property |
| `estado` | ENUM/string | `pending_activation` \| `active` \| `revoked` |
| `credencial_hash` | CHAR(64) NULL UNIQUE | SHA-256 of `gk_*`; null until activation |
| `credencial_prefijo` | VARCHAR(16) NULL | Non-secret support label, not a slice of the secret |
| `config_version_activa` | INT NOT NULL DEFAULT 0 | Pointer into `configuraciones_pasarela.version` |
| `bindings_revision` | INT NOT NULL DEFAULT 0 | Increments on candidate/confirm/close |
| `ultimo_heartbeat_en` | DATETIME NULL | Cloud receive time of last accepted heartbeat |
| `activado_en` | DATETIME NULL | |
| `revocado_en` | DATETIME NULL | |
| timestamps + `eliminado_en` | | Same mixins as `nodos` |

**`referencias_activacion`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `pasarela_id` | INT FK | |
| `referencia_hash` | CHAR(64) UNIQUE | SHA-256 of a high-entropy opaque QR/token reference; never a gateway credential |
| `expira_en` | DATETIME | `creado_en + 24h` |
| `usado_en` | DATETIME NULL | Set on successful activation |
| `creado_en` | DATETIME | |

Lookup: hash submitted reference, require `usado_en IS NULL` and `expira_en > utc_now()`. Consume in the same transaction that writes `credencial_hash`; audit only issuer, issue/expiry/consumption timestamps, and outcome without token plaintext. Expired/consumed/unknown/malformed all return the same 401 without distinguishing (no oracle). At most one unused unexpired reference per gateway; issuing a new reference invalidates the previous unused hash.

**`perfiles_hardware`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `codigo` | VARCHAR(64) UNIQUE | e.g. `soil-probe-v1` |
| `nombre` | VARCHAR(150) | |
| `activo` | BOOL | |

Seed a small catalog. No device firmware/OTA fields.

**`plantillas_pasarela` and `versiones_plantilla_pasarela`** — global admin templates

| Record | Required content | Lifecycle and copy rule |
|--------|------------------|-------------------------|
| Template | Stable identity, name, lifecycle state | Draft, active, or retired; only active versions may start a new property copy. |
| Template version | Expected-area selectors, pending slot definitions, hardware-profile links | Immutable once published as an active template version. |
| Property copy | Source template/version reference plus resolved property slots | Resolves existing areas/nodes only into an independent property working set; later template edits never mutate it. |

Templates do not create a gateway, area, logical node, or physical binding. A property working set is separately reviewed and then published as `configuraciones_pasarela`.

**`ranuras_logicas`** — prepared slots; not physical binds

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `pasarela_id` | INT FK | |
| `nodo_id` | INT FK `nodos.id` UNIQUE | Existing logical node of this property |
| `area_riego_id` | INT FK | Denormalized for config; must match `nodos.area_riego_id` |
| `perfil_hardware_id` | INT FK NULL | |

Provisioning rejects areas from another property (404/403, no leak). Creating a slot does not create a `vinculos_fisicos` row.

**`configuraciones_pasarela`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `predio_id` | INT FK | |
| `pasarela_id` | INT FK | |
| `version` | INT NOT NULL | Monotonic per property; `UNIQUE(predio_id, version)` |
| `snapshot` | JSON | Immutable copy of slots + profile codes (no secrets) |
| `publicado_en` | DATETIME | |
| `publicado_por_usuario_id` | INT FK NULL | Admin who published |

JSON shape (generic `JSON`, SQLite-safe):

```json
{
  "gateway_id": 1,
  "property_id": 10,
  "slots": [
    {
      "slot_id": 3,
      "logical_node_id": 21,
      "irrigation_area_id": 7,
      "hardware_profile_code": "soil-probe-v1"
    }
  ]
}
```

**`vinculos_fisicos`** — binding history

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `pasarela_id` | INT FK | |
| `nodo_id` | INT FK | Logical node / slot |
| `uid` | VARCHAR(128) | Physical UID |
| `numero_serie` | VARCHAR(100) | Physical serial |
| `estado` | string | Binding-record lifecycle: `pending` \| `confirmed` \| `closed`; slot-visible state is the canonical state machine below. |
| `propuesto_en` | DATETIME | |
| `confirmado_en` | DATETIME NULL | |
| `cerrado_en` | DATETIME NULL | |
| `nodo_confirmado_id` | Computed INT NULL | `nodo_id` when `estado='confirmed'`, else NULL; UNIQUE |
| `uid_confirmado` | Computed VARCHAR NULL | `uid` when `estado='confirmed'`, else NULL; UNIQUE(`pasarela_id`, `uid_confirmado`) |

Portable uniqueness: InnoDB and SQLite allow multiple NULLs, so many historical/pending rows coexist. Service layer still rejects a second pending candidate for the same slot (409) and rejects a UID already pending/confirmed on another slot of this gateway.

If SQLite `Computed` fails in `conftest.py`, fall back to a 1:1 table `vinculos_confirmados_actuales(nodo_id UNIQUE, vinculo_id, pasarela_id, uid)` — same semantics, no partial indexes.

Canonical slot-visible transitions:

```
unbound --candidate--> pending_initial --technician confirms--> confirmed
confirmed --replacement candidate--> pending_reassignment
pending_reassignment --technician confirms--> confirmed
```

The final transition closes the previous binding-history record atomically. A pending replacement never removes the effective confirmed binding before confirmation.

### Modified tables

**`lecturas`**

| Column | Change |
|--------|--------|
| `pasarela_id` | INT FK NULL — required on new gateway ingest |
| `marca_tiempo_sospechosa` | BOOL NOT NULL DEFAULT false |
| uniqueness | Keep `uq_lecturas_nodo_event_id` for historical NULL-`pasarela_id` rows. Add `uq_lecturas_pasarela_nodo_event_id` on `(pasarela_id, nodo_id, event_id)`. New gateway rows MUST store non-null `event_id` and `pasarela_id`. |

Idempotency identity = authenticated gateway + logical node + `X-Event-ID`. The endpoint is implicit because `lecturas` is telemetry's dedicated persistence domain. Exact retry: same tuple + same `payload_hash` → 200. Conflict: same tuple, different hash → 409, no write. Different logical nodes may share an event ID. NDVI retains its separate scene-plus-payload replay identity.

**`nodos`**

- Remain 1:1 with `areas_riego`.
- `api_key` becomes **nullable**. Stop generating and stop returning it.
- Existing plaintext keys remain for rollback observation; they do not authenticate.
- `numero_serie` is no longer the physical source of truth. Geo/list responses MAY show the current confirmed binding serial via join; do not write physical UID onto the node on candidate submit.

**`ndvi_ultimos`** — unchanged. No NDVI column on `lecturas`.

### Heartbeat status computation

Constants in `app/core/config.py`:

- `GATEWAY_HEARTBEAT_TARGET_SECONDS = 300`
- `GATEWAY_STATUS_RECENT_SECONDS = 450` (1.5× target)
- `GATEWAY_STATUS_STALE_SECONDS = 900` (3× target)

| `estado` | `ultimo_heartbeat_en` | Status |
|----------|------------------------|--------|
| not `active` | any | `inactive` |
| `active` | NULL | `never_seen` |
| `active` | age ≤ 450s | `recently_seen` |
| `active` | 450s < age ≤ 900s | `stale` |
| `active` | age > 900s | `disconnected` |

No scheduler, no `Alert` insert, no email/WhatsApp. Client UI shows this beside, not instead of, `FreshnessIndicator`. The machine contract returns `edge_status`: `pending` for `inactive` or `never_seen`, `connected` for `recently_seen`, `delayed` for `stale`, and `disconnected` for `disconnected`.

### Suspicious capture timestamps

A telemetry event with a valid `...Z` timestamp is **accepted** and flagged when:

- capture > `utc_now()` + 1 hour, or
- capture < `utc_now()` − 30 days.

Store original `marca_tiempo`, set `marca_tiempo_sospechosa=true`. Latest/freshness still use `max(marca_tiempo)` including suspicious rows (they were accepted). Naive timestamps (no `Z`) → 422, no row.

## Interfaces / Contracts

### Auth boundaries

| Actor | Mechanism | Allowed operations |
|-------|-----------|--------------------|
| Admin | JWT `require_admin` | Provision, issue activation references, manage/copy templates, publish config, confirm bindings, rotate, revoke |
| Client user | JWT + property ownership | Read gateway status (no secrets), existing dashboard/history |
| Gateway | `X-API-Key` hashed credential | activate (reference only), poll config, submit/confirm selected candidates, heartbeat, telemetry, NDVI, retrieve update authorization, record technician update confirmation |
| Legacy node | `nodos.api_key` | **Rejected** after cutover on all machine endpoints |

Gateway credentials MUST NOT authorize `/users`, `/clients`, CRUD admin, or any actuator route (none exist; do not add them).

### Admin / user API

```
POST /api/v1/properties/{property_id}/gateway
  body: { "irrigation_area_ids": [1, 2], "hardware_profile_ids": { "1": 4 } }
  201: GatewayResponse (no secrets)
  409: property already has a gateway
  403/404: foreign area

GET  /api/v1/properties/{property_id}/gateway
GET  /api/v1/properties/{property_id}/gateway/status
  { "gateway_id", "status", "last_heartbeat_at", "config_version",
    "slots": [{ "logical_node_id", "irrigation_area_id", "binding_status",
                "bound_uid": null, "bound_serial": null }] }
  Client-visible status omits hashes, activation references, pending UIDs if that would leak
  install-time device identity to unauthorized roles. Admin status may include
  pending uid/serial. Clients see binding_status only.

POST /api/v1/gateways/{gateway_id}/activation-references
  201: { "activation_reference", "expires_at" }  // opaque plaintext once; safe for QR
  invalidates any previous unused reference; no credential is embedded

POST /api/v1/gateways/{gateway_id}/configuration
  body: slot/profile working set (or empty = publish current ranuras)
  201: { "version": N+1 }

POST /api/v1/gateways/{gateway_id}/credentials/rotate
  201: { "credential" } once; previous hash stops matching immediately

POST /api/v1/gateways/{gateway_id}/update-authorizations
  body: { "image_version", "image_digest", "expires_at" }
  201: cloud authorization metadata only; no image payload or OTA command

POST /api/v1/gateways/{gateway_id}/revoke
```

`GatewayResponse` never includes `activation_reference`, `credential`, hashes, or secret-derived values.

### Gateway machine API

```
POST /api/v1/gateways/activate
  body: { "activation_reference": "ar_..." }
  200: { "gateway_id", "property_id", "credential" }  // once
  401: expired / consumed / unknown / malformed (same body)

GET  /api/v1/gateways/me/configuration
  headers: X-API-Key
  optional: X-Config-Version, X-Bindings-Revision
  200: {
    "configuration_version": 4,
    "bindings_revision": 12,
    "property_id": 10,
    "slots": [{
      "logical_node_id": 21,
      "irrigation_area_id": 7,
      "hardware_profile_code": "soil-probe-v1",
       "binding_status": "pending_initial",
      "uid": "...",
      "serial": "..."
    }]
  }
  304: both version headers match current; otherwise 200 contains immutable snapshot plus live binding overlay
  403: other property / other gateway

POST /api/v1/gateways/me/binding-candidates
  body: { "slot_id": 3, "logical_node_id": 21, "irrigation_area_id": 7, "uid": "...", "serial": "..." }
  201 `pending_initial` or `pending_reassignment`; cloud validates selected slot/area and never infers them from UID; 409 duplicate candidate

POST /api/v1/gateways/me/binding-candidates/{candidate_id}/confirm
  headers: X-API-Key
  body: { "slot_id": 3, "technician_confirmed_at": "...Z" }
  200 only when candidate belongs to this gateway, was previously submitted for that authorized selected slot, and is pending; otherwise 403/404/409 with no state change

POST /api/v1/gateways/me/heartbeat
  204; updates ultimo_heartbeat_en

GET /api/v1/gateways/me/update-authorization
  headers: X-API-Key
  200 active authorization metadata for this gateway; 204 none; no image bytes, OTA command, rollback, or rollout plan

POST /api/v1/gateways/me/update-confirmations
  headers: X-API-Key
  body: { "authorization_id": "...", "image_version": "...", "image_digest": "...", "technician_confirmed_at": "...Z", "result": "confirmed" }
  201 records local technician confirmation only when it matches this gateway's active authorization
```

### Telemetry (cutover)

```
POST /api/v1/readings
  X-API-Key: gk_...
  X-Event-ID: uuid
  X-Logical-Node-Id: int
  body: v2 telemetry schema (same 12 fields as v1; extra=forbid; timestamp ...Z)
  201 created { id, node_id, timestamp, created_at }
  200 exact retry
  401 invalid/legacy key
  403 inactive gateway, unconfigured logical node, cross-property
  409 event identity reused with different body
  422 naive timestamp, extra fields, NDVI, static data
```

`ReadingCreate` gains `extra="forbid"` and the NDVI-style `Z` validator. `ingest_reading(db, gateway, node, data, event_id, payload_hash)` looks up `(pasarela_id, nodo_id, event_id)`.

### NDVI (cutover)

```
POST /api/v1/ndvi-snapshots
  X-API-Key: gk_...
  body: contracts/edge-cloud/v2/ndvi.schema.json (copy of v1 schema)
  authorize data.irrigation_area_id ∈ active config areas
  replay/conflict/stale behavior in services/ndvi.py unchanged
```

GET `/api/v1/ndvi-snapshots/latest` stays JWT + `validate_area_access`.

### Contract v2 files

```
contracts/edge-cloud/v2/
  README.md                 # gateway credential, X-Logical-Node-Id, poll/heartbeat/activate
  telemetry.schema.json     # copy of v1 12-field body
  ndvi.schema.json          # copy of v1 point NDVI
  SHA256SUMS
  fixtures/                 # credential-free; same valid/invalid cases as v1 plus identity notes
```

v1 folder is not edited except a one-line pointer in its README: “Superseded for runtime by v2 after gateway cutover; frozen.”

`machine-contract.md` in this change is the normative planning source for v2 operations until a separately authorized implementation publishes physical files under `contracts/edge-cloud/v2/`.

### Pydantic / service shapes (project language)

Follow existing English schema / Spanish column aliases (`Field(validation_alias=...)`).

```python
class GatewayActivateRequest(BaseModel):
    activation_reference: str

class GatewayActivateResponse(BaseModel):
    gateway_id: int
    property_id: int
    credential: str  # issuance only

class ConfigurationPollResponse(BaseModel):
    configuration_version: int
    bindings_revision: int
    property_id: int
    slots: list[ConfigSlot]

class GatewayStatusResponse(BaseModel):
    gateway_id: int
    property_id: int
    status: Literal["inactive", "never_seen", "recently_seen", "stale", "disconnected"]
    edge_status: Literal["pending", "connected", "delayed", "disconnected"]
    last_heartbeat_at: datetime | None
    configuration_version: int
```

## File Changes

### Backend — create

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models/gateway.py` | Create | `Gateway` (`pasarelas`) |
| `backend/app/models/activation_reference.py` | Create | Protected 24h QR/token references and audit-safe lifecycle metadata |
| `backend/app/models/gateway_template.py` | Create | Global templates, versions, and property-copy provenance |
| `backend/app/models/hardware_profile.py` | Create | Profile catalog |
| `backend/app/models/gateway_slot.py` | Create | Prepared logical slots |
| `backend/app/models/gateway_config.py` | Create | Versioned JSON snapshots |
| `backend/app/models/physical_binding.py` | Create | Binding history + computed uniqueness |
| `backend/app/schemas/gateway.py` | Create | Provision, activate, poll, status, rotate |
| `backend/app/services/gateway.py` | Create | Provision, 1:1 property, activation-reference issue/consume, template copy, rotate, revoke, status |
| `backend/app/services/gateway_config.py` | Create | Publish monotonic version, poll merge |
| `backend/app/services/binding.py` | Create | Candidate, confirm, close, history |
| `backend/app/api/v1/endpoints/gateways.py` | Create | Admin + machine gateway routes |
| `backend/alembic/versions/<rev>_add_gateway_control_plane.py` | Create | Tables above; revises `d4a8c2e67190` |
| `backend/alembic/versions/<rev>_add_gateway_ingest_columns.py` | Create | `lecturas.pasarela_id`, `marca_tiempo_sospechosa`; new unique index; nullable `nodos.api_key` |
| `backend/tests/unit/test_gateway_service.py` | Create | Expiry, single use, 1:1 property, status windows |
| `backend/tests/unit/test_binding_service.py` | Create | Pending vs confirmed, reassignment history |
| `backend/tests/unit/test_gateway_config_service.py` | Create | Monotonic versions, isolation |
| `backend/tests/integration/test_gateways_api.py` | Create | Activate/poll/heartbeat/rotate/confirm |
| `backend/tests/integration/test_gateway_ingest.py` | Create | Auth, unconfigured node, extra fields, suspicious ts |

### Backend — modify

| File | Action | Description |
|------|--------|-------------|
| `backend/app/models/__init__.py` | Modify | Export new models |
| `backend/app/models/property.py` | Modify | `gateway` relationship |
| `backend/app/models/node.py` | Modify | Nullable `api_key`; relationship to slots/bindings |
| `backend/app/models/reading.py` | Modify | `pasarela_id`, suspicious flag, new unique index |
| `backend/app/core/deps.py` | Modify | Add `validate_gateway_credential`; stop using `validate_api_key` on ingest |
| `backend/app/core/config.py` | Modify | Heartbeat/status thresholds |
| `backend/app/api/v1/router.py` | Modify | Include `gateways` router |
| `backend/app/api/v1/endpoints/readings.py` | Modify | Gateway dep, `X-Logical-Node-Id`, pass gateway into service |
| `backend/app/api/v1/endpoints/ndvi_snapshots.py` | Modify | Gateway dep; authorize area via config, not `node.area_riego_id` from API key |
| `backend/app/api/v1/endpoints/nodes.py` | Modify | Create returns `NodeResponse` (no `api_key`) |
| `backend/app/services/reading.py` | Modify | Idempotency tuple; suspicious marker; do not expand Phase 2 alerts |
| `backend/app/services/node.py` | Modify | Stop `_generate_api_key`; geo join current confirmed serial |
| `backend/app/services/ndvi.py` | Modify | No storage change; caller supplies authorized area |
| `backend/app/schemas/reading.py` | Modify | `extra="forbid"`; `Z` timestamp validator; expose `timestamp_suspicious` on history if useful |
| `backend/app/schemas/node.py` | Modify | Remove `NodeCreateResponse.api_key` or stop using it |
| `backend/app/db/seed.py` | Modify | Seed hardware profiles + optional demo gateway without plaintext secrets in repo |
| `backend/tests/conftest.py` | Modify | `gateway_headers` fixture; keep `node_headers` only where tests assert rejection |
| `backend/tests/integration/test_readings_api.py` | Modify | Gateway ingest |
| `backend/tests/integration/test_reading_idempotency.py` | Modify | Scope by gateway + logical node |
| `backend/tests/integration/test_ndvi_api.py` | Modify | Gateway auth |
| `backend/tests/integration/test_nodes_api.py` | Modify | Create does not return `api_key` |
| `backend/tests/integration/test_permissions.py` | Modify | Cross-property gateway isolation |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/services/gateways.ts` | Create | Admin provision/activation-reference/template/config/confirm/rotate + status GET |
| `frontend/src/app/pages/admin/GatewayManagement.tsx` | Create | Property gateway lifecycle UI (activation reference shown once for QR, no persistence of secret) |
| `frontend/src/app/components/GatewayStatusBadge.tsx` | Create | Simple status, distinct from `FreshnessIndicator` |
| `frontend/src/app/components/GatewayStatusBadge.test.tsx` | Create | Status labels |
| `frontend/src/app/routes.tsx` | Modify | `/admin/pasarelas`, `/admin/predios/:predioId/pasarela` |
| `frontend/src/app/components/navigation/items.ts` | Modify | Admin nav item |
| `frontend/src/app/pages/admin/PropertyManagement.tsx` | Modify | Entry to provision gateway |
| `frontend/src/app/pages/admin/NodeManagement.tsx` | Modify | Stop displaying `api_key`; logical node only |
| `frontend/src/app/pages/admin/NodeDetail.tsx` | Modify | Binding history + no secret |
| `frontend/src/app/pages/client/PropertyDetail.tsx` | Modify | Gateway status + area freshness side by side |
| `frontend/src/app/pages/client/dashboard/DesktopDashboard.tsx` | Modify | Optional gateway chip; keep `FreshnessIndicator` |
| `frontend/src/app/pages/client/dashboard/MobileDashboard.tsx` | Modify | Same |
| `frontend/src/app/components/FreshnessIndicator.tsx` | Modify | Copy: “datos del nodo”, not gateway connectivity |
| `frontend/src/app/services/nodes.ts` | Modify | Drop `api_key?` from types |

### Contracts, simulator, manifests, docs, OpenSpec

| File | Action | Description |
|------|--------|-------------|
| `contracts/edge-cloud/v2/**` | Create | Gateway contract + credential-free fixtures + SHA256SUMS |
| `contracts/edge-cloud/v1/README.md` | Modify | Frozen; pointer to v2 |
| `simulator/simulator.py` | Modify | `--gateway-key` + `--logical-node-id` + `X-Event-ID`; reject `--api-key` as node key |
| `simulator/simulator_fast.py` | Modify | Same |
| `simulator/README.md` | Modify | Gateway usage |
| `scripts/integration/manifests/h1-*.json` | Modify | `gateway_secret_ref` + `logical_node_id`; drop per-node ingest keys |
| `openspec/config.yaml` | Modify | Context: gateway credential, MySQL 8, NDVI separate |
| `openspec/specs/readings/spec.md` | Modify | Merged at archive; delta already in change |
| `openspec/specs/security/spec.md` | Modify | At archive |
| `openspec/specs/data-model/spec.md` | Modify | At archive |
| `AGENTS.md` | Modify | Simulator posts with gateway key; no new Phase 2; NDVI still separate |
| `docs/api.md` | Modify | New routes; ingest headers |
| `docs/security.md` | Modify | Gateway secrets, no dual auth |
| `docs/stack.md` | Modify | MySQL 8 remains; no Postgres |
| `docs/architecture/overview.md` | Modify | Gateway in the path |
| `docs/architecture/backend.md` | Modify | New modules; auth |
| `docs/architecture/frontend.md` | Modify | Admin gateway UI; status vs freshness |
| `docs/architecture/decisions.md` | Modify | ADR: MySQL 8 + gateway cutover |
| `docs/data-model.md` | Modify | New tables |
| `docs/integration/README.md` | Create | Integration entry: v2 contract, Agro.io paired work, no Agro.io code here |
| `docs/testing.md` | Modify | Gateway fixtures |

Do not modify Agro.io. Paired requirements belong in `docs/integration/README.md` as an external checklist.

## Testing Strategy

Project TDD is off (`openspec/config.yaml`). Tests still run with `uv run pytest` and `npm test`. RED tests below are required coverage, not a TDD ceremony.

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | Code consume/expiry; duplicate property gateway; monotonic config versions; computed active-binding uniqueness; heartbeat status windows; suspicious timestamp rules; SHA-256 not logged | `backend/tests/unit/test_gateway_*.py` with SQLite session from `conftest.py` |
| Unit | Binding close-on-reassign leaves historical row; readings stay on `nodo_id` | `test_binding_service.py` |
| Integration | Activate once; retry consumed reference 401; poll isolation; 304; canonical candidate states; confirm reassignment; heartbeat 401 without credential | `test_gateways_api.py` via TestClient |
| Integration | Gateway telemetry 201/200/409; legacy node key 401; unconfigured logical node 403; extra field 422; naive ts 422; late event does not change latest | extend `test_readings_api.py`, `test_reading_idempotency.py` |
| Integration | NDVI gateway auth; unauthorized area 403; polygon 422; exact replay 200; conflict 409; telemetry with NDVI field 422 | `test_ndvi_api.py` |
| Integration | Rotate invalidates old key on next ingest; list/status JSON has no `credential`/`activation_reference`/`api_key` | `test_gateways_api.py` + nodes list |
| Frontend | Status badge labels; management page does not render secrets after navigation | vitest + testing-library |
| Contract | v2 fixtures validate; v1 fixtures still validate against frozen v1 | existing contract tests / SHA256SUMS |
| Migration | `alembic upgrade head` on empty MySQL 8; downgrade only when new tables are empty | documented in rollout; not required in SQLite unit suite |

`node_headers` fixture is retained to prove **rejection**. Happy-path ingest uses `gateway_headers`.

## Threat Matrix

N/A — this change adds FastAPI HTTP routes and database tables only. It does not alter documentation-like executable classification, git repository selection, commit/push/index semantics, or PR command composition. No shell/subprocess or VCS/PR automation boundary is introduced.

HTTP authorization threats **are** covered as ordinary spec tests (legacy key, cross-property, secret leakage), not as threat-matrix rows.

## Migration / Rollout

### Alembic slices (additive)

1. Control-plane tables (`pasarelas` … `vinculos_fisicos`) — runtime still on node keys until slice 4 is deployed **and** cut over.
2. `lecturas.pasarela_id`, `marca_tiempo_sospechosa`, new unique index, nullable `nodos.api_key`.
3. Do **not** drop `nodos.api_key` in this change.

SQLite tests use `Base.metadata.create_all`; both migrations must be reflected in models so create_all matches.

### Runtime cutover (no dual auth)

1. Publish `contracts/edge-cloud/v2` and wait for paired Agro.io readiness (external).
2. Deploy cloud with gateway routes **disabled or unused** while Agro still on v1 — only possible **before** replacing `validate_api_key`. Because dual-auth is forbidden, the ingest dependency swap and Agro cutover are the same release train.
3. Coordinated switch: cloud build that uses `validate_gateway_credential` + Agro build that sends `gk_*` + `X-Logical-Node-Id`.
4. Observation window: keep old `api_key` values; they never authenticate.
5. Later (out of this change): drop `nodos.api_key`.

### Rollback

| When | Action |
|------|--------|
| Before ingest swap | Disable gateway routers; additive tables may remain empty; Alembic downgrade allowed if empty |
| After cutover | Stop gateway traffic; redeploy last cloud release that matches Agro's contract; **do not** drop tables with history |
| Secrets leaked | Rotate; consumed activation references stay consumed |

Never enable node keys and gateway keys in one process.

### Chained PR forecast (for `sdd-tasks`)

Suggested autonomous slices under 400 authored lines:

1. Models + Alembic control plane + unit uniqueness
2. Activation references + template/admin provision API
3. Config publish/poll
4. Bindings + confirm
5. Gateway ingest + idempotency + suspicious ts
6. NDVI auth swap
7. Heartbeat + status API
8. Admin/client frontend
9. Contract v2 + simulator + manifests + docs/`AGENTS.md`/`openspec/config.yaml`

`Decision needed before apply: Yes` if a slice exceeds 400 lines (`ask-on-risk`). `Chained PRs recommended: Yes`. `400-line budget risk: High`.

## Open Questions

None that block design. Settled: MySQL 8; complete credential replacement; NDVI separate; Agro.io out of this repo; mobile/OTA/commands/Phase 2/Postgres deferred.

Non-blocking implementation notes (tasks may pick defaults below without product input):

- If SQLite rejects `Computed` columns, use `vinculos_confirmados_actuales` instead — same unique semantics.
- Admin UI may show the activation reference as a QR-ready value in a one-time dialog only; do not store it in React state after unmount.
- Hardware profile catalog can ship with 2–3 seed rows; full profile CRUD UI can stay minimal.

## Deferred and external

### Coordinated external acceptance matrix

This matrix is an integration acceptance contract, not an implementation claim about Agro.io or a scope expansion for IoT_Sensors.

| External behavior | IoT_Sensors acceptance boundary | Owner / status |
|-------------------|---------------------------------|----------------|
| Local installation UI first; phone helper deferred | Cloud APIs support local-screen activation/configuration workflows. | Agro.io local UI; phone helper deferred. |
| Prepared image activates online, then polls and caches the last valid configuration | Safe one-time activation and versioned configuration poll contract. | Agro.io image, client, polling, cache. |
| Outbox retries; confirmed data retained 30 days; pending data protected under disk pressure | Telemetry and NDVI preserve their separate exact-retry/conflict behavior for valid retries. | Agro.io outbox, retention, disk policy. |
| Five-minute heartbeat | Accept latest heartbeat and expose gateway status separately from reading freshness. | Agro.io heartbeat client/scheduler. |
| Central authorization plus technician confirmation for updates | v2 update-authorization retrieval and gateway-authenticated local-confirmation recording; no image delivery. | Agro.io local prepared-image execution and technician workflow. |
| OTA, rollback automation, gradual rollout | No boundary in this change. | Deferred. |

| Item | Owner |
|------|-------|
| Agro.io local UI, discovery, cache, outbox, 30-day retention, disk pressure, prepared image | Agro.io (external) |
| Mobile/GPS installation helper | Deferred |
| Physical actuator commands | Deferred |
| OTA, automated rollback, gradual rollout | Deferred |
| PostgreSQL / TimescaleDB / partitioning | Deferred |
| Polygon NDVI, NDVI history | Deferred |
| Phase 2 alerts, notifications, AI, n8n | Existing flags stay OFF; do not expand |
