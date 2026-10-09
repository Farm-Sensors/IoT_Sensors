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
| Raspberry (gateway real) | `10.32.90.229` (`agroio@`) | release `2.0.0-alpha.12`, `mode: demo` con `demo_nodes: 4`, gateway 12 / predio **Rancho del Valle** (parcelas 24–27 `Nogal Alto/Alfalfa Baja/Manzana Loma/Maíz Llano`, nodos `mesh-DEMO01..04`) |
| Pantalla del appliance (visor) | `http://10.32.90.229:6080/vnc.html` | Xvfb + noVNC sobre la BD viva; **reiniciar `agroio-ui-webviewer` después de instalar una release**, o la pantalla muestra el build anterior |
| Receptor de referencia | `http://10.32.81.230:8090/` | stand-in del backend del cliente para `http_sync` |
| Fuente de demo | contenedor `iot-demo-simulator` en el servidor | ver abajo |

Historial de la Pi: gateway 7 / predio 8 (`Raspberry Campo`, 3 ranuras) → gateway 10 / predio 11
(`Rancho Prueba`, 4 ranuras) → gateway 11 / predio 12 (`Rancho Nuevo`, 4 ranuras) → gateway 12 /
predio 13 (`Rancho del Valle`, 4 ranuras, 9/10). Los predios anteriores conservan sus datos; el
contenedor de demo sigue alimentando las 3 áreas del predio 8 con la credencial de gateway 7
(nunca revocada). El panel admin (`/admin/gateways`) guía el enlace en 4 pasos y la lista muestra
"Rancho · Cliente" con el estado en palabras.

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

### Demo desde cero (instalación → vinculación → datos)

Guion para hacerlo **todo a mano por interfaz** (nada de comandos), como si la Raspberry se acabara
de instalar. Estado de partida que deja el laboratorio listo: la Pi **sin gateway vinculado** (su
histórico local se conserva) y con 4 nodos demo activos; el cloud con el pairing encendido.

Ventanas: **(A)** pantalla del equipo `http://10.32.90.229:6080/vnc.html` · **(B)** IoT_Sensors
`http://10.32.81.230:3022`.

1. **El equipo ya está instalado y configurado** (pantalla A): menú *Nodos* → los 4 nodos
   detectados con sus sensores; menú *Lecturas* → las mediciones que va tomando; menú *Ajustes* →
   *Configuración real del agente* → modo `demo`, `4` nodos demo, conexión `v2` y la dirección del
   cloud (se edita y se guarda ahí mismo; el reinicio del agente está en la misma sección).
2. **La pantalla pide vincularse**: *Instalación → Paso 1 → «Vincular dispositivo»* → aparece el
   **QR + código** con cuenta atrás de 10 min. Dejarlo ahí.
3. **Alta del rancho** (ventana B, `admin@sensores.com` / `admin123`): *Clientes → Nuevo Cliente*
   (empresa, contacto, email, contraseña, teléfono) → *Predios → Nuevo Predio* → *Áreas de Riego →
   Nueva Área* (nombre, cultivo, tamaño) una por parcela → *Nodos → Nuevo Nodo* (área, nombre,
   serie, GPS) uno por parcela.
4. **Crear el enlace**: *Gateways* → paso 1 (elegir el rancho por nombre y marcar sus parcelas →
   «Crear enlace») → paso 2 («Publicar configuración»). Si el asistente abre otro enlace en curso,
   «Crear otro enlace» vuelve al paso 1.
5. **Vincular**: *Gateways* → paso 3 → escribir el **código** del equipo → «Buscar código» → el
   gateway del rancho viene preseleccionado → casilla de confirmación → «Aprobar emparejamiento».
   En ~1 min la pantalla pasa a *Gateway activada* y el equipo recibe su configuración.
6. **Enlazar los nodos** (pantalla A): *Instalación → Paso 2* (nodos detectados) → *Paso 3*: tocar
   la ranura de cada nodo (se muestran **los nombres de las parcelas**) → *Paso 4*: «Confirmar
   asignaciones». En ~1 min el equipo envía la candidatura y la confirmación.
7. **Ver los datos**: ventana B → *Gateways* → paso 4 (cada parcela con su nodo y «última lectura:
   ahora»; «Ver detalle completo» muestra los 4 pasos en *Listo*). Y como cliente: entrar con el
   email/contraseña del cliente nuevo → predio → parcela → humedad, «hace un momento» y «Gateway
   conectado»; el *Histórico* y el export CSV/XLSX/PDF quedan disponibles.

Notas: el código caduca en 10 min (en la pantalla «Reintentar»); la pantalla se duerme sola (un
toque la despierta); el equipo toma datos cada 10 s, consulta configuración cada 60 s y late cada
5 min; los datos son simulados por el equipo (modo demo: suelo sí, riego y ambiente quedan «Sin
datos»); los semáforos dicen «Sin datos de umbral» porque no hay umbrales configurados (Fase 2);
el NDVI de parcelas nuevas aparece si se repunta el mapeo del equipo (`--set-ndvi-area`).

### Demo rápida (datos ya cargados)

1. Cliente `alan2203mx@gmail.com` / `123` → **Raspberry Campo** → área con humedad, **flujo** y **ETO** + indicador de frescura.
2. Histórico con filtros (semana/mes) → **export** CSV/XLSX/PDF.
3. NDVI del widget (último punto Sentinel-2 con escena y nubosidad reales).
4. Admin `admin@sensores.com` / `admin123` → `/admin/gateways` (asistente de enlace) y `/admin/gateways/pair`.
5. Pantalla del appliance por el visor: gateway activa, nodos detectados, ranuras y el paso de pairing con QR y código.
