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
| Credencial de gateway | Una por predio; se muestra una sola vez al activar/rotar, se guarda solo como hash SHA-256 (`pasarelas.credencial_hash`, UNIQUE), se puede rotar y revocar; la autenticación exige gateway `active` |
| Idempotencia de ingesta | `X-Event-ID` por gateway + nodo lógico; mismo cuerpo 200, cuerpo distinto 409 |
| Referencia de activación | Un solo uso, 24 h, guardada como hash (`referencias_activacion`); respuestas 401 uniformes |
| Emparejamiento por código (RFC 8628) | `device_code` guardado como SHA-256 y `user_code` como **HMAC-SHA256** con clave de servidor; códigos nunca en claro ni en logs; TTL 600 s e intervalo 5 s; lockouts por IP/admin y por sesión |

### Emparejamiento por código de dispositivo (RFC 8628)

Camino alternativo de activación (detrás de `GATEWAY_PAIRING_ENABLED`, **OFF por defecto**; con la flag apagada responde **503**). Controles, todos en `backend/app/services/gateway_pairing.py`, `backend/app/models/pairing_session.py` y `backend/app/api/v1/endpoints/gateway_pairing.py`:

- **Códigos nunca en claro.** El `device_code` se persiste como **SHA-256** (`codigo_dispositivo_hash`) y el `user_code` como **HMAC-SHA256** con clave (`PAIRING_CODE_HMAC_KEY`, con `SECRET_KEY` como respaldo); la columna `codigo_usuario_vivo` expone el HMAC solo mientras la sesión está viva, para imponer un `UNIQUE` de "un código vivo por vez". El espacio de `user_code` (8 caracteres de `BCDFGHJKLMNPQRSTVWXZ`, ~2^34) es pequeño para un hash desnudo, de ahí el HMAC con clave.
- **Sin códigos en logs.** Ni `device_code` ni `user_code` se registran: los logs llevan el `session_id` opaco y el desenlace; hay una prueba de redacción (`caplog`) en `backend/tests/integration/test_gateway_pairing_admin_api.py`.
- **TTL e intervalo.** Sesión de **600 s** (`PAIRING_TTL_SECONDS`) e intervalo de sondeo de **5 s**; expiración perezosa. Un sondeo de una sesión aprobada más rápido que su intervalo devuelve `slow_down` y **sube el intervalo +5 s por vez, acotado a 60 s** (`PAIRING_SLOW_DOWN_SECONDS`, `PAIRING_MAX_INTERVAL_SECONDS`) para no castigar indefinidamente.
- **Lockouts y topes.** Arranque **5 por IP / 10 min** y tope global de **50 sesiones vivas** → **429**; fallos de admin **10 / 15 min** por admin **y** por IP → **429**; **5** intentos de `user_code` fallidos por sesión la pasan a `denied`. Lookup de código desconocido/expirado/consumido/denegado → **404 uniforme**.
- **Aprobación con JWT y confirmación explícita.** Lookup/aprobar/denegar exigen admin; aprobar requiere `confirm: true` y el `user_code` que coincide (comparado con `hmac.compare_digest`). El `device_code` nunca vuelve al admin.
- **Credencial de un solo uso.** La redención consume la sesión una vez, devuelve la credencial `gk_` **solo en esa respuesta** y revoca las referencias `ar_` vigentes; en modo rotación (`replace_credential`) revoca la credencial anterior en la misma transacción conservando gateway, slots y vínculos.

## Pendientes conocidos

- Refresh tokens **sin rotación** ni detección de reuso (se revocan en logout/cambio de password).
- Columna legado `nodos.api_key` puede existir para observación/rollback; **no autentica** y no se usa en ninguna ruta. Las credenciales de gateway se almacenan hasheadas.
- Rate-limit de login en memoria (no distribuye entre múltiples workers de uvicorn).
- Los límites **por IP** del emparejamiento (arranques y fallos de admin) también viven en memoria de un solo proceso, igual que el de login; los contadores **por sesión** (intentos de código y sondeos) sí se persisten en la fila (`sesiones_emparejamiento`), así que sobreviven al reinicio y funcionan entre workers (decisión 8 del change).
- Auditoría (`audit_log`) no cubre los CRUD base (clientes, predios, áreas, nodos) — solo Fase 2/umbrales/IA.