# Seguridad

> Vista general de los mecanismos de seguridad. La especificación de comportamiento está en `openspec/specs/security`.

## Dos mecanismos de autenticación

| Actor | Mecanismo | Detalle |
|---|---|---|
| **Usuarios web** (Admin/Cliente) | JWT | Login devuelve `access_token` (30 min) + `refresh_token` (7 días, persistido en BD). Frontend envía `Authorization: Bearer <token>`; ante 401 renueva con `POST /auth/refresh` |
| **Gateway Agro.io** | Credencial hasheada | Una por predio; `X-API-Key` + identidad de nodo lógico. Las keys de nodo se conservan solo para observación de rollback y no autentican |

## Roles y ownership (multi-tenant)

- Dos roles: `admin` (acceso global, gestión de todo) y `cliente` (solo sus predios/áreas).
- El ownership se aplica **server-side** en la capa de servicios (`core/authz.py`): el cliente nunca recibe datos de otros clientes (403 en acceso cruzado; listados scopeados a sus áreas).

## Hardening implementado

| Medida | Cómo |
|---|---|
| `SECRET_KEY` | Guard de arranque: si `DEBUG=false` y la clave es un default conocido, la app **no arranca** |
| CORS | `CORS_ORIGINS` por env (coma-separada); `allow_credentials` solo con origins explícitas, nunca con `*` |
| Rate-limit de login | Ventana configurable (`LOGIN_RATE_LIMIT_WINDOW_MINUTES`=15, `MAX_ATTEMPTS`=10) por email e IP → 429 (en memoria, single worker) |
| Contraseñas | Hash bcrypt |
| Refresh tokens | Revocados en logout y en cambio de contraseña (incl. reset) |
| Password reset | Token SHA-256, single-use, con rate-limit por email/IP (3/email, 20/IP por 15 min) |
| API keys de nodos | Únicas por nodo; no expuestas en respuestas de lectura |

## Pendientes conocidos

- Refresh tokens **sin rotación** ni detección de reuso (se revocan en logout/cambio de password).
- Columna legado `nodos.api_key` puede existir para observación; **no autentica**. Las credenciales de gateway se almacenan hasheadas.
- Rate-limit de login en memoria (no distribuye entre múltiples workers de uvicorn).
- Auditoría (`audit_log`) no cubre los CRUD base (clientes, predios, áreas, nodos) — solo Fase 2/umbrales/IA.