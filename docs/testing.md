# Testing del Sistema — IoT de Riego Agrícola

Guía única de estrategias, comandos e infraestructura de pruebas del MVP. El backend (FastAPI) y el frontend (React/Vite) se prueban por separado.

## Backend (pytest)

Estrategia de **pirámide de dos niveles** contra la API REST, sin dependencias externas: SQLite en memoria (`sqlite:///:memory:`), sin MySQL ni Docker para correr la suite.

- **Integración** — HTTP end-to-end con `TestClient` de FastAPI: flujos request→BD, roles y permisos (401/403), rutas REST.
- **Unitario** — Lógica de negocio aislada en la capa de servicios (con BD en memoria).
- **Principios**: aislamiento entre tests (transacciones con rollback), 327 tests en ~1 minuto, fixtures reutilizables en `conftest.py`.

### Stack

Dependencias de testing en el grupo `dev` de `backend/pyproject.toml`: `httpx` (transporte async del TestClient), `pytest`, `pytest-cov`.

### Ejecución (desde `backend/`)

```bash
uv run pytest tests/ -v                    # Toda la suite
uv run pytest tests/ --cov=app --cov-report=term-missing   # Con cobertura en terminal
uv run pytest tests/ --cov=app --cov-report=html:htmlcov   # Reporte HTML (htmlcov/index.html)
uv run pytest tests/unit/ -v               # Solo unitarios
uv run pytest tests/integration/ -v        # Solo integración e2e
uv run pytest tests/ -v -k "test_login_admin_success"   # Test por keyword
uv run pytest tests/ -x                    # Detener al primer fallo
```

### Estructura

```text
backend/tests/
├── conftest.py          # Fixtures globales: BD, TestClient, tokens, entidades default
├── unit/                # Tests de la capa de servicios (security, users, clients, readings...)
└── integration/         # Tests HTTP de red (auth, readings, users, permissions...)
```

### Fixtures principales (`conftest.py`)

| Fixture | Descripción |
|---------|-------------|
| `create_tables` (session) | Crea el schema SQLAlchemy una vez por sesión pytest |
| `db` (function) | Sesión activa con rollback al concluir la prueba |
| `client` (function) | `TestClient` con sobreescritura de `get_db()` |
| `admin_user` / `client_user` | Registros instanciados en BD |
| `admin_token` / `client_token` | JWTs literales para flujos de autenticación |
| `admin_headers` / `client_headers` | Headers HTTP listos para `client.post(..., headers=...)` |
| `node_headers` | Emula credencial de gateway + `X-Logical-Node-Id` |
| `sample_*` (cascada) | Pide `sample_crop_cycle` y crea en cadena User → Property → CropType → IrrigationArea → CropCycle |

### Cobertura

Suite de 327 tests al 100% de éxito, cobertura transaccional >80% (excluyendo migraciones Alembic y seed). Cubre flujos positivos y restrictivos (404/401/422/409).

## Frontend (vitest)

Pruebas unitarias de componentes/hooks con **Vitest** (motor), **React Testing Library** (DOM virtual) y **JSDOM**; sin peticiones reales.

- **Componentes puros de UI**: tarjetas, botones, indicadores, EmptyStates — accesibilidad (`roles`), clases condicionales, disabling en asincrónicos.
- **Custom hooks**: `useIsMobile`, `usePageVisibility` — falseando APIs web (`window.innerWidth`, eventos `visibilitychange`).
- **Estándar**: cada test corre pareado con su artefacto (`<Nombre>.test.tsx/.ts`): `describe()` → mocks `vi.fn()` → `render()` → `it()` → `act()`/`fireEvent` → `expect()`.

### Ejecución (desde `frontend/`)

```bash
npm run test            # Validación rápida
npm run test:ui         # Panel web con cada test desgranado
npm run test:coverage   # Mapa de porcentaje del código verificado
npm run typecheck       # TypeScript estático (tsc --noEmit)
npm run build           # Vite/Rollup: detecta imports rotos y dependencias muertas
```

### Pruebas manuales (QA)

- **ESC-01 Autenticación** — login admin, rebote con Toast en contraseñas malas, cerrar sesión destruyendo tokens.
- **ESC-02 Dashboard & tiempo real** — con `simulator.py` corriendo, la tarjeta de "Humedad del Suelo" y el indicador de frescura actualizan sin recargar (flicker-free).
- **ESC-03 Histórico y filtros** — selector de fechas repinta la gráfica; "Exportar" descarga CSV/PDF del backend.
- **ESC-04 Formularios Admin** — correo duplicado al crear Cliente bloquea y avisa (HTTP 409).

## CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada push a `main` y PR:

- **Backend** — `uv sync --frozen` → `ruff check app tests` → `uv run pytest -q`.
- **Frontend** — `npm ci` → `npm run typecheck` → `npm run test -- --run` → `npm run build`.

## Pendientes conocidos

- **E2E de UI** para el chat IA (`/cliente/asistente-ia`) y flujos de reportes — no existe suite de E2E (Playwright); los módulos IA solo tienen tests de integración backend.
- **Pruebas de carga ligeras** para ingesta a 144 lecturas/día/nodo (volumen objetivo) — pendiente recomendado.
- **Cobertura de schedulers**: `inactivity_scheduler` y `notification_scheduler` no tienen tests unitarios (el de `ai_report_scheduler` sí).