# Sistema IoT de Riego Agrícola

Sistema web para el monitoreo de sensores de riego agrícola. Recibe lecturas de nodos IoT cada 10 minutos y las presenta en un dashboard multicategoría con históricos, filtros y exportación.

- **Documentación completa**: empieza en [`docs/README.md`](docs/README.md) (3 capas: producto, OpenSpec, referencia técnica).

## Estructura del Proyecto

```
├── AGENTS.md                # Contexto y reglas para agentes IA
├── README.md                # Este archivo (portada)
├── openapi.yaml             # Contrato OpenAPI autogenerado (make openapi-sync)
├── Makefile                 # Atajos: demo-seed, demo-live, openapi-sync
│
├── docs/                    # Documentación (ver docs/README.md)
│   ├── product/             #   Capa de producto (visión, problema, requerimientos)
│   ├── architecture/        #   Arquitectura (overview, frontend, backend, ADRs)
│   ├── stack.md · api.md · data-model.md · security.md
│   ├── design-system.md · deployment.md · operations.md · testing.md
│   ├── test-data.md         #   Credenciales de prueba y API keys
│   └── deliverables/        #   Entregables al cliente (SRS, QA, Word)
│
├── openspec/                # Specs SDD del sistema (6 capacidades + cambios)
├── backend/                 # API REST (FastAPI + Python 3.13, uv)
├── frontend/                # Web App (React 18 + Vite + Tailwind v4)
├── simulator/               # Simulador de Hardware IoT
├── scripts/                 # Scripts de operación (smoke, sync, setup)
└── docker-compose.yml       # Orquestación (MySQL, backend, frontend, schedulers)
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.13 / FastAPI / Uvicorn |
| Frontend | React 18 / Vite / TypeScript / Tailwind v4 / shadcn-ui |
| Base de Datos | MySQL 8 / SQLAlchemy / Alembic |
| Despliegue | Docker Compose / Dokploy / Traefik / Nginx |
| CI | GitHub Actions (ruff + pytest / typecheck + vitest + build) |

Detalle y versiones: [`docs/stack.md`](docs/stack.md).

## Desarrollo Local

**Prerequisitos:** Docker Desktop.

```bash
# Paso 0 — Variables de entorno del backend (obligatorio)
cd backend && cp .env.example .env

# Paso 1 — Base de Datos (desde la raíz)
docker compose up -d mysql

# Paso 2 — Backend (http://localhost:5050, docs en /docs)
cd backend
uv sync && uv run alembic upgrade head && uv run python -m app.db.seed
uv run uvicorn app.main:app --reload --port 5050

# Paso 3 — Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Paso 4 — Simulador IoT (credencial de gateway)
cd simulator && python3 simulator.py --gateway-key gk_... --logical-node-id 12
```

> El seed crea el admin, el cliente de prueba y los nodos lógicos. La ingesta usa la credencial del gateway del predio. Más opciones del simulador en [`docs/operations.md`](docs/operations.md) y el corte v2 en [`docs/integration/README.md`](docs/integration/README.md).

## Demo Rápida

```bash
make demo-seed   # seed base + dataset histórico de 30 días + umbrales (reproducible)
make demo-live   # simulación en vivo multi-nodo con breaches de umbral
```

Guía completa (opciones, checklist, purga manual, trigger de reportes IA): [`docs/operations.md`](docs/operations.md).

## Despliegue (Producción)

El proyecto se despliega en un VPS Linux con **Dokploy** y **Docker Compose**: conecta el repo como Compose Project, pega `.env.docker.example` en Environment y despliega; Traefik emite SSL automático para el dominio.

Guía operativa paso a paso: [`docs/deployment.md`](docs/deployment.md).

## Política de Documentación (SDD + Trabajo por Hitos)

El repo usa **OpenSpec (spec-driven development)**: todo cambio de comportamiento parte de un cambio en `openspec/changes/` (proposal → delta specs → design → tasks) y se archiva al cerrarlo, sincronizando `openspec/specs/`. La documentación de referencia vive en `docs/` y se actualiza en el mismo bloque de trabajo:

1. **Actualización mínima inmediata:** cuando cambia contrato técnico (API, BD, flujo visible), se actualiza la documentación en el mismo bloque de trabajo.
2. **Cierre por hito/módulo:** al terminar un bloque funcional, se revisa consistencia cruzada entre specs, arquitectura, API y BD.
3. **Pulido final de release:** al final del ciclo, se realiza limpieza editorial (formato, duplicados, pendientes).

CI: GitHub Actions corre en cada push/PR — backend (ruff + pytest) y frontend (typecheck + vitest + build).

Checklist mínimo por cambio técnico:

- ¿Cambió contrato técnico (API, BD, flujo visible)? → cambio OpenSpec (`openspec new change <nombre>`) + `docs/api.md` / `docs/data-model.md`.
- ¿Cambió flujo operativo o componentes activos/futuros? → `docs/architecture/overview.md` y/o `docs/architecture/frontend.md`.
- ¿Cambió alcance funcional del producto? → `docs/deliverables/` (SRS).

### Plantilla DoD Documental (Por Feature/Hito)

- Feature/Hito: `<nombre>` · Fecha: `<YYYY-MM-DD>` · Estado: `MVP` / `MVP Extendido (Fase 2 Lite)` / `Fase 2 Completa (futuro)`

Checklist DoD:

- [ ] Cambio OpenSpec creado y archivado (`openspec/specs/` sincronizado).
- [ ] API actualizada (`docs/api.md`): endpoints, payloads, validaciones, errores, ejemplos.
- [ ] BD actualizada (`docs/data-model.md`): tablas, relaciones, índices, reglas de negocio.
- [ ] Arquitectura actualizada (`docs/architecture/overview.md` y/o `frontend.md`): flujo activo, componentes, límites de alcance.
- [ ] CI verde: backend (ruff + pytest) y frontend (typecheck + vitest + build).
- [ ] Consistencia transversal validada: misma terminología, mismos nombres de endpoint/campos, mismos estados de fase.

## Documentación

La documentación se organiza en **3 capas** (ver [`docs/README.md`](docs/README.md)): **producto** (el por qué), **OpenSpec** (el qué) y **referencia técnica** (el cómo).

| Documento | Descripción |
|-----------|-------------|
| [`docs/product/`](docs/product/) | **Producto**: visión, problema, requerimientos de alto nivel |
| [`openspec/specs/`](openspec/specs/) | **Specs SDD** — 6 capacidades: data-model, security, readings, alerting, ai-modules, geo-visualization |
| [`docs/architecture/`](docs/architecture/) | Arquitectura: overview, frontend, backend, decisiones (ADRs) |
| [`docs/stack.md`](docs/stack.md) | Stack tecnológico y versiones |
| [`docs/api.md`](docs/api.md) | Guía rápida de la API REST |
| [`openapi.yaml`](openapi.yaml) | Contrato OpenAPI 3.1 autogenerado (`make openapi-sync`) |
| [`docs/data-model.md`](docs/data-model.md) | Modelo de datos, tablas, relaciones, consultas de referencia |
| [`docs/security.md`](docs/security.md) | Mecanismos de seguridad y pendientes |
| [`docs/design-system.md`](docs/design-system.md) | Design system del frontend (tokens reales) |
| [`docs/deployment.md`](docs/deployment.md) | Despliegue en Dokploy |
| [`docs/operations.md`](docs/operations.md) | Operación: demo, simulador, schedulers, scripts |
| [`docs/testing.md`](docs/testing.md) | Estrategia de testing (pytest, vitest) + CI |
| [`docs/test-data.md`](docs/test-data.md) | Credenciales de prueba (admin/cliente) y API Keys |
| [`docs/deliverables/`](docs/deliverables/) | Entregables al cliente: SRS, Reporte Ejecutivo QA, Entregable Word |