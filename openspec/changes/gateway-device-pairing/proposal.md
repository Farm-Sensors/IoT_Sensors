# Proposal: Gateway Device Pairing

## Intent

Let a technician pair an Agro.io gateway from its own touchscreen without scanning a QR on the device and without typing a 46-character secret. The device shows a short code and an on-screen QR; an administrator approves it in IoT_Sensors from a phone or desktop. This is a device-authorization grant in the style of RFC 8628, added to the edge-cloud v2 contract next to the existing activation reference, which remains as a fallback.

The cloud-first hierarchy is unchanged: the administrator still defines the client, property, irrigation areas, and logical nodes; Agro still discovers hardware; the technician still chooses each slot explicitly; and the cloud never infers an area from a device identifier (`docs/system.md`, "Instalación de un rancho"). This change does not move any source of truth to the edge.

## Why

- **The field device cannot consume the current reference.** The Agro test Raspberry is a Pi 5 with a 7" USB touchscreen and no camera. Technicians operate the Agro screen on site.
- **The cloud shows the reference only as a QR.** `frontend/src/app/pages/admin/GatewayManagement.tsx` renders the single-use activation reference as a QR image; the reference text is present only inside an `sr-only` element (`data-testid="one-time-secret"`). The reference is `"ar_" + secrets.token_urlsafe(32)` (`backend/app/services/gateway_lifecycle.py`, `issue_reference`), about 46 characters. Typing it on a touchscreen is error-prone, and the device cannot scan the QR.
- **The only working path today is headless.** On 2026-10-06 the first end-to-end harness run succeeded only through the headless CLI (`services/edge-agent-python/gateway/cli.py activate --reference-file`, documented in Agro `docs/integration/headless-harness.md`), with the reference issued through the admin API and written to a file.
- **The install UI does not exist yet.** Agro tasks 2.5/2.6 (`openspec/changes/integration-gateway-v2/tasks.md`, InstallView) are open; only `GatewayUpdateView` exists. Designing the pairing flow now lets InstallView be built once, against the final flow.
- **Device authorization fits the hardware.** The edge has a screen but no camera; the administrator's phone has a camera and a logged-in session. Showing a short code on the device and approving it on the phone uses each device for what it can do, and never puts a long-lived secret on a screen.
- **Admin UX gaps block fallback use.** `handleProvision` in `GatewayManagement.tsx` has no error handling, so a `422` from provisioning (for example "Every slot must reference an existing area and active logical node in this property", `backend/app/services/gateway.py`) is silently swallowed.

## What Changes

1. **Cloud pairing API (contract v2, additive).** Two credential-less machine operations: start a pairing session (returns `device_code`, `user_code`, `verification_uri`, `verification_uri_complete`, `expires_in`, `interval`) and poll a token (returns `authorization_pending`, `slow_down`, `expired_token`, `access_denied`, or the same body activation returns today). Three admin JWT operations: look up a session by `user_code`, approve it against a `pending_activation` gateway, or deny it.
2. **Admin verification page.** A page at `verification_uri` that accepts a typed `user_code` or the code embedded in `verification_uri_complete`, shows device-reported metadata, lets the admin choose the gateway, and requires explicit confirmation.
3. **Admin UX fixes.** Show the activation reference as copyable text with its expiry (fallback path), surface provisioning errors, and explain that each area needs an active logical node before provisioning.
4. **Edge pairing client (Agro.io).** A `pairing` module and CLI commands that start a session, display/return the code, poll at the server interval, and store the credential exactly as activation does.
5. **InstallView (Agro.io).** A four-step touchscreen flow: pair; list detected nodes with a live reading preview and signal; pick an area/slot per node (with a name-match suggestion that the technician must confirm); bulk confirm with per-binding status. It drives the agent through `gateway_commands` and payload files, never by calling the cloud from C#.

The `ar_` reference and `POST /api/v1/gateways/activate` are unchanged and remain supported.

## Scope

### In Scope — IoT_Sensors (this repository)

- `contracts/edge-cloud/v2/` — `operations.json`, `machine.schema.json`, `README.md`, `fixtures/machine-cases.json`, `SHA256SUMS`, and the package revision record.
- `scripts/integration/validate_v2_contract.py`, `scripts/integration/test_v2_contract.py`.
- `backend/app/models/`, `backend/alembic/versions/`, `backend/app/schemas/`, `backend/app/services/`, `backend/app/api/v1/endpoints/`, `backend/app/api/v1/router.py`, `backend/app/core/config.py`, `backend/tests/`.
- `frontend/src/app/pages/admin/`, `frontend/src/app/services/gateways.ts`, `frontend/src/app/routes.tsx`, and their tests.
- `docs/system.md`, `docs/api.md`, `docs/security.md`, `docs/integration/README.md`.

### In Scope — Agro.io (paired work, on branches based on `integration/iot-v2`)

- `contracts/iot-sensors/v2/`, `contracts/iot-sensors/SOURCE.md` (re-vendor only).
- `services/edge-agent-python/gateway/` (`pairing.py`, `schema.py`, `cli.py`, `runtime.py`, `activation.py` shared identity storage), `tests/`.
- `apps/ui-csharp/src/AgroIo.Ui/` (InstallView, `GatewayInstallViewModel`, `IGatewayInstallService`, `SqliteGatewayInstallService`, navigation).
- `docs/integration/headless-harness.md`.

## Out of Scope

- Camera or QR scanning on the Raspberry.
- Firmware UID/serial identity; the harness keeps `mesh-<src>` for both until firmware sends real values.
- OTA delivery, rollback automation, or gradual rollout.
- HTTPS certificates, domain setup, and Dokploy autodeploy.
- Removing or changing the `ar_` activation reference or `POST /api/v1/gateways/activate`.
- Creating clients, properties, areas, or logical nodes from the edge, or inferring an area from a device identifier.
- Any Phase 2 behavior (AI, alerts, notifications, n8n).

## Capabilities

### New Capabilities

- `gateway-pairing`: cloud device-authorization sessions, token polling, admin approval/denial, and the security controls around them.
- `pairing-approval-ui`: admin verification page and the activation-reference/provisioning UX fixes.
- `edge-pairing-client`: Agro agent and CLI support for starting, polling, cancelling, and completing a pairing session.
- `install-binding-flow`: the Agro InstallView pairing and multi-node binding flow.

### Modified Capabilities

- `gateway-provisioning` (from `edge-cloud-gateway-provisioning`): activation gains a second, equivalent path. Single-use activation by reference is unchanged.

## Impact

| Area | Impact |
|---|---|
| Contract v2 | Two new credential-less operations; schemas for their bodies; admin operations stay out of the machine contract. Existing nine operations unchanged. |
| Database | One additive table (`sesiones_emparejamiento`). No change to `pasarelas` or `referencias_activacion`. |
| Backend | New service and routes; reuses the activation transition that issues a `gk_` credential. |
| Frontend | New verification page; fixes to `GatewayManagement.tsx`. |
| Agro edge agent | New module, new command types (requires a `gateway_commands` table rebuild because of its `CHECK` constraint), CLI commands. |
| Agro UI | New InstallView; no direct cloud calls from C#. |
| Operations | New settings for the verification base URL and a feature flag for the pairing routes. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phishing: an attacker gets an admin to approve the attacker's device | Medium | Approval page shows device-reported hostname, model, agent version, request time, and the code; requires explicit confirmation; codes expire in 10 minutes; the admin picks the gateway explicitly. |
| Brute force of `user_code` | Low | Admin JWT required to look up; per-admin and per-IP failure limits with lockout; about 2^34 code space; 10-minute TTL. |
| Unauthenticated session flooding | Medium | Per-IP start limits and a global cap on live pending sessions. |
| Lost token response leaves an active gateway with no stored credential | Low | Same non-repeatable rule as activation; re-pair with explicit credential rotation keeps the gateway and its bindings (decision 7). |
| Agro and IoT_Sensors vendor different contract revisions | Medium | Additive revision, unchanged existing operations, lockstep re-vendor with checksums and `SOURCE.md`. |
| In-memory rate limiting is per process | Medium | Session-level counters are persisted on the session row; per-IP limits follow the existing login limiter and are documented as per-worker. |
| HTTP on the private network exposes codes | Medium | HTTP only in the harness lane on the private network; production requires HTTPS. |

## Rollback Plan

Pairing routes sit behind `GATEWAY_PAIRING_ENABLED` (default `false`). Rollback disables the flag; activation by reference keeps working because it is untouched. The new table is additive and can be dropped by a validated Alembic downgrade when it holds no rows that need retention. In Agro, rollback hides the pairing step (InstallView falls back to the reference entry or the headless CLI) and leaves the new command types unused.

## Dependencies

- Accepted `edge-cloud-gateway-provisioning` behavior on `main` (activation, configuration, bindings).
- Paired Agro.io work on branches based on `integration/iot-v2`, made from this workspace under the rule in `AGENTS.md`; never on Agro.io `main`.
- A reachable verification URL for the admin's phone (the cloud's public URL).

## Decisions

Resolved on 2026-10-07 by the integration owner (formerly open questions).

1. **`user_code`**: 8 characters from `BCDFGHJKLMNPQRSTVWXZ` (the RFC 8628 consonant set: no vowels, so no accidental words, and no `0/O/1/I` confusion), displayed as `XXXX-XXXX`, compared case-insensitively with the hyphen optional. About 2^34 codes, which is enough with the lookup limits and the 10-minute TTL.
2. **TTL and interval**: 600 s and 5 s. The technician is standing next to the screen while the admin approves; a longer window only widens the phishing and guessing window. The countdown and a one-tap "new code" button cover slow approvals.
3. **No provisioning during approval**: approval only binds a session to a gateway that is already `pending_activation`. The verification page explains how to provision first and links to it. This keeps the one place where slots are defined.
4. **Contract label**: additive `v2` revision 2 (same folder, new reviewed commit and `SHA256SUMS`, `README.md` change log). Existing operations do not change, so existing v2 consumers stay valid; Agro re-vendors in lockstep because its adapter checks the exact checksum.
5. **No property name in the token response**: the success body stays byte-compatible with today's activation response. InstallView shows the property from the first configuration poll, which already runs right after activation.
6. **Audit on the session row only**: `approved_by`, `approved_at`, `denied_at`, `consumed_at` and attempt counters. The `audit_log` table belongs to the dormant Phase 2 auditing feature and stays untouched (`AGENTS.md`).
7. **Lost success response: re-pair with credential rotation.** An admin may approve a new session for an `active` gateway only by ticking an explicit "replace this gateway's credential" confirmation; success revokes the previous `gk_` credential and keeps the gateway, its slots and its bindings. Revoke-and-re-provision is rejected because a new gateway would lose every confirmed binding.
8. **Rate limits**: the hard guarantees are the persisted counters on the session row (lookup failures and token polls), which work across workers. Per-IP limits stay in-process like the login limiter; the backend runs a single Uvicorn worker today. Revisit with a shared store before running multiple workers.
