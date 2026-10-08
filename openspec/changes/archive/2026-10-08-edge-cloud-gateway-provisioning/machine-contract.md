# Version 2 Machine Contract

## Status and boundary

This is the normative **planning** definition of the gateway-authenticated v2 machine contract. It does not create a physical contract file, endpoint, schema, migration, test, or runtime behavior. A later authorized implementation must publish equivalent material under `contracts/edge-cloud/v2/` without changing these semantics.

All machine operations use HTTPS and JSON. Except activation, every machine operation requires `X-API-Key: gk_…`, which authenticates exactly one active gateway. Machine requests never use, receive, store, or forward a user JWT. `X-Request-ID` is optional diagnostic metadata and has no idempotency meaning.

## Common error envelope

All non-empty error responses use:

```json
{
  "code": "machine_error_code",
  "message": "Stable operator-safe message",
  "request_id": "optional-correlation-id"
}
```

`401` means missing, invalid, revoked, inactive, or legacy machine credentials. Activation reference failures use the same `401` envelope regardless of malformed, unknown, expired, or consumed state. `403` means an authenticated gateway is outside its authorized property, slot, area, candidate, or update-authorization scope. `404` means the identified resource is not visible to that gateway. `409` means a duplicate, conflicting, stale-state, or non-repeatable transition. `422` means a syntactically valid JSON request fails its schema or value rules. `429` and `5xx` are retryable unless an operation states otherwise.

Retries use exponential backoff with jitter. A client MUST NOT retry `401`, `403`, `404`, or `422` without changing its credentials or request. A client MUST reconcile `409` through configuration poll or the operation's returned state before retrying.

## Canonical status and configuration overlay

Cloud status is canonical: `inactive`, `never_seen`, `recently_seen`, `stale`, or `disconnected`. The edge-local projection is exactly:

| Cloud status | Edge status |
|---|---|
| `inactive`, `never_seen` | `pending` |
| `recently_seen` | `connected` |
| `stale` | `delayed` |
| `disconnected` | `disconnected` |

A configuration response contains an immutable `configuration` snapshot and a live `binding_overlay`. The overlay contains each `slot_id`, `logical_node_id`, `irrigation_area_id`, canonical binding status, and any visible current or pending binding metadata. Binding changes advance `bindings_revision` without changing `configuration_version`.

## Operations

### Activation

`POST /api/v1/gateways/activate`

- **Headers:** `Content-Type: application/json`; no gateway credential; optional `X-Request-ID`.
- **Request schema:** `{ "activation_reference": "ar_…" }`; the reference is opaque and high entropy.
- **Success:** `200` with `{ "gateway_id": integer, "property_id": integer, "credential": "gk_…" }`. The credential is returned once and is never returned by later operations.
- **Errors:** `401` for every invalid reference state; `409` if an already active gateway cannot consume another reference; `422` for invalid JSON/schema.
- **Retry:** The request is non-repeatable after successful consumption. After an uncertain response, the gateway MUST poll configuration using the credential only if it received it; otherwise it MUST obtain a newly issued reference through the technician/admin workflow.

### Configuration poll

`GET /api/v1/gateways/me/configuration`

- **Headers:** `X-API-Key` required; `X-Config-Version` and `X-Bindings-Revision` optional non-negative integers; optional `X-Request-ID`.
- **Success:** `200` with `{ "configuration_version": integer, "bindings_revision": integer, "property_id": integer, "configuration": { "slots": [...] }, "binding_overlay": { "slots": [...] }, "cloud_status": string, "edge_status": string }`.
- **Conditional result:** `304` with no body only when both submitted version headers exactly equal the current values. If either differs, the server returns `200` with the full snapshot and overlay.
- **Errors:** common `401`/`403`; `422` for malformed conditional headers.
- **Retry:** Safe and idempotent. On `304`, the gateway retains its cached snapshot and overlay; on `200`, it atomically replaces both cached views.

### Candidate submission

`POST /api/v1/gateways/me/binding-candidates`

- **Headers:** `X-API-Key` and `X-Event-ID` (UUID or equivalent opaque idempotency key) required; `Content-Type: application/json`; optional `X-Request-ID`.
- **Request schema:** `{ "slot_id": integer, "logical_node_id": integer, "irrigation_area_id": integer, "uid": string, "serial": string }`. The local technician selects the prepared pending slot/area before this request. UID or serial alone is invalid and never selects a slot.
- **Success:** `201` with `{ "candidate_id": integer, "slot_id": integer, "binding_status": "pending_initial|pending_reassignment", "submitted_at": "RFC3339 UTC" }`.
- **Errors:** `403` for a slot/area outside the gateway's active configuration; `409` for duplicate UID, duplicate pending candidate, or repeated key with a different body; `422` for missing selected identifiers or invalid fields.
- **Retry:** Identity is gateway + `X-Event-ID`. An exact retry returns `200` with the original candidate; the same identity with a different body returns `409` and creates nothing.

### Gateway candidate confirmation

`POST /api/v1/gateways/me/binding-candidates/{candidate_id}/confirm`

- **Headers:** `X-API-Key`, `X-Event-ID`, and `Content-Type: application/json` required; optional `X-Request-ID`.
- **Request schema:** `{ "slot_id": integer, "technician_confirmed_at": "RFC3339 UTC" }`.
- **Success:** `200` with `{ "candidate_id": integer, "slot_id": integer, "binding_status": "confirmed", "confirmed_at": "RFC3339 UTC" }`.
- **Authorization:** The candidate MUST have been submitted previously by this gateway, MUST remain pending, and MUST belong to the stated slot in the gateway's current authorized configuration. The confirmation cannot activate another gateway's candidate, a different slot, or a UID/serial-derived slot. No JWT participates.
- **Errors:** `403` for foreign or unauthorized candidates/slots; `404` for invisible candidates; `409` for already resolved or stale candidates; `422` for invalid schema.
- **Retry:** Identity is gateway + `X-Event-ID`; an exact retry returns the resulting confirmed state. A conflicting retry returns `409` without another transition.

### Heartbeat

`POST /api/v1/gateways/me/heartbeat`

- **Headers:** `X-API-Key` required; optional `X-Event-ID` and `X-Request-ID`; no request body.
- **Success:** `204`; the cloud receive time becomes the latest accepted heartbeat.
- **Errors:** common `401`/`403`; `422` if a body or invalid header form is supplied.
- **Retry:** Safe. Repeated accepted heartbeats update only the last-seen value and do not create heartbeat history rows.

### Telemetry

`POST /api/v1/readings`

- **Headers:** `X-API-Key`, `X-Logical-Node-Id`, `X-Event-ID`, and `Content-Type: application/json` required; optional `X-Request-ID`.
- **Request schema:** v2 telemetry body: mandatory UTC `timestamp` ending in `Z`; exactly `soil` (4 fields), `irrigation` (3 fields), and `environmental` (5 fields). Dynamic values may be number or `null`; `irrigation.active` may be boolean or `null`; `0` is a measured value. Extra, static, physical-device, and NDVI fields are forbidden.
- **Success:** `201` with reading metadata, or `200` for exact replay.
- **Errors:** common `401`/`403`; `409` for gateway + logical node + event ID reused with a different payload; `422` for schema, extra fields, or non-UTC timestamps.
- **Retry:** Identity is gateway + logical node + `X-Event-ID`. Exact payload replay returns the existing reading; conflicting payload replay returns `409` and writes nothing.

### Latest-point NDVI

`POST /api/v1/ndvi-snapshots`

- **Headers:** `X-API-Key` and `Content-Type: application/json` required; optional `X-Request-ID`.
- **Request schema:** v2 NDVI event with `irrigation_area_id`, latest point value, provider, `sentinel-2-l2a` collection, scene identity, UTC scene observation time, cloud cover, and `sample_method: "point"`.
- **Success:** `201` for a new latest snapshot or `200` for exact replay.
- **Errors:** common `401`/`403`; `409` for a scene identity reused with a different full payload; `422` for non-point, invalid provenance, schema violations, or telemetry-shaped fields.
- **Retry:** Replay identity is scene identity plus complete payload. Exact replay returns the existing snapshot; conflict never overwrites it.

### Update authorization

`GET /api/v1/gateways/me/update-authorization`

- **Headers:** `X-API-Key` required; optional `X-Request-ID`.
- **Response schema:** `200` with `{ "authorization_id": string, "image_version": string, "image_digest": string, "expires_at": "RFC3339 UTC" }`, or `204` when no active authorization exists.
- **Errors:** common `401`/`403`.
- **Retry:** Safe and idempotent. It returns authorization metadata only: never image bytes, an OTA command, rollback instructions, or rollout state.

### Update confirmation

`POST /api/v1/gateways/me/update-confirmations`

- **Headers:** `X-API-Key`, `X-Event-ID`, and `Content-Type: application/json` required; optional `X-Request-ID`.
- **Request schema:** `{ "authorization_id": string, "image_version": string, "image_digest": string, "technician_confirmed_at": "RFC3339 UTC", "result": "confirmed" }`.
- **Success:** `201` with recorded confirmation metadata.
- **Errors:** `403` for another gateway's authorization; `409` for expired, consumed, or mismatched authorization/image identity and for conflicting retries; `422` for invalid schema.
- **Retry:** Identity is gateway + `X-Event-ID`. Exact replay returns `200` with the original confirmation. This operation records local technician confirmation only; it does not transfer, install, roll back, or gradually roll out software.
