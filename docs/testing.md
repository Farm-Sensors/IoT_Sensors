# Testing del Sistema — IoT de Riego Agrícola

Guía única de estrategias, comandos e infraestructura de pruebas del MVP. El backend (FastAPI) y el frontend (React/Vite) se prueban por separado.

## Backend (pytest)

Estrategia de **pirámide de dos niveles** contra la API REST, sin dependencias externas: SQLite en memoria (`sqlite:///:memory:`), sin MySQL ni Docker para correr la suite.

- **Integración** — HTTP end-to-end con `TestClient` de FastAPI: flujos request→BD, roles y permisos (401/403), rutas REST.
- **Unitario** — Lógica de negocio aislada en la capa de servicios (con BD en memoria).
- **Principios**: aislamiento entre tests (transacciones con rollback), 433 funciones `def test_` en backend (ver conteo abajo), fixtures reutilizables en `conftest.py`.

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
├── integration/         # Tests HTTP de red (auth, readings, gateways, ndvi, users, permissions...)
├── mysql/               # Aceptación opt-in contra MySQL 8 vacío (migraciones de gateway)
└── helpers/             # Utilidades compartidas (p.ej. `contract.py`)
```

Conteo (por texto, `grep -rE "^\s*(async )?def test_"` sobre `backend/tests/`; no cuenta casos parametrizados): **433** funciones = 154 en `unit/` + 278 en `integration/` + 1 en `mysql/`. El número real de casos que reporta pytest puede ser mayor. Para el total exacto ejecuta `uv run pytest --collect-only -q`.

### Fixtures principales (`conftest.py`)

| Fixture | Descripción |
|---------|-------------|
| `create_tables` (session) | Crea el schema SQLAlchemy una vez por sesión pytest |
| `db` (function) | Sesión activa con rollback al concluir la prueba |
| `client` (function) | `TestClient` con sobreescritura de `get_db()` |
| `admin_user` / `client_user` | Registros instanciados en BD |
| `admin_token` / `client_token` | JWTs literales para flujos de autenticación |
| `admin_headers` / `client_headers` | Headers HTTP listos para `client.post(..., headers=...)` |
| `node_headers` | Nombre histórico del fixture (no renombrado): emula credencial de gateway + `X-Logical-Node-Id`, no una API key de nodo |
| `sample_*` (cascada) | Pide `sample_crop_cycle` y crea en cadena User → Property → CropType → IrrigationArea → CropCycle |

### Cobertura

Suite backend sin dependencias externas (los tests de `tests/mysql/` se omiten sin MySQL), cobertura transaccional >80% (excluyendo migraciones Alembic y seed). Cubre flujos positivos y restrictivos (404/401/422/409).

### MySQL de gateways (opt-in)

`tests/mysql/test_gateway_migrations.py` valida migraciones y constraints contra una base MySQL 8 **vacía y desechable**; se omite si falta la variable. CI lo corre en el job `gateway-mysql`:

```bash
GATEWAY_MYSQL_TEST_URL=mysql+pymysql://root@127.0.0.1:3306/issue29_test \
  uv run pytest tests/mysql/test_gateway_migrations.py -q
```

### Contrato edge-cloud v2 y harness (`scripts/integration/`, desde la raíz)

```bash
python -m pip install -r scripts/integration/contract-requirements.txt
python scripts/integration/validate_v2_contract.py                                   # paquete v2 + v1 congelado
python -m unittest discover -s scripts/integration -p 'test_v2_contract.py'          # regresión del contrato
python -m unittest discover -s scripts/integration -p 'test_h0_harness.py' -v        # harness H0 (offline)
python -m unittest discover -s scripts/integration -p 'test_h1_harness.py' -v        # harness H1 (plan-only)
```

El job `edge-cloud-contract` de CI ejecuta los dos primeros. Detalle de los harness en `scripts/integration/README.md`.

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

- **Contrato v2** — `validate_v2_contract.py` + `test_v2_contract.py` (Python 3.13).
- **Backend** — `uv sync --frozen` → `ruff check app tests` → `uv run pytest -q` (Python 3.13).
- **Gateway MySQL** — `tests/mysql/test_gateway_migrations.py` contra un servicio `mysql:8.0`.
- **Frontend** — `npm ci` → `npm run typecheck` → `npm run test -- --run` → `npm run build`.

## Pendientes conocidos

- **E2E de UI** para el chat IA (`/cliente/asistente-ia`) y flujos de reportes — no existe suite de E2E (Playwright); los módulos IA solo tienen tests de integración backend.
- **Pruebas de carga ligeras** para ingesta a 144 lecturas/día/nodo (volumen objetivo) — pendiente recomendado.
- **Cobertura de schedulers**: `inactivity_scheduler` y `notification_scheduler` no tienen tests unitarios (el de `ai_report_scheduler` sí).