# Stack Tecnológico

## Resumen

| Capa | Tecnología |
|---|---|
| **Backend** | Python 3.13 / FastAPI / Uvicorn (puerto 5050) — dependencias con `uv` |
| **Base de Datos** | MySQL 8 (puerto 3306) / SQLAlchemy 2.0 / Alembic |
| **Frontend** | React 18 (SPA) / Vite 6 / TypeScript / react-router 7 / Tailwind CSS v4 / shadcn-ui (Radix) |
| **Gráficos y mapas** | Recharts / MapLibre GL JS (+ OpenFreeMap) |
| **Despliegue** | Docker + Docker Compose / Dokploy / Traefik (SSL automático) / Nginx interno (frontend) |
| **Servidor** | VPS Linux ("Servidor Grogu") |
| **CI** | GitHub Actions (ruff + pytest / typecheck + vitest + build) |
| **Contrato edge** | `contracts/edge-cloud/v2/` (IoT canónico; Agro.io vende copia) |

## Versiones clave

- Python `>=3.13`, FastAPI `>=0.135`, SQLAlchemy `>=2.0.48`, Alembic `>=1.18.4`, Pydantic v2, `python-jose` + `bcrypt`.
- Node 20, React `18.3.1`, Vite `6.x`, TypeScript `^5.9`, Tailwind v4 (CSS-first, sin `tailwind.config.js`).
- MySQL `8.0` (contenedor), Uvicorn con healthcheck.
- Paquetes frontend: 47 dependencias (shadcn/Radix + lucide + recharts + maplibre + sonner + motion + react-hook-form).

## Servicios Docker Compose

| Servicio | Notas |
|---|---|
| `mysql` | BD, bind local |
| `backend` | FastAPI + Uvicorn; `alembic upgrade head` al arrancar; flags de Fase 2 OFF por defecto |
| `frontend` | Nginx sirviendo build estático; proxy `/api` → backend |
| `inactivity_scheduler` / `notification_scheduler` / `ai_report_scheduler` | **Profile `phase2`** — no arrancan con `docker compose up` normal |

## Detalles por capa

- **Backend**: ver `docs/architecture/backend.md`.
- **Frontend**: ver `docs/architecture/frontend.md`.
- **Deployment**: ver `docs/deployment.md`.