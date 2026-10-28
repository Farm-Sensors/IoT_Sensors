#!/usr/bin/env bash
# Solo desarrollo local: levanta (o reutiliza) MySQL, backend, frontend, datos demo y simulador.
# Uso: make dev   (equivale a ./scripts/dev_up.sh desde la raíz del repo)
set -euo pipefail
set -m  # cada job en segundo plano tiene su propio grupo de procesos (pgid = $!)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DEV_DIR="$ROOT/.dev"
LOG_DIR="$DEV_DIR/logs"
PID_DIR="$DEV_DIR/pids"
STATE_DIR="$DEV_DIR/state"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

port_listening() { (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; }

# Imprime "yes" si el grupo guardado sigue vivo y su líder coincide con el patrón; si no, borra el pgid obsoleto.
group_alive() {
  local name="$1" pattern="$2" file="$PID_DIR/$1.pgid" pgid
  [ -f "$file" ] || return 1
  pgid="$(cat "$file")"
  if [[ "$pgid" =~ ^[0-9]+$ ]] && kill -0 -- "-$pgid" 2>/dev/null \
     && ps -o command= -p "$pgid" 2>/dev/null | grep -q -- "$pattern"; then
    return 0
  fi
  rm -f "$file"
  return 1
}

start_group() { # name dir pattern command...
  local name="$1" dir="$2"; shift 2
  ( cd "$dir" && exec "$@" ) >>"$LOG_DIR/$name.log" 2>&1 &
  echo "$!" >"$PID_DIR/$name.pgid"
}

wait_for() { # descripción segundos comando...
  local what="$1" limit="$2"; shift 2
  local i
  for ((i = 0; i < limit; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  die "$what no respondió en ${limit} s. Revisa los logs en .dev/logs/."
}

# --- 1. Prerrequisitos ---------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "Falta docker. Instálalo y vuelve a ejecutar make dev."
docker compose version >/dev/null 2>&1 || die "Falta docker compose (plugin v2). Instálalo y vuelve a ejecutar make dev."
command -v uv >/dev/null 2>&1 || die "Falta uv (https://docs.astral.sh/uv/). Instálalo y vuelve a ejecutar make dev."
command -v node >/dev/null 2>&1 || die "Falta node (versión 20 o superior)."
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node.js debe ser versión 20 o superior (tienes $(node -v))."
command -v npm >/dev/null 2>&1 || die "Falta npm."
command -v python3 >/dev/null 2>&1 || die "Falta python3."
command -v curl >/dev/null 2>&1 || die "Falta curl."

# --- 1b. Puertos (antes de cambiar nada) ---------------------------------------------------
if port_listening 3306 && [ "$(docker inspect -f '{{.State.Running}}' sensores_mysql 2>/dev/null || true)" != "true" ]; then
  die "El puerto 3306 está ocupado por otro programa. Libéralo y vuelve a ejecutar make dev."
fi
if port_listening 5050 && ! group_alive backend uvicorn; then
  die "El puerto 5050 está ocupado por otro programa. Libéralo y vuelve a ejecutar make dev."
fi
if port_listening 5173 && ! group_alive frontend vite; then
  die "El puerto 5173 está ocupado por otro programa. Libéralo y vuelve a ejecutar make dev."
fi

mkdir -p "$LOG_DIR" "$PID_DIR" "$STATE_DIR"

# --- 2. backend/.env -----------------------------------------------------------------------
if [ ! -f backend/.env ]; then
  info "Creando backend/.env desde backend/.env.example"
  cp backend/.env.example backend/.env
fi
if ! grep -q '^LOGIN_RATE_LIMIT_MAX_ATTEMPTS=' backend/.env; then
  {
    echo ""
    echo "# Solo desarrollo local: las pruebas E2E inician sesión muchas veces"
    echo "LOGIN_RATE_LIMIT_MAX_ATTEMPTS=1000"
  } >>backend/.env
fi

# --- 3. MySQL ------------------------------------------------------------------------------
DB_PASSWORD="$(grep '^DB_PASSWORD=' backend/.env | cut -d= -f2- || true)"
DB_PASSWORD="${DB_PASSWORD:-rootpass}"
export DB_PASSWORD
info "MySQL"
docker compose up -d mysql
wait_for "MySQL" 120 docker compose exec -T mysql mysqladmin ping -h127.0.0.1 -uroot -p"$DB_PASSWORD" --silent

# --- 4. Migraciones y seed -----------------------------------------------------------------
info "Dependencias, migraciones y seed del backend"
(cd backend && uv sync && uv run alembic upgrade head && uv run python -m app.db.seed)

# --- 5. Backend ----------------------------------------------------------------------------
if group_alive backend uvicorn; then
  info "Backend ya estaba corriendo"
else
  info "Iniciando backend"
  start_group backend backend uv run uvicorn app.main:app --reload --port 5050
fi
wait_for "El backend" 60 curl -sf http://localhost:5050/health

# --- 6. Datos demo -------------------------------------------------------------------------
if [ ! -f "$STATE_DIR/demo-seeded" ]; then
  info "Cargando datos demo (30 días de lecturas)"
  make demo-seed
  touch "$STATE_DIR/demo-seeded"
fi

# --- 7. Frontend ---------------------------------------------------------------------------
if [ ! -d frontend/node_modules ] || [ frontend/node_modules -ot frontend/package-lock.json ]; then
  info "Instalando dependencias del frontend (npm ci)"
  (cd frontend && npm ci)
fi
if group_alive frontend vite; then
  info "Frontend ya estaba corriendo"
else
  info "Iniciando frontend"
  start_group frontend frontend ./node_modules/.bin/vite --port 5173 --strictPort
fi
wait_for "El frontend" 60 curl -sf http://localhost:5173/

# --- 8. Gateway ----------------------------------------------------------------------------
SIM_GATEWAY_KEY=""
SIM_LOGICAL_NODE_IDS=""
if [ -f "$STATE_DIR/gateway.env" ]; then
  SIM_GATEWAY_KEY="$(grep '^SIM_GATEWAY_KEY=' "$STATE_DIR/gateway.env" | cut -d= -f2- || true)"
  SIM_LOGICAL_NODE_IDS="$(grep '^SIM_LOGICAL_NODE_IDS=' "$STATE_DIR/gateway.env" | cut -d= -f2- || true)"
fi
gateway_ok() {
  [ -n "$SIM_GATEWAY_KEY" ] && [ -n "$SIM_LOGICAL_NODE_IDS" ] \
    && curl -sf -H "X-API-Key: $SIM_GATEWAY_KEY" http://localhost:5050/api/v1/gateways/me/configuration >/dev/null 2>&1
}
if gateway_ok; then
  info "Reutilizando el gateway existente"
else
  info "Creando el gateway del predio 1"
  if ! GATEWAY_OUT="$(python3 scripts/dev_gateway.py --property-id 1 2>&1)"; then
    if grep -q '409' <<<"$GATEWAY_OUT"; then
      die "El predio 1 ya tiene un equipo de otra sesión. Ejecuta make dev-reset para empezar de cero."
    fi
    # El mensaje del script puede contener la credencial; solo se muestran líneas sin 'gk_'.
    echo "$GATEWAY_OUT" | grep -v 'gk_' >&2 || true
    die "No se pudo crear el gateway del predio 1."
  fi
  umask 077
  grep -E '^SIM_(GATEWAY_KEY|LOGICAL_NODE_IDS)=' <<<"$GATEWAY_OUT" >"$STATE_DIR/gateway.env"
  chmod 600 "$STATE_DIR/gateway.env"
  SIM_GATEWAY_KEY="$(grep '^SIM_GATEWAY_KEY=' "$STATE_DIR/gateway.env" | cut -d= -f2-)"
  SIM_LOGICAL_NODE_IDS="$(grep '^SIM_LOGICAL_NODE_IDS=' "$STATE_DIR/gateway.env" | cut -d= -f2-)"
  [ -n "$SIM_GATEWAY_KEY" ] && [ -n "$SIM_LOGICAL_NODE_IDS" ] || die "dev_gateway.py no devolvió credencial o nodos."
fi

# --- 9. Simulador --------------------------------------------------------------------------
if group_alive simulator simulator_fast.py; then
  info "Simulador ya estaba corriendo"
else
  info "Iniciando simulador"
  NODE_ARGS=()
  IFS=',' read -r -a NODE_IDS <<<"$SIM_LOGICAL_NODE_IDS"
  for id in "${NODE_IDS[@]}"; do NODE_ARGS+=(--logical-node-id "$id"); done
  start_group simulator simulator uv run --with-requirements requirements.txt \
    python simulator_fast.py --gateway-key "$SIM_GATEWAY_KEY" "${NODE_ARGS[@]}" --interval 60
fi

# --- 10. Resumen ---------------------------------------------------------------------------
cat <<SUMMARY

Stack local listo.

  App:       http://localhost:5173/
  API docs:  http://localhost:5050/api/v1/docs

  Admin:     admin@sensores.com / admin123
  Cliente:   alan2203mx@gmail.com / 123

  Logs:      .dev/logs/backend.log, .dev/logs/frontend.log, .dev/logs/simulator.log
  Detener:   make dev-down   (conserva los datos; make dev-reset los borra)
SUMMARY
