#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SIM_BASE_URL:-https://sensores.alanrz.bond/api/v1}"
GATEWAY_KEY="${SIM_GATEWAY_KEY:-}"
LOGICAL_NODE_IDS="${SIM_LOGICAL_NODE_IDS:-}"  # comma-separated
ADMIN_EMAIL="${SIM_ADMIN_EMAIL:-admin@sensores.com}"
ADMIN_PASSWORD="${SIM_ADMIN_PASSWORD:-}"
INTERVAL="${SIM_INTERVAL:-2}"
DISPATCH_INTERVAL="${SIM_DISPATCH_INTERVAL:-20}"
DISPATCH_LIMIT="${SIM_DISPATCH_LIMIT:-200}"
AI_REPORT_DAYS="${SIM_AI_REPORT_DAYS:-7}"
AI_REPORT_INITIAL_DELAY="${SIM_AI_REPORT_INITIAL_DELAY:-15}"
AI_REPORT_INTERVAL="${SIM_AI_REPORT_INTERVAL:-20}"

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  echo "Falta SIM_ADMIN_PASSWORD."
  echo "Ejemplo:"
  echo "  SIM_ADMIN_PASSWORD='TU_PASSWORD' ./run_partner_vps.sh"
  exit 1
fi

if [[ -z "${GATEWAY_KEY}" || -z "${LOGICAL_NODE_IDS}" ]]; then
  echo "Faltan SIM_GATEWAY_KEY y/o SIM_LOGICAL_NODE_IDS (lista separada por comas)."
  echo "Ejemplo:"
  echo "  SIM_GATEWAY_KEY='gk_...' SIM_LOGICAL_NODE_IDS='node-01,node-02' SIM_ADMIN_PASSWORD='TU_PASSWORD' ./run_partner_vps.sh"
  exit 1
fi

NODE_ARGS=()
IFS=',' read -ra _ids <<< "${LOGICAL_NODE_IDS}"
for id in "${_ids[@]}"; do
  NODE_ARGS+=(--logical-node-id "${id}")
done

echo "Iniciando simulador partner VPS..."
echo "  BASE_URL=${BASE_URL}"
echo "  LOGICAL_NODE_IDS=${LOGICAL_NODE_IDS}"
echo "  ADMIN_EMAIL=${ADMIN_EMAIL}"

python3 simulator_fast.py \
  --gateway-key "${GATEWAY_KEY}" \
  "${NODE_ARGS[@]}" \
  --base-url "${BASE_URL}" \
  --mode demo-alerts \
  --interval "${INTERVAL}" \
  --dispatch-notifications \
  --dispatch-interval "${DISPATCH_INTERVAL}" \
  --dispatch-limit "${DISPATCH_LIMIT}" \
  --admin-email "${ADMIN_EMAIL}" \
  --admin-password "${ADMIN_PASSWORD}" \
  --ai-weekly-report \
  --ai-weekly-report-per-key-area \
  --ai-weekly-report-force \
  --ai-weekly-report-days "${AI_REPORT_DAYS}" \
  --ai-weekly-report-initial-delay "${AI_REPORT_INITIAL_DELAY}" \
  --ai-weekly-report-interval "${AI_REPORT_INTERVAL}"
