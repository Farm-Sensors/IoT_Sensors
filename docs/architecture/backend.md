# Arquitectura del Backend

> Vista "cómo está construido". El comportamiento especificado está en `openspec/specs/` (especialmente `readings`, `security` y `data-model`).

## Stack

- **Python 3.13** + **FastAPI** (async, tipado, OpenAPI autogenerado) + **Uvicorn**.
- **SQLAlchemy 2.0** (ORM) + **Alembic** (migraciones) sobre **MySQL 8**.
- Dependencias gestionadas con **uv** (`pyproject.toml` + `uv.lock`); Docker multi-stage con healthcheck.
- Tests: pytest (327 tests) + ruff (reglas E4/E7/E9/F); CI en GitHub Actions.

## Estructura (`backend/app/`)

```
app/
├── main.py            # App FastAPI + CORS (por env CORS_ORIGINS)
├── core/              # config (Settings, flags), deps (auth/roles/api-key),
│                      # security (JWT/bcrypt), authz, time, emailer, scheduler_client
├── api/v1/
│   └── endpoints/     # clients, properties, irrigation_areas, crop_types,
│                      # crop_cycles, nodes, readings, alerts, thresholds,
│                      # ai_assistant, ai_reports, auth, users, audit_logs,
│                      # notification_preferences
├── services/          # Lógica de negocio por entidad; paquetes `alerts/`
│                      # (queries, inactivity, dispatch, recommendations) y
│                      # `ai_chat/` (context, model, helpers, widgets, guardrails)
├── models/            # SQLAlchemy, tablas en español, soft delete (eliminado_en)
├── schemas/           # Pydantic: API en inglés, mapeo a columnas en español
├── db/                # session, seed (datos base), demo_seed (dataset 30 días)
└── jobs/              # Schedulers: inactivity, notification, ai_report
                       # (contenedores aparte, profile phase2 en compose)
```

## Convenciones

- **Patrón**: endpoint delgado → service → model; schemas Pydantic para validación/serialización.
- **API en inglés** (URLs plurales versionadas `/api/v1/...`), **BD en español** (`nodos`, `areas_riego`, `marca_tiempo`).
- **Soft delete** uniforme (`eliminado_en`) en entidades principales; timestamps `creado_en`/`actualizado_en` en UTC.
- **Paginación** obligatoria en listados (`page`/`per_page`, default 50, cap 200).
- **Auth**: JWT (usuarios) + credencial de gateway (`X-API-Key`) con `X-Logical-Node-Id`; ownership multi-tenant en la capa de servicio (`core/authz.py`).
- **Fase 2 dormida**: flags en `core/config.py` (`ALERTS_ENABLED`, `AI_ASSISTANT_ENABLED`, `AI_REPORTS_ENABLED`, `NOTIFICATIONS_ENABLED`...); schedulers detrás del profile `phase2` de compose. Ver `docs/architecture/decisions.md` (ADR-004).

## Datos

- Lecturas en **wide table** (`lecturas`, 12 campos dinámicos) con índices `(nodo_id, marca_tiempo)`; detalle en `docs/data-model.md` y `openspec/specs/data-model`.
- Seeds: `app.db.seed` (jerarquía demo + API keys) y `app.db.seed_demo` (dataset histórico de 30 días + umbrales, reproducible con semilla).