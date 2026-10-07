.PHONY: help openapi-sync demo-seed demo-seed-dry demo-live demo-live-partner-vps

help:
	@echo "Targets disponibles:"
	@echo "  make openapi-sync   Regenera openapi.yaml desde el backend activo"
	@echo "  make demo-seed      Ejecuta seed_demo real para cuenta demo por defecto"
	@echo "  make demo-seed-dry  Ejecuta seed_demo en dry-run"
	@echo "  make demo-live      Ejecuta simulator_fast en --quick-demo (requiere SIM_GATEWAY_KEY y SIM_LOGICAL_NODE_IDS)"
	@echo "  make demo-live-partner-vps  Ejecuta simulador productivo socio (VPS)"

openapi-sync:
	./scripts/sync_openapi.sh

demo-seed:
	cd backend && DEBUG=true uv run python -m app.db.seed_demo

demo-seed-dry:
	cd backend && DEBUG=true uv run python -m app.db.seed_demo --dry-run

demo-live:
	@: "$${SIM_GATEWAY_KEY:?Falta SIM_GATEWAY_KEY (credencial de gateway, p. ej. gk_xxx).}"
	@: "$${SIM_LOGICAL_NODE_IDS:?Falta SIM_LOGICAL_NODE_IDS (lista separada por comas, p. ej. 12,13).}"
	cd simulator && python3 simulator_fast.py --gateway-key "$${SIM_GATEWAY_KEY}" $$(printf -- '--logical-node-id %s ' $$(echo "$${SIM_LOGICAL_NODE_IDS}" | tr ',' ' ')) --quick-demo

demo-live-partner-vps:
	cd simulator && ./run_partner_vps.sh
