# Design: dev-one-command-stack

Decisions are closed; do not change them without asking in the issue.

## Commands

| Target | Runs | Effect |
|---|---|---|
| `make dev` | `scripts/dev_up.sh` | Starts or reuses the stack, prints a summary |
| `make dev-down` | `scripts/dev_down.sh` | Stops host processes and the MySQL container, keeps data |
| `make dev-reset` | `scripts/dev_down.sh --reset` | After typing `si`, also removes the local database and `.dev/` |

## State directory `.dev/` (git-ignored)

- `.dev/logs/backend.log`, `frontend.log`, `simulator.log`
- `.dev/pids/backend.pgid`, `frontend.pgid`, `simulator.pgid` (process-group ids, see below)
- `.dev/state/demo-seeded` (marker), `.dev/state/gateway.env` (mode 0600; the `SIM_GATEWAY_KEY=…`
  and `SIM_LOGICAL_NODE_IDS=…` lines exactly as printed by `scripts/dev_gateway.py`)

## Processes

The script runs with bash job control on (`set -m`), so each background job gets its own process
group whose id is the job's pid (`$!`); that id is saved. This works on Linux, WSL and macOS
(no `setsid`). The commands are fixed:

| Name | Directory | Command |
|---|---|---|
| backend | `backend/` | `uv run uvicorn app.main:app --reload --port 5050` |
| frontend | `frontend/` | `./node_modules/.bin/vite --port 5173 --strictPort` |
| simulator | `simulator/` | `uv run --with-requirements requirements.txt python simulator_fast.py --gateway-key "$SIM_GATEWAY_KEY" --logical-node-id <id> [--logical-node-id <id> …] --interval 60` |

A saved group counts as **alive** if `kill -0 -- -<pgid>` succeeds and the group leader's command
line contains `uvicorn`, `vite` or `simulator_fast.py` respectively; otherwise the pgid file is
stale and is deleted. Stopping a group: `kill -TERM -- -<pgid>`, then `kill -KILL -- -<pgid>`
after 10 s if still alive.

## `dev_up.sh` steps (bash, `set -euo pipefail`, run from the repo root)

1. Prerequisites: stop with one Spanish message each if missing: `docker`, `docker compose`,
   `uv`, `node` ≥ 20, `npm`, `python3`, `curl`. Then check ports (step 1b) **before changing
   anything**.
1b. Ports, probed with bash `(exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null` (success means
   something listens): 3306 is OK if nothing listens or `docker inspect -f '{{.State.Running}}'
   sensores_mysql` prints `true`; 5050 is OK if nothing listens or the backend group is alive;
   5173 likewise with the frontend group. Otherwise stop, naming the port and that another
   program uses it.
2. If `backend/.env` does not exist, copy `backend/.env.example`. Never overwrite an existing
   file. If the file has no `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=` line, append
   `# Solo desarrollo local: las pruebas E2E inician sesión muchas veces` and
   `LOGIN_RATE_LIMIT_MAX_ATTEMPTS=1000` (the backend default is 10 per 15 min per email and IP,
   `backend/app/core/config.py`).
3. MySQL: read `DB_PASSWORD` from `backend/.env`
   (`grep '^DB_PASSWORD=' backend/.env | cut -d= -f2-`, default `rootpass`) and **export it** before
   `docker compose up -d mysql` (compose reads it from the shell, not from `backend/.env`). Wait,
   at most 120 s, until `docker compose exec -T mysql mysqladmin ping -h127.0.0.1 -uroot
   -p"$DB_PASSWORD" --silent` succeeds (TCP, so the temporary init server does not count).
4. In `backend/`: `uv sync`, `uv run alembic upgrade head`, `uv run python -m app.db.seed`
   (idempotent: get-or-create).
5. Backend: reuse if alive; else start it (table above) with output to `backend.log`; wait at most
   60 s until `curl -sf http://localhost:5050/health` succeeds.
6. Demo data: if `.dev/state/demo-seeded` is missing, run `make demo-seed` (reloads 30 days of
   readings for the 6 seeded nodes) and create the marker.
7. Frontend: in `frontend/`, run `npm ci` if `node_modules/` is missing or older than
   `package-lock.json`. Reuse if alive; else start it (table above); wait at most 60 s until
   `curl -sf http://localhost:5173/` succeeds. Its Vite proxy already targets
   `http://localhost:5050`.
8. Gateway: if `gateway.env` exists and
   `curl -sf -H "X-API-Key: $SIM_GATEWAY_KEY" http://localhost:5050/api/v1/gateways/me/configuration`
   returns 200, reuse it. Otherwise run `python3 scripts/dev_gateway.py --property-id 1`. If it
   fails because the predio already has a gateway (HTTP 409 in its message), stop with
   «El predio 1 ya tiene un equipo de otra sesión. Ejecuta make dev-reset para empezar de cero.»
   On success write its `SIM_*` lines to `gateway.env` (chmod 600). Never print the full
   credential.
9. Simulator: reuse if alive; else start it (table above) with every id in
    `SIM_LOGICAL_NODE_IDS`, output to `simulator.log`.
10. Print the summary (Spanish): `http://localhost:5173/`, API docs
    `http://localhost:5050/api/v1/docs`, the logins (`admin@sensores.com` / `admin123`,
    `alan2203mx@gmail.com` / `123`), the log paths, and `make dev-down` to stop.

## `dev_down.sh`

Stops the three groups whose pgid files exist and are alive (rule above), removes those files,
then `docker compose stop mysql`. With `--reset`: asks
`¿Borrar la base de datos local y .dev/? Escribe si:`; only on `si`, runs
`docker compose down -v` (removes this project's containers and its declared named volume
`mysql_data`) and deletes `.dev/`.

## Known constraint

`docker-compose.yml` fixes `container_name: sensores_mysql`; only one copy of this stack can run
per machine. Say so in the README; do not change the compose file.
