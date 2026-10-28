#!/usr/bin/env bash
# Solo desarrollo local: detiene backend, frontend, simulador y MySQL de make dev.
# Uso: make dev-down  |  make dev-reset  (./scripts/dev_down.sh --reset)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_DIR="$ROOT/.dev/pids"
RESET=0
case "${1:-}" in
  "") ;;
  --reset) RESET=1 ;;
  *) echo "Uso: $0 [--reset]" >&2; exit 2 ;;
esac

# Pide confirmación antes de tocar nada.
if [ "$RESET" -eq 1 ]; then
  read -r -p "¿Borrar la base de datos local y .dev/? Escribe si: " ANSWER || ANSWER=""
  if [ "$ANSWER" != "si" ]; then
    echo "Cancelado: no se borró nada."
    exit 0
  fi
fi

stop_group() { # name pattern
  local name="$1" pattern="$2" file="$PID_DIR/$1.pgid" pgid i
  [ -f "$file" ] || return 0
  pgid="$(cat "$file")"
  if [[ "$pgid" =~ ^[0-9]+$ ]] && kill -0 -- "-$pgid" 2>/dev/null \
     && ps -o command= -p "$pgid" 2>/dev/null | grep -q -- "$pattern"; then
    echo "==> Deteniendo $name"
    kill -TERM -- "-$pgid" 2>/dev/null || true
    for ((i = 0; i < 10; i++)); do
      kill -0 -- "-$pgid" 2>/dev/null || break
      sleep 1
    done
    kill -0 -- "-$pgid" 2>/dev/null && kill -KILL -- "-$pgid" 2>/dev/null || true
  fi
  rm -f "$file"
}

stop_group simulator simulator_fast.py
stop_group frontend vite
stop_group backend uvicorn

if [ "$RESET" -eq 1 ]; then
  echo "==> Eliminando contenedores y volumen de MySQL"
  docker compose down -v
  rm -rf "$ROOT/.dev"
  echo "Entorno local reiniciado."
else
  echo "==> Deteniendo MySQL (los datos se conservan)"
  docker compose stop mysql
fi
