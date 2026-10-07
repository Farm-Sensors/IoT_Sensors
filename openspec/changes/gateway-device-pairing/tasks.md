# Tasks: Gateway Device Pairing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,200–2,900 authored lines across 15 work units in two repositories; generated checksums and migrations excluded |
| Per-unit size | Each unit is planned at about 400 authored changed lines or less (advisory, not a hard cap) |
| Delivery | One PR per work unit or small chain per repository; ordinary repository policy decides merge |
| Ordering gate | Contract units (C) before backend token routes are enabled; backend before Agro pairing client; Agro client before InstallView pairing step |

All former open questions are resolved in `proposal.md` → Decisions (2026-10-07).

Branches: IoT_Sensors work branches from `main`; Agro.io work branches from `integration/iot-v2` and never targets Agro `main`.

`[team]` marks small, self-contained units suitable for teammates (for example the frontend owner).

## IoT_Sensors — Contract

- [ ] C1 **Pairing operations in v2 (additive revision)** — Add `pairingStart` and `pairingToken` to `contracts/edge-cloud/v2/operations.json`; add `pairingStartRequest`, `pairingStartResponse`, `pairingTokenRequest`, and `pairingPendingError` to `machine.schema.json`, reusing `activationResponse` for success; document both operations, the RFC 8628 error codes, and the package revision in `README.md`. ~250 lines.
  - Test: `python scripts/integration/validate_v2_contract.py && python -m unittest discover -s scripts/integration -p 'test_v2_contract.py'`
- [ ] C2 **Fixtures, compatibility guard, checksums** — Add credential-free pairing exchanges to `fixtures/machine-cases.json` using `<device-code>`/`<user-code>` placeholders; add a test that the nine existing operation entries and referenced `$defs` are unchanged from the accepted package (`d7c2652`); regenerate `SHA256SUMS`. ~200 lines.
  - Test: same as C1.

## IoT_Sensors — Backend

- [ ] B1 **Session model and migration** — Add `backend/app/models/pairing_session.py` (`sesiones_emparejamiento`, hashed/HMAC codes, state `CHECK`, live-code generated unique column), export it, and add an additive Alembic revision after `e29a05c7b905` that refuses downgrade when rows exist. ~250 lines.
  - Test: `cd backend && uv run pytest -q tests/unit/test_pairing_session_model.py`
- [ ] B2 **Pairing service** — Add `backend/app/services/gateway_pairing.py`: code generation and normalization, HMAC/hash, guarded transitions, lazy expiry, `slow_down`, redemption that reuses the activation transition from `gateway_lifecycle.py` (extract a shared `_activate_gateway` helper without changing `activate` behavior) and revokes outstanding references. Add settings to `app/core/config.py`. ~350 lines.
  - Test: `cd backend && uv run pytest -q tests/unit/test_gateway_pairing_service.py tests/integration/test_gateway_lifecycle_api.py`
- [ ] B2b **Re-pair with credential rotation (decision 7)** — Allow approval for an `active` gateway only with `replace_credential: true`; redemption issues a new `gk_` credential, revokes the previous one in the same transaction, and keeps the gateway, slots and bindings. Reject `replace_credential: true` for `pending_activation` gateways and reject `active` gateways without it. ~200 lines.
  - Test: `cd backend && uv run pytest -q tests/unit/test_gateway_pairing_service.py tests/integration/test_gateway_pairing_api.py`
- [ ] B3 **Machine routes** — Add `backend/app/api/v1/endpoints/gateway_pairing.py` start and token routes, schemas in `app/schemas/gateway_pairing.py`, router wiring, `GATEWAY_PAIRING_ENABLED` gate, per-IP start limit and pending cap. ~300 lines.
  - Test: `cd backend && uv run pytest -q tests/integration/test_gateway_pairing_api.py`
- [ ] B4 **Admin routes and abuse limits** — Add lookup, approve, and deny routes (admin JWT), per-admin/per-IP failure lockout, per-session wrong-code denial, uniform not-found, and a log-redaction test (caplog). ~350 lines.
  - Test: `cd backend && uv run pytest -q tests/integration/test_gateway_pairing_admin_api.py`
- [ ] B5 **Docs** — Update `docs/system.md` (installation step 2–3), `docs/api.md`, `docs/security.md`, and `docs/integration/README.md` to describe pairing as the primary path and the reference as fallback. ~150 lines.
  - Test: structural readback; `cd backend && uv run pytest -q` before merge.

## IoT_Sensors — Frontend

Test command for all units: `cd frontend && npx vitest run <test-file>`; plus `npm run typecheck`.

- [ ] F1 `[team]` **Readable activation reference** — In `pages/admin/GatewayManagement.tsx`, replace the `sr-only` reference with visible monospaced text, a copy button, and the expiry; keep it cleared after navigation. ~80 lines.
  - Test: `cd frontend && npx vitest run src/app/pages/admin/GatewayManagement.test.tsx`
- [ ] F2 `[team]` **Provisioning errors and hint** — Wrap `handleProvision` in `try/catch`, show `getErrorMessage` in a toast and inline, and add a hint that each area needs an active logical node. Also handle errors in `handlePublish`. ~80 lines.
  - Test: `cd frontend && npx vitest run src/app/pages/admin/GatewayManagement.test.tsx`
- [ ] F3 **Pairing client** — Add `lookupPairing`, `approvePairing`, `denyPairing` to `services/gateways.ts` with types. ~80 lines.
  - Test: `cd frontend && npx vitest run src/app/services/gateways.test.ts`
- [ ] F4 **Verification page** — Add `pages/admin/PairDevice.tsx` and routes (`/pair` redirecting to `/admin/gateways/pair` while preserving `code`, login return path), code normalization, device details, gateway select, confirmation checkbox, approve/deny, not-found and lockout states. ~350 lines.
  - Test: `cd frontend && npx vitest run src/app/pages/admin/PairDevice.test.tsx`

## Agro.io — Edge agent and CLI (paired work on branches based on `integration/iot-v2`)

Test command form: `python3 -m unittest tests/<file>.py -v` from the Agro.io repository root.

- [ ] A1 **Re-vendor contract** — Copy the accepted v2 revision byte-identically into `contracts/iot-sensors/v2/`; update upstream commit and `SHA256SUMS` digest together in `contracts/iot-sensors/SOURCE.md`. Generated copy; ~10 authored lines.
  - Test: `python3 -m unittest tests/test_gateway_contract.py -v`
- [ ] A2 **Schema migration** — Rebuild `gateway_commands` to allow `pair`, `cancel_pair`, and `submit_binding` (copying rows), and add `pairing_display`, in `services/edge-agent-python/gateway/schema.py` and `db/schema/init-db.sh`. ~150 lines.
  - Test: `python3 -m unittest tests/test_gateway_schema.py -v`
- [ ] A3 **Pairing module** — Add `gateway/pairing.py` (start, poll with interval/slow_down, terminal states, 0600 `device_code` state file, display rows) and extract shared identity storage from `activation.py` without behavior change; wire it into the agent tick in `runtime.py`; process `submit_binding` commands via `discovery.submit_candidate`. ~400 lines.
  - Test: `python3 -m unittest tests/test_gateway_pairing.py tests/test_gateway_activation.py -v`
- [ ] A4 **CLI and harness doc** — Add `pair`, `pair --wait`, `pair-status`, `pair-cancel` to `gateway/cli.py`; update `docs/integration/headless-harness.md` so pairing is the default and the reference file is the fallback. ~200 lines.
  - Test: `python3 -m unittest tests/test_gateway_cli.py -v`

## Agro.io — InstallView (supersedes the shape of `integration-gateway-v2` tasks 2.5/2.6)

There is no C# test project (`apps/ui-csharp/src/AgroIo.Ui/AgroIo.Ui.csproj` only). Each unit verifies with `dotnet build apps/ui-csharp/src/AgroIo.Ui` and a written manual checklist on the Pi 5 touchscreen, recorded in the Agro feature document.

- [ ] I1 **Install service** — Add `Services/IGatewayInstallService.cs` and `Services/SqliteGatewayInstallService.cs`: read `pairing_display`, `gateway_identity`, `discovery_evidence`, latest readings/RSSI, cached overlay; queue `pair`, `cancel_pair`, `submit_binding`, `confirm_binding` commands following `SqliteGatewayUpdateService`. ~350 lines.
- [ ] I2 **Pairing and detection steps** — Add `Views/InstallView.axaml(.cs)` and `ViewModels/GatewayInstallViewModel.cs` steps 1–2 (QR, code, countdown, retry, reference fallback; node list with preview and signal); register the `install` route in `MainWindowViewModel.cs`. ~400 lines.
  - Checklist: no secret on screen; expiry and retry; fallback entry writes the payload file.
- [ ] I3 **Assign and confirm steps** — Steps 3–4: per-node slot picker with name-match suggestion (never auto-selected), duplicate-slot prevention, bulk queue, per-row status and retry of failed rows. ~400 lines.
  - Checklist: suggestion requires a tap; partial success shown; no HTTP from the UI process.

## Delivery order

Decided 2026-10-07: deliver the biggest field improvement first. Binding happens once per node and today needs the CLI; pairing happens once per Raspberry. Phase 1 needs no contract change.

1. **Phase 1 — On-screen node binding (no contract change).** A2 (only `submit_binding`; `pair`/`cancel_pair` come in phase 2), I1 (without pairing reads), I2 limited to step 1 as reference entry (typed `ar_` reference written to the payload file) plus step 2 (node list with preview and signal), I3. F1 and F2 make the reference fallback usable from the cloud side.
   - Acceptance: on the Pi 5, InstallView activates with a reference, lists detected nodes, binds two nodes in one bulk confirm, and the dashboard shows their readings.
2. **Phase 2 — Device-authorization pairing.** C1 → C2 → B1 → B2 → B2b → B3 → B4 → F3 → F4 → B5 → A1 → A2 (add `pair`, `cancel_pair`) → A3 → A4 → I2 (pairing step: QR, code, countdown, retry).
   - Acceptance: on the Pi 5, InstallView pairs by phone approval without typing a reference; a re-pair with `replace_credential` keeps the existing bindings; the reference fallback still activates a second test gateway.

Each work unit keeps its focused test or checklist; docs (`docs/system.md`, integration runbooks, this change) are updated in the same unit as the behavior they describe.
