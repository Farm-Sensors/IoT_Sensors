# Datos de Prueba (MVP)

A continuación se listan las credenciales y datos insertados actualmente en la base de datos para realizar pruebas del sistema.

## 👥 Usuarios

### Administrador
Tiene acceso a todas las pantallas, configuraciones de nodos, clientes, predios y catálogos.
- **Login:** `admin@sensores.com`
- **Password:** `admin123`

### Clientes (Usuarios Finales)
Tienen acceso únicamente a ver sus propios predios, áreas de riego y dashboards.

**1. Alan Test (Recomendado para pruebas)**
Este usuario tiene estructuras demo y productivas del socio formador.
- **Login:** `alan2203mx@gmail.com`
- **Password:** `123`

**2. Juan López**
Usuario cliente inicial, actualmente sin predios asignados. El dashboard aparecerá vacío hasta que el Admin le asigne un predio.
- **Login:** `jlopez@test.com`
- **Password:** `admin123`

---

## 📡 Nodos IoT y credenciales de ingesta

La telemetría ya no se autentica con la API Key del nodo. Tras el cutover a gateway v2, cada predio tiene **una credencial de gateway** que viaja en la cabecera `X-API-Key`, y el nodo emisor se identifica con la cabecera `X-Logical-Node-Id` (más `X-Event-ID` para idempotencia). El simulador recibe ambas por CLI o por variables de entorno:

```bash
python simulator_fast.py --gateway-key gk_xxxxxx --logical-node-id 12 --quick-demo
```

Las columnas `API Key` de las tablas siguientes listan las claves de nodo **legado**: siguen en la base de datos para observación/rollback, pero **no autentican** lecturas (ver `docs/integration/gateway-v2-cutover-runbook.md`).

### Productivo socio (sin fallback)

| Nombre Nodo | Área Asignada (Predio) | API Key (legado, no autentica) |
|-------------|------------------------|---------|
| Nodo Granja Hogar | Area Granja Hogar (Granja Hogar) | `ak_partner_granja_hogar_001` |
| Nodo Campus Reforestado | Area Campus Reforestado (Campus Reforestado) | `ak_partner_campus_reforestado_001` |

### Demo legado (marcado con prefijo `DEMO -`)

| Nombre Nodo | Área Asignada (Predio) | API Key (legado, no autentica) |
|-------------|------------------------|---------|
| Nodo DEMO - Prueba E2E | DEMO - Área 2 (DEMO - Rancho Norte) | `ak_b2727bc1d95e342932612ee5573fdb18` |
| Nodo DEMO - Nogal Norte | DEMO - Nogal Norte (DEMO - Rancho Norte) | `99189486-8181-4e8c-8c6d-b3da66e6712b` |
| Nodo DEMO - Alfalfa Este | DEMO - Alfalfa Este (DEMO - Rancho Norte) | `c1f5cd79-e760-4a9f-92ea-31ea685a3add` |
| Nodo DEMO - Chile Principal | DEMO - Chile Principal (DEMO - Rancho Norte) | `02b21674-0099-4470-a8dd-b4ebd7d8c2b0` |

> **Nota para el simulador:** Usa la credencial de gateway del predio (`--gateway-key` / `SIM_GATEWAY_KEY`) y el ID de nodo lógico (`--logical-node-id`, repetible una vez por nodo; la variable `SIMULATOR_LOGICAL_NODE_ID` acepta un solo ID). Las keys `ak_partner_*` y las demo son legado: no envían telemetría.

---

## 🧪 Laboratorio de integración (estado 2026-10-08)

Estado vivo del laboratorio. El detalle narrativo está en [`integration/README.md`](integration/README.md)
y, para el dispositivo, en Agro.io `docs/integration/v2-release-line.md`.

| Pieza | Dónde | Notas |
|---|---|---|
| Cloud (API + dashboard) | `http://10.32.81.230:3022` | Dokploy, compose `iot-sensors`; pairing **encendido** (`GATEWAY_PAIRING_ENABLED=true`, base de verificación por IP:puerto) |
| Raspberry (gateway real) | `10.32.90.229` (`agroio@`) | release `2.0.0-alpha.8`, `mode: demo` con `demo_nodes: 0` (demo silencioso), gateway 7 / predio **Raspberry Campo** |
| Pantalla del appliance (visor) | `http://10.32.90.229:6080/vnc.html` | Xvfb + noVNC sobre la BD viva; **reiniciar `agroio-ui-webviewer` después de instalar una release**, o la pantalla muestra el build anterior |
| Receptor de referencia | `http://10.32.81.230:8090/` | stand-in del backend del cliente para `http_sync` |
| Fuente de demo | contenedor `iot-demo-simulator` en el servidor | ver abajo |

Ranuras publicadas en la gateway 7 (todas `confirmed`): área 11 `parcela-pi` (nodo lógico 11),
área 13 `DEMO02` (13) y área 14 `Nogal Norte` (14). Las lecturas de demo entran por esas tres.

### Fuente de demo (simulador)

`iot-demo-simulator` corre `simulator_fast.py` en un contenedor y alimenta las tres ranuras con
los **12 campos** (incluye flujo y ETO, que el modo demo del equipo deja en `null`). La credencial
es la del gateway del equipo y se lee de ahí, nunca de un archivo del repo:

```bash
docker logs --tail 3 iot-demo-simulator     # actividad / progreso del backfill
docker stop iot-demo-simulator              # pausar (los datos quedan)
docker start iot-demo-simulator             # reanudar
docker rm -f iot-demo-simulator             # retirar del todo

# relanzar con otra cadencia (10 s = más vistoso; 60 s = más tranquilo):
export GW="$(ssh agroio@10.32.90.229 'cat /etc/agroio/secrets/gateway-credential')"
docker run -d --name iot-demo-simulator --restart unless-stopped --network host \
  -e SIMULATOR_GATEWAY_KEY="$GW" -e PYTHONUNBUFFERED=1 \
  -v "$PWD/simulator:/app" -w /app python:3.13-slim \
  python simulator_fast.py --base-url http://10.32.81.230:3022/api/v1 \
  --logical-node-id 11 --logical-node-id 13 --logical-node-id 14 \
  --backfill 0 --interval 30 --seed 20261008
```

El `--backfill` es solo para el primer arranque: el simulador genera `X-Event-ID` con `uuid4`, así que
repetir `--backfill 30` en un relanzamiento re-postea 30 días como filas nuevas (duplicados, no
idempotentes). Para relanzar el contenedor (incluido un reinicio con `--restart unless-stopped`) usar
siempre `--backfill 0`.

Tres cosas aprendidas al montarlo: `--network host` es **obligatorio** (un contenedor en bridge no
alcanza `10.32.81.230:3022` en esta red: timeouts); sin `PYTHONUNBUFFERED=1` el progreso y los
errores quedan invisibles en `docker logs`; y a 30 s por tres nodos son ~8.6k lecturas/día, así que
se para cuando no se está mostrando.

### Guion corto de demo

1. Cliente `alan2203mx@gmail.com` / `123` → **Raspberry Campo** → área con humedad, **flujo** y **ETO** + indicador de frescura.
2. Histórico con filtros (semana/mes) → **export** CSV/XLSX/PDF.
3. NDVI del widget (último punto Sentinel-2 con escena y nubosidad reales).
4. Admin `admin@sensores.com` / `admin123` → `/admin/gateways` (estado/heartbeat, publicar config, referencia legible) y `/admin/gateways/pair`.
5. Pantalla del appliance por el visor: gateway activa, nodos detectados, ranuras y el paso de pairing con QR y código.
