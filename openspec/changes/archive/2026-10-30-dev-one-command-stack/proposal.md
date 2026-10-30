# Change: dev-one-command-stack

## Agent start

Owner: Ricky (`@rickybecerra`). This folder is the brief. Implement `tasks.md`; nothing else.
Read first: `README.md` («Desarrollo Local», steps 0–5), `Makefile`, `docker-compose.yml`
(service `mysql` only), `backend/.env.example`, `scripts/dev_gateway.py`,
`simulator/simulator_fast.py` (`--gateway-key`, repeatable `--logical-node-id`, `--interval`),
`backend/app/db/seed.py`, `backend/app/db/seed_demo.py`.

## Start gate

Order and gates for all changes of this round: `docs/team-ronda-1.md`.

This change has no prerequisite; it is one of the first of the round.

## Why

The other contributors run IoT_Sensors only on their own machines. Today that takes five manual
steps in three terminals (verified 2026-10-27 on a clean clone: all of them work). One command
must bring up the whole local stack with demo data and live simulated readings, and one command
must stop it, so the redesign and the E2E tests start from the same known state.

## Scope

Allowed (create or edit): `scripts/dev_up.sh`, `scripts/dev_down.sh`, `Makefile` (new targets
only), `.gitignore` (add `.dev/`), `README.md` («Desarrollo Local»), `docs/operations.md` (local
section).

Exclude: backend and frontend source, `docker-compose.yml`, `scripts/dev_gateway.py` behavior,
the simulator, Dokploy, production config, any Phase 2 flag.

## Non-goals

No containers for backend or frontend in dev (they run on the host with `uv` and `npm`, as in the
README). Supported: Linux, WSL and macOS with bash. No native Windows shell support. No CI changes.

## Git and PR (mandatory)

- Branch `feat/<issue-number>-<short-name>` from the latest `main` of `Farm-Sensors/IoT_Sensors`.
- Open the PR to `main` with `Closes #<issue-number>`. Never push to `main`; Alan reviews, merges
  and deploys to the lab.
- One logical change per commit; fix review findings by amending the commit they belong to.
- No access to the lab server (`10.32.81.230`) or the test Raspberry is available or needed. Do
  not add instructions, URLs or scripts that assume them.
- Update the docs named in `tasks.md` in the same PR. Docs describe the current state.
- If something you need is not written in this folder or the files it names, **stop** and ask in
  the issue instead of inventing it.

## Verification

```bash
git clone https://github.com/Farm-Sensors/IoT_Sensors.git /tmp/iot-check && cd /tmp/iot-check
make dev        # first run: completes and prints the summary
make dev        # second run: reuses everything, no new gateway, no duplicate processes
make dev-down   # nothing from this stack left running; MySQL data kept
make dev        # comes back with the same data
make dev-reset  # asks for confirmation, then removes MySQL data and .dev/
```
