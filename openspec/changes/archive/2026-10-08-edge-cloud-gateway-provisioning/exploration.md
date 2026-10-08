# Exploration: edge-cloud-gateway-provisioning

Cloud core should receive normalized events from one authorized Agro.io gateway per property, with cloud-owned installation provisioning. Direct per-node ingest is replaced. PostgreSQL vs MySQL is unresolved until evidence.

## Current State

IoT_Sensors is a FastAPI/MySQL cloud that authenticates **each physical/logical node** with a unique `X-API-Key` on `POST /api/v1/readings` and `POST /api/v1/ndvi-snapshots`. `validate_api_key` maps the header to `nodos` (`api_key` unique, 1:1 with `areas_riego`). Edge-cloud v1 still documents per-node keys. Idempotency (C2) is scoped by authenticated node + `X-Event-ID`. Simulator, seeds, and H1 manifests all assume one secret per node.

There is **no** gateway entity, install QR, config version, heartbeat, binding workflow, or hardware-profile model. NDVI latest-point is already a separate event (`ndvi_ultimos`), not telemetry.

Prior Engram (`planning/four-day-integration`) treated gateway-first auth as **out of the critical path**. This change **supersedes** that scope for product evolution; it does not reopen settled product decisions listed below.

```
TODAY                         TARGET
PC/simulator ──X-API-Key──►   Raspberry/Agro (1/property)
   per node POST readings        │  gateway credential
                                 ▼
Cloud Node 1:1 area            Cloud: property gateway +
                               logical nodes (1/area)
```

## Affected Areas

| Path | Why |
|------|-----|
| `backend/app/core/deps.py` | Replace node-key auth with gateway credential + event identity |
| `backend/app/api/v1/endpoints/readings.py` | Gateway ingest; bind by area/logical node, not sender key |
| `backend/app/api/v1/endpoints/ndvi_snapshots.py` | Same credential; still separate event |
| `backend/app/models/node.py` | Logical cloud node; drop/retire per-node `api_key` |
| `backend/app/services/node.py`, `schemas/node.py` | Provisioning vs field bind |
| New models (gateway, install code, config version, bindings, heartbeat) | Not present |
| `contracts/edge-cloud/v1/README.md` + schemas | Auth and identity headers |
| `openspec/specs/readings/spec.md`, `security/spec.md`, `data-model/spec.md` | Direct contradiction with gateway-first |
| `openspec/config.yaml`, `AGENTS.md`, `docs/api.md`, `docs/architecture/*`, `docs/security.md`, `docs/stack.md` | Per-node ingest language |
| `simulator/*`, `scripts/integration/manifests/*` | Per-node keys |
| `backend` Docker/Alembic/MySQL | Engine evaluation only; no engine decision here |

## Settled product decisions (do not re-ask)

- One gateway/Raspberry per property; many areas; one **logical** cloud node per area.
- 24-hour one-time QR/code; first activation needs internet.
- Cloud prepares templates, areas, hardware profiles, pending slots; Agro local UI discovers UID/serial, proposes/validates binds; partial activation allowed.
- Unexpected nodes are **candidates for existing areas only**.
- One gateway credential replaces per-node keys; **complete** replacement of direct node ingest.
- Cloud config is authoritative and versioned; Agro caches last valid config and polls.
- Physical area reassignment needs field confirmation; history stays with the prior area by **capture time**.
- Telemetry normalized only; soil values that exist ship now; missing v1 fields are `null`.
- Late events keep original capture time; anomalous timestamps retained as suspicious.
- Local pending until accepted; confirmed local data 30 days; pending protected under disk pressure (edge; cloud must accept retries).
- Heartbeat every 5 minutes; gateway status ≠ node status; clients see simple status.
- Latest-point NDVI from day one; separate event; never a 13th telemetry field.
- First release: prepared Raspberry image; updates = central authorize + technician confirm. OTA/rollback/gradual rollout later.
- Mobile/GPS helper deferred; field work on Agro local screen.
- **Do not choose PostgreSQL vs MySQL without evidence.**

## Approaches

### 1. Cutover: gateway credential + identity in event (recommended)

New `gateways` (property-scoped credential), `install_codes` (24h, single use), versioned `property_configs`, `node_bindings` (logical node ↔ UID/serial), `gateway_heartbeats`. Ingest authenticates the **gateway**, then maps `area_id` / logical `node_id` from the authorized config. Node `api_key` removed after migration.

- Pros: Matches product; one secret to rotate; matches “one Raspberry per property”.
- Cons: Breaks current contract, simulator, C2 identity scope, H1 manifests in one program of work.
- Effort: High (one complete PR per GitHub issue).

### 2. Dual-auth window (gateway + legacy node keys)

Keep `validate_api_key` while adding gateway path.

- Pros: Safer ops migration.
- Cons: **Conflicts** with accepted “complete replacement”; two security models; docs stay inconsistent longer.
- Effort: Medium-High.

### 3. Gateway as HTTP proxy still using per-node keys internally

Raspberry holds N keys and POSTs as today.

- Pros: Smallest code change.
- Cons: Rejects settled credential model; provisioning/QR/config version still missing.
- Effort: Low for ingest, High for product gap. **Do not use.**

## PostgreSQL vs MySQL (evaluate, do not decide)

| Factor | MySQL 8 (current) | PostgreSQL |
|--------|-------------------|------------|
| Production/Dokploy/Alembic/SQLAlchemy | Already running | Migration cost, dual dialect, test SQLite |
| Versioned JSON config, suspicious-flag, outbox-like idempotency | JSON columns exist; weaker constraints/NOTIFY | JSONB, richer constraints, LISTEN |
| Team/docs/SRS | All MySQL | Would rewrite stack contract |

**Spike before design lock:** list required constraints (gateway 1:1 property, binding uniqueness, config `version` monotonic, event-id uniqueness **per gateway+endpoint**). Measure Alembic port cost. Decision belongs in `sdd-design` after that spike, not here.

## Documentation surfaces that must become consistent

1. `contracts/edge-cloud/v1/README.md` — `X-API-Key` “assigned to the sending node”.
2. `openspec/config.yaml` context — “readings via X-API-Key”.
3. `openspec/specs/readings/spec.md` — per-node ingest; `0` or `null` (v1 requires `null` only).
4. `openspec/specs/security/spec.md` — node keys, no JWT for nodes.
5. `openspec/specs/data-model/spec.md` — node API key on create; 1:1 node/area still valid as **logical** node.
6. `AGENTS.md` — simulator POSTs with node key every 10 min.
7. `docs/api.md`, `docs/security.md`, `docs/architecture/overview.md`, `docs/stack.md`.
8. Integration C2 spec (idempotency keyed by **node**).
9. Memory `planning/four-day-integration` (gateway auth was deferred).

## Contradictions (code/docs vs this change)

- Per-node `X-API-Key` vs one gateway credential.
- Readings spec allows `0` or `null` for missing sensors vs v1/`null` only (already a contract split; gateway work must not reintroduce `0` as unavailable).
- C2 idempotency identity = authenticated **node**; gateway ingest should key by gateway + logical node + event id.
- NDVI ingest also uses node key; must move to gateway without becoming telemetry.
- “Any HTTP client with a node key can ingest” vs authorized gateway only.
- Four-day plan deferred fleet provisioning; this change is that fleet.

## Recommendation

Proceed to **proposal** with Approach 1. Keep engine choice as an explicit design spike. Deliver one complete PR per GitHub issue: (1) domain + gateway auth + install codes, (2) config poll + bindings, (3) ingest/idempotency/NDVI header change, (4) heartbeat/status UX, (5) doc/contract/simulator cutover.

Agro.io owns local UI, cache, pending disk policy, image; this repo owns cloud provisioning, credentials, canonical history, status for clients.

## Risks

- Contract break with Agro if v1 README is not versioned (`v1.1` or `v2`) before code cutover.
- Idempotency scope change can duplicate or 409 valid retries if identity is wrong.
- Partial activation vs 1:1 unique `nodos.area_riego_id` (pending slots without a physical bind).
- MySQL→Postgres if chosen late after new tables exist.
- Heartbeat 5 min vs client “simple status” vs existing freshness (≥20 min Phase 2 inactivity).
- Install QR/secrets in logs (existing seed already stores plaintext node keys).
- Oversized first PR; must chain.

## Ready for Proposal

Yes. Orchestrator should tell the user: product decisions are captured; next is `sdd-propose`. Remaining non-product item is **database engine evidence**, not a product question.
