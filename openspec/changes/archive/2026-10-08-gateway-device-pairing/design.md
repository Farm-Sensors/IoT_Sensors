# Design: Gateway Device Pairing

Device-authorization pairing (RFC 8628 style) for Agro.io gateways, added to the edge-cloud v2 contract. The `ar_` activation reference and `POST /api/v1/gateways/activate` stay unchanged as the fallback. The cloud-first hierarchy in `docs/system.md` is kept: pairing only replaces how the gateway obtains its `gk_` credential.

## Quick path

1. Edge starts a session without credentials and shows `user_code` plus a QR of `verification_uri_complete`.
2. Admin scans the QR with a phone (or types the code at `verification_uri`), signs in, picks the `pending_activation` gateway, and confirms.
3. Edge polls the token operation; on success it receives exactly what activation returns today and stores the credential the same way.
4. InstallView continues with discovery, explicit slot selection, and bulk confirmation through the existing binding operations.

## Why device authorization

| Option | Edge needs | Admin needs | Verdict |
|---|---|---|---|
| Current: QR of `ar_` reference on admin screen | Camera, or typing ~46 chars | Nothing extra | Fails on the test Pi 5 (no camera); typing is error-prone |
| Show `ar_` as text, type on device | Typing ~46 chars on a 7" touchscreen | Copy/read aloud | Kept as fallback only |
| Device authorization (this design) | A screen (has one) | A phone with camera and a signed-in session (has one) | Short code, no long secret on any screen, admin intent is explicit |

The secret that grants access (`device_code`) never leaves the device, and the code displayed (`user_code`) is useless without an admin JWT.

## Pairing sequence

```text
Technician      Agro InstallView     Agro agent (Python)          IoT_Sensors API               Admin phone/desktop
    |                 |                      |                           |                               |
    |-- tap "Pair" -->|                      |                           |                               |
    |                 |-- gateway_commands -->|                           |                               |
    |                 |   (pair, queued)      |-- POST pairing-sessions -->|                               |
    |                 |                      |   {device metadata}       |-- create session (hashed) ---|
    |                 |                      |<-- 201 device_code,       |                               |
    |                 |                      |    user_code, uris,       |                               |
    |                 |                      |    expires_in, interval   |                               |
    |                 |<-- pairing_display ---| (device_code -> 0600 file) |                               |
    |<- QR + XXXX-XXXX + countdown           |                           |                               |
    |                 |                      |                           |<-- scan QR / type code -------|
    |                 |                      |                           |<-- POST lookup {user_code} ---| (admin JWT)
    |                 |                      |                           |--- session + device info ---->|
    |                 |                      |                           |<-- POST approve {gateway_id,  |
    |                 |                      |                           |    user_code, confirm} -------|
    |                 |                      |-- POST token {device_code} (every interval s) -------->|
    |                 |                      |<-- 400 authorization_pending (until approved)          |
    |                 |                      |<-- 200 {gateway_id, property_id, credential} ----------|
    |                 |                      |   store gk_ (0600), gateway_identity = active          |
    |                 |<-- status: paired ----|                           |                               |
    |                 |-- (existing) config poll, discovery, candidates, confirmations ----------------->|
```

## Pairing session state machine (cloud)

```text
                 approve (admin JWT, gateway pending_activation)
   +---------+ ---------------------------------------------> +----------+
   | pending |                                                 | approved |
   +---------+ --deny--> +--------+                            +----------+
     |   |               | denied |  (terminal)                   |     |
     |   |               +--------+                               |     | token poll: atomic
     |   +--- now >= expires_at ---> +---------+ <-- expires_at --+     | consume + activate gateway
     |                               | expired |  (terminal)            v
     |                               +---------+                  +----------+
     +--- edge cancel ---> denied (reason=cancelled)              | consumed | (terminal)
                                                                  +----------+
   approved --token poll finds the gateway no longer in the approved target state--> denied (reason=gateway_unavailable)
```

- Only `pending → approved`, `pending → denied`, `pending|approved → expired`, `approved → consumed`, and `approved → denied` are valid. Every transition is a guarded `UPDATE ... WHERE estado = <expected>` with a rowcount check, matching `activate` in `backend/app/services/gateway_lifecycle.py`.
- `expired` is evaluated lazily (`expira_en <= now`) on every read; no scheduler is added.
- Approval records the session's purpose: `activation` (gateway was `pending_activation`) or `rotation` (gateway was `active` and the admin set `replace_credential: true`). The token poll re-checks that the gateway is still in that state; otherwise the session ends as `denied` (`gateway_unavailable`).
- `consumed` happens in one transaction. For `activation` it moves the gateway from `pending_activation` to `active`, sets `credencial_hash`, and revokes any outstanding `issued` activation references for that gateway. For `rotation` it replaces `credencial_hash` (the previous credential stops working) and leaves the gateway state, slots, configuration and bindings unchanged.

## API shapes

All values below are placeholders. No example contains a usable secret.

### Machine operations (contract v2, no credential)

`POST /api/v1/gateways/pairing-sessions`

```http
POST /api/v1/gateways/pairing-sessions
Content-Type: application/json

{
  "device": {
    "hostname": "<device-hostname>",
    "model": "<device-model>",
    "agent_version": "<agent-version>"
  }
}
```

```json
201 Created
{
  "device_code": "<device-code>",
  "user_code": "BCDF-GHJK",
  "verification_uri": "https://<cloud-host>/pair",
  "verification_uri_complete": "https://<cloud-host>/pair?code=BCDF-GHJK",
  "expires_in": 600,
  "interval": 5
}
```

- `device` fields are optional, bounded (64 chars each), printable, and displayed to the admin as "reported by the device"; they are never trusted for authorization.
- Errors: `422` schema; `429` start limit or pending-session cap; `503` when `GATEWAY_PAIRING_ENABLED` is false (`code: "pairing_unavailable"`).

`POST /api/v1/gateways/pairing-sessions/token`

```http
POST /api/v1/gateways/pairing-sessions/token
Content-Type: application/json

{ "device_code": "<device-code>" }
```

| Result | Status | Body |
|---|---|---|
| Waiting for admin | `400` | `{"code": "authorization_pending", "message": "..."}` |
| Polling faster than `interval` | `400` | `{"code": "slow_down", "message": "...", "interval": 10}` |
| Session expired | `400` | `{"code": "expired_token", "message": "..."}` |
| Denied, cancelled, or gateway no longer pending | `400` | `{"code": "access_denied", "message": "..."}` |
| Unknown, malformed, or already consumed `device_code` | `401` | `{"code": "invalid_device_code", "message": "..."}` |
| Approved | `200` | `{"gateway_id": 0, "property_id": 0, "credential": "<gateway-credential>"}` |

- The success body is exactly `activationResponse` from `machine.schema.json`. The credential is returned once; a later poll returns `401`.
- Error codes follow RFC 8628 names inside the common v2 error envelope. `slow_down` adds 5 s to the session interval, persisted on the session and capped at 60 s. The edge mirrors this: +5 s per `slow_down`, cap 60 s, and up to 10% random jitter on each wait.
- Retry: the client polls no faster than `interval`, stops on `expired_token`, `access_denied`, or `401`, and treats the `200` as non-repeatable (same rule as activation).

### Admin operations (JWT, not part of the machine contract)

`POST /api/v1/gateways/pairing-sessions/lookup` — body `{"user_code": "BCDF-GHJK"}`. Input is normalized (uppercase, hyphen and spaces removed). Response:

```json
{
  "session_id": "<opaque-session-id>",
  "user_code": "BCDF-GHJK",
  "status": "pending",
  "requested_at": "2026-10-06T15:00:00Z",
  "expires_at": "2026-10-06T15:10:00Z",
  "device": {"hostname": "<device-hostname>", "model": "<device-model>", "agent_version": "<agent-version>"},
  "source_network": "<coarse-ip-prefix>"
}
```

Unknown, expired, consumed, and denied codes return the same `404` (`code: "pairing_not_found"`) and count as a failed attempt.

`POST /api/v1/gateways/pairing-sessions/{session_id}/approve` — body `{"user_code": "BCDF-GHJK", "gateway_id": 0, "confirm": true, "replace_credential": false}`. The `user_code` must match the session (proof that the admin has the displayed code). `gateway_id` must not be deleted and must be `pending_activation`, or `active` with `replace_credential: true` (see "Re-pair with credential rotation"). Response `200` with `{"session_id": "...", "status": "approved", "gateway_id": 0, "property_id": 0}`. Errors: `404` as above; `409` gateway not pending or session not pending; `422` missing `confirm`.

`POST /api/v1/gateways/pairing-sessions/{session_id}/deny` — body `{"user_code": "BCDF-GHJK"}`. Response `200` with `status: "denied"`.

`session_id` is a random opaque identifier (not the database id), so session ids cannot be enumerated.

## Storage model

New table `sesiones_emparejamiento` (additive Alembic revision after `e29a05c7b905`):

| Column | Type | Notes |
|---|---|---|
| `id` | INT PK | internal |
| `id_publico` | CHAR(26) UNIQUE | opaque `session_id` |
| `codigo_dispositivo_hash` | CHAR(64) UNIQUE | SHA-256 of `device_code` (high entropy, `secrets.token_urlsafe(32)`) |
| `codigo_usuario_hmac` | CHAR(64) | HMAC-SHA256 of the normalized `user_code` keyed by a server secret, because the code space is small enough to brute force offline from a plain hash |
| `estado` | VARCHAR(16) | `pending`, `approved`, `denied`, `consumed`, `expired`; `CHECK` constraint |
| `motivo` | VARCHAR(32) NULL | `denied_by_admin`, `cancelled`, `gateway_unavailable` |
| `pasarela_id` | FK NULL | set on approval |
| `aprobado_por_usuario_id` | FK NULL | admin who approved or denied |
| `creado_en`, `expira_en`, `aprobado_en`, `resuelto_en`, `consumido_en` | DATETIME | lifecycle audit |
| `intervalo_s` | INT | starts at 5; `slow_down` increments |
| `ultimo_sondeo_en` | DATETIME NULL | for `slow_down` |
| `intentos_codigo_fallidos` | INT | wrong `user_code` on approve/deny for this session |
| `dispositivo_hostname`, `dispositivo_modelo`, `dispositivo_version` | VARCHAR(64) NULL | device-reported, display only |
| `red_origen` | VARCHAR(48) NULL | coarse source network (IPv4 /24, IPv6 /48), display only |

- Unique among live sessions: a `user_code` is regenerated if its HMAC collides with another `pending` or `approved` session. MySQL 8 has no partial index, so the check is done in the service under a row lock, plus a generated column `codigo_usuario_vivo` = HMAC when live, else NULL, with a UNIQUE index (same pattern as the gateway control plane's portable uniqueness).
- Comparisons use `hmac.compare_digest` after normalization; lookups are by hash, so timing does not depend on stored values.
- No raw `device_code`, `user_code`, or credential is persisted or logged. Logs record `session_id`, transition, and outcome only.
- Rows are retained for audit; a later cleanup job is out of scope.

## Security controls

| Control | Rule |
|---|---|
| Single use | `approved → consumed` once; later polls return `401`. |
| TTL | `expires_in` 600 s; approval after expiry is rejected. |
| Start rate limit | Per source IP: 5 starts per 10 min; global cap of 50 live pending sessions (`429`). |
| Poll rate limit | Faster than `intervalo_s` returns `slow_down` and increases the interval. |
| Guess limit (admin) | Per admin user and per source IP: 10 failed lookups/approvals per 15 min, then 15 min lockout (`429`). Per session: 5 wrong `user_code` attempts deny the session. |
| Constant time | `hmac.compare_digest`; uniform `404` for every non-pending state at lookup. |
| Phishing | Approval shows device-reported metadata, source network, request time, and code; requires an explicit confirmation control; admin picks the gateway; code expires in 10 min; the device screen tells the technician to approve only codes shown on this screen. |
| Transport | Plain HTTP only in the harness lane on the private network; production requires HTTPS for both the API and `verification_uri`. |
| Feature flag | `GATEWAY_PAIRING_ENABLED` (default `false`) gates all five routes. |
| Audit | Session row fields record who approved or denied, when, which gateway, and the outcome. |

Per-IP counters reuse the in-memory sliding window used by login (`backend/app/api/v1/endpoints/auth.py`) and are therefore per worker; session-level counters are persisted. See open question 8 in the proposal.

## Configuration

| Setting | Default | Purpose |
|---|---|---|
| `GATEWAY_PAIRING_ENABLED` | `false` | Enables the routes |
| `PAIRING_VERIFICATION_BASE_URL` | none (required when enabled) | Builds `verification_uri` (`<base>/pair`) |
| `PAIRING_TTL_SECONDS` | `600` | Session lifetime |
| `PAIRING_INTERVAL_SECONDS` | `5` | Initial poll interval |
| `PAIRING_CODE_HMAC_KEY` | derived from `SECRET_KEY` if unset | Key for `user_code` HMAC |

## Edge consumption (Agro.io)

### Agent and CLI

- New module `services/edge-agent-python/gateway/pairing.py`, structured like `activation.py`: loads the vendored contract, uses the same transport, and never logs codes or credentials.
- Command queue: `gateway_commands.command_type` gains `pair`, `cancel_pair`, and `submit_binding`. The current `CHECK (command_type IN ('activate', 'confirm_binding', 'confirm_update'))` in `gateway/schema.py` requires an additive SQLite migration that rebuilds the table and copies rows.
- `pair` processing: start the session, write `device_code` to a 0600 file in the agent data directory (for example `<data dir>/pairing.state`; not `/run`, which is tmpfs and is lost on reboot, and a systemd `RuntimeDirectory` is not used for the same reason). The file expires with the session; an interrupted session is simply restarted by the technician, and write display-only data (`user_code`, `verification_uri_complete`, `expires_at`, state) to a new `pairing_display` table for the UI. Each agent tick polls once if `interval` has elapsed. On success, the shared identity-storage function (extracted from `activation._attempt`) writes the credential with `secrets.write_credential` and upserts `gateway_identity`; then the state file is removed and `pairing_display` becomes `paired`.
- Terminal results (`expired_token`, `access_denied`, `401`) clear the state file and set `pairing_display.state` so the UI offers "Try again".
- CLI: `gateway.cli pair` (start and print code and URL), `pair --wait` (poll in-process until a terminal result, for the headless harness), `pair-status`, and `pair-cancel`. `activate --reference-file` stays.

### InstallView flow (touchscreen)

1. **Pair.** Shows a QR of `verification_uri_complete`, the `user_code` in large type, a countdown, and "Try again" after expiry or denial. A secondary "Use activation reference" action keeps the fallback (typed reference written to the existing payload file).
2. **Detected nodes.** Lists `discovery_evidence` rows (UID/serial), the latest local reading preview, and signal (`mesh_rssi` from the latest RXFRAME where captured), with last-seen time.
3. **Assign.** For each node, the technician selects a pending slot/area from the cached configuration overlay. When a local node name matches a cloud area name (case- and accent-insensitive), that slot is pre-highlighted as a suggestion; it is never selected automatically.
4. **Confirm all.** One action queues a `submit_binding` command per selected node, then `confirm_binding` per accepted candidate. Each row shows its binding status from the overlay (`pending_initial`, `confirmed`, rejected with reason).

The C# UI only reads SQLite and writes `gateway_commands` rows and payload files, following `SqliteGatewayUpdateService`. It never calls the cloud.

## Re-pair with credential rotation

Decision 7 in `proposal.md`. If a device loses its credential (lost token response, reinstalled SD card, corrupted secrets file), the technician starts a new pairing session on the same screen. The admin approves it for the existing `active` gateway only after ticking "replace this gateway's credential" (`replace_credential: true`).

- Redemption issues a new `gk_` credential and revokes the previous credential hash in the same guarded transaction, so the old credential stops working immediately.
- The gateway row, its slots, its configuration versions and its confirmed bindings are kept, so telemetry resumes without re-binding nodes.
- The verification page shows a warning that the currently connected device will be disconnected, plus the gateway's last heartbeat time, so the admin does not cut off a healthy device by mistake.
- Revoke-and-re-provision is not used because a new gateway would lose every confirmed binding.

## Fallback to `ar_`

- No change to `referencias_activacion`, `issue_reference`, `activate`, or the activation operation in the contract.
- Pairing and the reference are independent: whichever completes first activates the gateway. A successful pairing revokes outstanding references; a successful reference activation makes an approved session end as `access_denied` (`gateway_unavailable`).
- The admin page shows the reference as copyable text with its expiry so the fallback is usable without a camera.

## Contract versioning and re-vendoring

- The nine published operations, their schemas, and fixtures remain byte-compatible. A contract test compares their `operations.json` entries and referenced `$defs` with the accepted package at commit `d7c2652` and fails on any change.
- New entries: `pairingStart` and `pairingToken` in `operations.json`; `pairingStartRequest`, `pairingStartResponse`, `pairingTokenRequest`, `pairingPendingError` (envelope plus optional `interval`) in `machine.schema.json`; activation's success response is referenced, not copied. New credential-free fixtures use `<device-code>` and `<user-code>` placeholders.
- README states the package revision and that consumers of revision 1 keep working without re-vendoring because nothing they use changed.
- `SHA256SUMS` is regenerated for the whole package. Agro re-vendors byte-identically into `contracts/iot-sensors/v2/` and updates both the upstream commit and `SHA256SUMS` digest in `contracts/iot-sensors/SOURCE.md` together; its contract adapter already refuses mismatches.

## Migration and rollback

- Cloud: one additive Alembic revision; downgrade drops the table only when empty, otherwise refuses. Flag off disables all routes immediately.
- Agro: additive SQLite migration for `gateway_commands` and `pairing_display`; rollback hides the pairing step and leaves the new command types unused.
- Contract: before Agro re-vendors, the cloud can ship the routes behind the flag with no effect on existing producers.

## Testing strategy

- Backend unit: code generation (alphabet, length, normalization), HMAC/hash storage, state transitions, expiry, `slow_down`.
- Backend integration: start → pending → approve → token success → second poll `401`; deny; expiry; wrong `user_code` lockout; gateway not pending; reference activation racing an approved session; flag off; no secrets in responses other than the single credential, and none in logs (caplog).
- Frontend: verification page states (typed code, code from URL, not found, lockout, confirm required), reference text and copy, provisioning error surfaced.
- Agro: pairing module with a fake transport (pending, slow_down, expired, denied, success), state file permissions and cleanup, CLI output without secrets, schema migration preserving rows. InstallView: build plus a manual checklist (the repository has no C# test project).
