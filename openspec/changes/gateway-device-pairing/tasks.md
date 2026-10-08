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

- [x] C1 **Pairing operations in v2 (additive revision)** — Add `pairingStart` and `pairingToken` to `contracts/edge-cloud/v2/operations.json`; add `pairingStartRequest`, `pairingStartResponse`, `pairingTokenRequest`, and `pairingPendingError` to `machine.schema.json`, reusing `activationResponse` for success; document both operations, the RFC 8628 error codes, and the package revision in `README.md`. ~250 lines. _(2026-10-08, IoT commit `9ec453a`: revision 2 shipped; validator PASS over 58 machine fixtures and the 16 contract tests green.)_
  - Test: `python scripts/integration/validate_v2_contract.py && python -m unittest discover -s scripts/integration -p 'test_v2_contract.py'`
- [x] C2 **Fixtures, compatibility guard, checksums** — Add credential-free pairing exchanges to `fixtures/machine-cases.json` using `<device-code>`/`<user-code>` placeholders; add a test that the nine existing operation entries and referenced `$defs` are unchanged from the accepted package (`d7c2652`); regenerate `SHA256SUMS`. ~200 lines. _(Same commit: 12 placeholder cases added; the guard compares the nine accepted operations and every referenced `$defs` against `d7c2652` through `git show` and was proven by mutating `heartbeat`'s scope until it failed; `SHA256SUMS` regenerated for the 13 files and `sha256sum -c` passes.)_
  - Test: same as C1.

## IoT_Sensors — Backend

- [x] B1 **Session model and migration** — Add `backend/app/models/pairing_session.py` (`sesiones_emparejamiento`, hashed/HMAC codes, state `CHECK`, live-code generated unique column), export it, and add an additive Alembic revision after `e29a05c7b905` that refuses downgrade when rows exist. ~250 lines. _(IoT commit `a81be78`: model + revision `f31b06d8c906` chained to `e29a05c7b905`, downgrade that refuses while rows exist, and `tests/unit/test_pairing_session_model.py`.)_
  - Test: `cd backend && uv run pytest -q tests/unit/test_pairing_session_model.py`
- [x] B2 **Pairing service** — Add `backend/app/services/gateway_pairing.py`: code generation and normalization, HMAC/hash, guarded transitions, lazy expiry, `slow_down`, redemption that reuses the activation transition from `gateway_lifecycle.py` (extract a shared `_activate_gateway` helper without changing `activate` behavior) and revokes outstanding references. Add settings to `app/core/config.py`. ~350 lines. _(IoT commit `a81be78`: service + `PAIRING_*` settings; `_activate_gateway` extracted and shared by `activate`/`rotate_credential` with their behavior unchanged; backend suite 536 passed.)_
  - Test: `cd backend && uv run pytest -q tests/unit/test_gateway_pairing_service.py tests/integration/test_gateway_lifecycle_api.py`
- [x] B2b **Re-pair with credential rotation (decision 7)** — Allow approval for an `active` gateway only with `replace_credential: true`; redemption issues a new `gk_` credential, revokes the previous one in the same transaction, and keeps the gateway, slots and bindings. Reject `replace_credential: true` for `pending_activation` gateways and reject `active` gateways without it. ~200 lines. _(Same commit: rotation covered at service level and, at API level, in `tests/integration/test_gateway_pairing_admin_api.py` with `99aa674`.)_
  - Test: `cd backend && uv run pytest -q tests/unit/test_gateway_pairing_service.py` (the API-level rotation scenario is added with B4).
- [x] B3 **Machine routes** — Add `backend/app/api/v1/endpoints/gateway_pairing.py` start and token routes, schemas in `app/schemas/gateway_pairing.py`, router wiring, `GATEWAY_PAIRING_ENABLED` gate, per-IP start limit and pending cap. ~300 lines. _(IoT commit `99aa674`: hidden-route pair, 503 `pairing_unavailable` gate, 5/IP/10 min start limit, 50-session cap and the RFC 8628 envelopes; `tests/integration/test_gateway_pairing_api.py`.)_
  - Test: `cd backend && uv run pytest -q tests/integration/test_gateway_pairing_api.py`
- [x] B4 **Admin routes and abuse limits** — Add lookup, approve, and deny routes (admin JWT), per-admin/per-IP failure lockout, per-session wrong-code denial, uniform not-found, and a log-redaction test (caplog). ~350 lines. _(Same commit: lookup/approve/deny with admin+IP lockout, uniform 404, required `confirm`, the service's 409s, and caplog redaction; `openapi.yaml` regenerated with only the three admin paths visible.)_
  - Test: `cd backend && uv run pytest -q tests/integration/test_gateway_pairing_admin_api.py`
- [x] B5 **Docs** — Update `docs/system.md` (installation step 2–3), `docs/api.md`, `docs/security.md`, and `docs/integration/README.md` to describe pairing as the primary path and the reference as fallback. ~150 lines. _(IoT commit `baaaf74`, with the code references recorded in that unit's report; every endpoint, limit and control cited exists in the implementation and nothing claims the flag is on. `docs/integration/README.md` also gained the lab note about `bindings_revision`.)_
  - Test: structural readback; `cd backend && uv run pytest -q` before merge.

## IoT_Sensors — Frontend

Test command for all units: `cd frontend && npx vitest run <test-file>`; plus `npm run typecheck`.

- [x] F1 `[team]` **Readable activation reference** — In `pages/admin/GatewayManagement.tsx`, replace the `sr-only` reference with visible monospaced text, a copy button, and the expiry; keep it cleared after navigation. ~80 lines. _(IoT commit `50ddbaf`: visible `<code data-testid="one-time-secret">` + copy button (clipboard with fallback) + expiry, cleared on unmount; 4 vitest cases.)_
  - Test: `cd frontend && npx vitest run src/app/pages/admin/GatewayManagement.test.tsx`
- [x] F2 `[team]` **Provisioning errors and hint** — Wrap `handleProvision` in `try/catch`, show `getErrorMessage` in a toast and inline, and add a hint that each area needs an active logical node. Also handle errors in `handlePublish`. ~80 lines. _(Same commit: both handlers wrapped, toast + inline message, node hint next to the form.)_
  - Test: `cd frontend && npx vitest run src/app/pages/admin/GatewayManagement.test.tsx`
- [x] F3 **Pairing client** — Add `lookupPairing`, `approvePairing`, `denyPairing` to `services/gateways.ts` with types. ~80 lines. _(IoT commit `4deac15` with `services/gateways.test.ts` covering path and payload of the three calls.)_
  - Test: `cd frontend && npx vitest run src/app/services/gateways.test.ts`
- [x] F4 **Verification page** — Add `pages/admin/PairDevice.tsx` and routes (`/pair` redirecting to `/admin/gateways/pair` while preserving `code`, login return path), code normalization, device details, gateway select, confirmation checkbox, approve/deny, not-found and lockout states. ~350 lines. _(Same commit: page + `/pair` redirect preserving the query + admin route; `PairDevice.test.tsx` with 9 cases total, `npm run typecheck` and the production `npm run build` green.)_
  - Test: `cd frontend && npx vitest run src/app/pages/admin/PairDevice.test.tsx`

## Agro.io — Edge agent and CLI (paired work on branches based on `integration/iot-v2`)

Test command form: `python3 -m unittest tests/<file>.py -v` from the Agro.io repository root.

- [x] A1 **Re-vendor contract** — Copy the accepted v2 revision byte-identically into `contracts/iot-sensors/v2/`; update upstream commit and `SHA256SUMS` digest together in `contracts/iot-sensors/SOURCE.md`. Generated copy; ~10 authored lines. _(Agro commit `fcdc5fb`: byte-identical copy, `SOURCE.md` with upstream `9ec453a` and the digest, `REQUIRED_OPERATIONS` extended; `diff -rq` and `sha256sum -c` clean and the gate proven with a tampered checksum.)_
  - Test: `python3 -m unittest tests/test_gateway_contract.py -v`
- [x] A2 **Schema migration** — Rebuild `gateway_commands` to allow `pair`, `cancel_pair`, and `submit_binding` (copying rows), and add `pairing_display`, in `services/edge-agent-python/gateway/schema.py` and `db/schema/init-db.sh`. ~150 lines. _(Agro commit `7805f9f`: migration `0006` rebuilds the table copying rows and `ensure_gateway_schema` runs it only while the deployed `CHECK` is the old one (it looks at `sqlite_master.sql`); `pairing_display` added; `gateway/binding_commands.py` consumes the binding commands; 12 + 10 tests.)_
  - Test: `python3 -m unittest tests/test_gateway_schema.py -v`
- [x] A3 **Pairing module** — Add `gateway/pairing.py` (start, poll with interval/slow_down, terminal states, 0600 `device_code` state file, display rows) and extract shared identity storage from `activation.py` without behavior change; wire it into the agent tick in `runtime.py`; process `submit_binding` commands via `discovery.submit_candidate`. ~400 lines. _(Agro commit `82874ae`: `gateway/pairing.py` with the 0600 state file in the data dir and `pairing_display` upserts, `activation.store_identity()` shared, tick steps `pairing_commands` + `pairing_poll`; 21 pairing tests plus the activation and CLI suites, 409 tests total.)_
  - Test: `python3 -m unittest tests/test_gateway_pairing.py tests/test_gateway_activation.py -v`
- [x] A4 **CLI and harness doc** — Add `pair`, `pair --wait`, `pair-status`, `pair-cancel` to `gateway/cli.py`; update Agro.io's `docs/integration/headless-harness.md` (Agro-side path, not in this repository) so pairing is the default and the reference file is the fallback. ~200 lines. _(Same commit plus `--replace`: the five subcommands, no `device_code` or credential in any output (tests assert it), and the harness runbook is pairing-first with the reference as section 3b. On the device, `pair` (no `--replace`) refuses to disturb an active identity and `pair --replace` against a cloud without the routes fails cleanly.)_
  - Test: `python3 -m unittest tests/test_gateway_cli.py -v`

## Agro.io — InstallView (supersedes the shape of `integration-gateway-v2` tasks 2.5/2.6)

There is no C# test project (`apps/ui-csharp/src/AgroIo.Ui/AgroIo.Ui.csproj` only). Each unit verifies with `dotnet build apps/ui-csharp/src/AgroIo.Ui` and a written manual checklist on the Pi 5 touchscreen, recorded in the Agro feature document.

- [x] I1 **Install service** — Add `Services/IGatewayInstallService.cs` and `Services/SqliteGatewayInstallService.cs`: read `pairing_display`, `gateway_identity`, `discovery_evidence`, latest readings/RSSI, cached overlay; queue `pair`, `cancel_pair`, `submit_binding`, `confirm_binding` commands following `SqliteGatewayUpdateService`. ~350 lines. _(Agro commit `a739039`: the service reads identity/evidence/slots/attempts and queues every command with 0600 payloads (a failed write marks the row `failed` with `payload_write_failed`); no HTTP in the UI.)_
- [x] I2 **Pairing and detection steps** — Add `Views/InstallView.axaml(.cs)` and `ViewModels/GatewayInstallViewModel.cs` steps 1–2 (QR, code, countdown, retry, reference fallback; node list with preview and signal); register the `install` route in `MainWindowViewModel.cs`. ~400 lines. _(Agro commits `a739039` (steps 1–2 with the reference entry) and `6b223e0` (pairing step: QR with `QRCoder` generated in memory, `user_code` in large type, 1 s countdown, retry/cancel). Verified on the Pi on 2026-10-08: the QR, `BCDF - GHJK` and the countdown rendered; an inconsistent `pending` row was reconciled by the agent to `expired` and the screen showed the correct retry state.)_
  - Checklist: no secret on screen; expiry and retry; fallback entry writes the payload file.
- [x] I3 **Assign and confirm steps** — Steps 3–4: per-node slot picker with name-match suggestion (never auto-selected), duplicate-slot prevention, bulk queue, per-row status and retry of failed rows. ~400 lines. _(Agro commit `6fa297f`. Phase-1 acceptance on the Pi on 2026-10-08 with dedicated test slots: two nodes assigned on the touchscreen in one bulk confirm, the duplicate slot refused naming the other row, the agent submitting and confirming both candidates, and the cloud showing three confirmed slots with fresh readings. After the test the device returned to `demo_nodes: 0`.)_
  - Checklist: suggestion requires a tap; partial success shown; no HTTP from the UI process.

## Status (2026-10-08)

Every unit above is closed with its evidence. What is **not** verified yet is the live pairing acceptance of phase 2, because the cloud of the lab stack does not have the pairing routes deployed: it needs (1) the commits of this change pushed, (2) a manual Dokploy deploy, (3) `GATEWAY_PAIRING_ENABLED=true` plus `PAIRING_VERIFICATION_BASE_URL`, and (4) a second test gateway to prove that the reference fallback still activates a unit while pairing is the primary path. Until then the device-facing failure is clean: `pair --replace` against that cloud reports `failed` and leaves the identity and credential untouched (verified on the device on 2026-10-08), and the phase-1 binding flow does not depend on the pairing routes at all.

## Delivery order

Decided 2026-10-07: deliver the biggest field improvement first. Binding happens once per node and today needs the CLI; pairing happens once per Raspberry. Phase 1 needs no contract change.

1. **Phase 1 — On-screen node binding (no contract change).** A2 (only `submit_binding`; `pair`/`cancel_pair` come in phase 2), I1 (without pairing reads), I2 limited to step 1 as reference entry (typed `ar_` reference written to the payload file) plus step 2 (node list with preview and signal), I3. F1 and F2 make the reference fallback usable from the cloud side.
   - Acceptance: on the Pi 5, InstallView activates with a reference, lists detected nodes, binds two nodes in one bulk confirm, and the dashboard shows their readings.
2. **Phase 2 — Device-authorization pairing.** C1 → C2 → B1 → B2 → B2b → B3 → B4 (includes the API rotation scenario) → F3 → F4 → B5 → A1 → A2 (add `pair`, `cancel_pair`) → A3 → A4 → I2 (pairing step: QR, code, countdown, retry).
   - Acceptance: on the Pi 5, InstallView pairs by phone approval without typing a reference; a re-pair with `replace_credential` keeps the existing bindings; the reference fallback still activates a second test gateway.

Each work unit keeps its focused test or checklist; docs (`docs/system.md`, integration runbooks, this change) are updated in the same unit as the behavior they describe.
