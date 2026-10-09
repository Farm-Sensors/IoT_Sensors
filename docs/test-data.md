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

## 🧪 Laboratorio de integración (estado 2026-10-09)

Estado vivo del laboratorio. El detalle narrativo está en [`integration/README.md`](integration/README.md)
y, para el dispositivo, en Agro.io `docs/integration/v2-release-line.md`.

| Pieza | Dónde | Notas |
|---|---|---|
| Cloud (API + dashboard) | `http://10.32.81.230:3022` | Dokploy, compose `iot-sensors`; pairing **encendido** (`GATEWAY_PAIRING_ENABLED=true`, base de verificación por IP:puerto) y clima de referencia encendido con la API gratuita (`OPEN_METEO_ENABLED=true`, base URL `https://api.open-meteo.com` sin clave) |
| Raspberry (gateway real) | `10.32.90.229` (`agroio@`) | release `2.0.0-alpha.13`, `mode: demo` con `demo_nodes: 4`; **sin gateway vinculado** (lista para la demo desde cero: su histórico local se conserva). Ensayo E2E del 2026-10-09 verificado de punta a punta con gateway 17 / predio 17 |
| Pantalla del appliance (visor) | `http://10.32.90.229:6080/vnc.html` | Xvfb + noVNC sobre la BD viva; **reiniciar `agroio-ui-webviewer` después de instalar una release**, o la pantalla muestra el build anterior |
| Receptor de referencia | `http://10.32.81.230:8090/` | stand-in del backend del cliente para `http_sync` |
| Fuente de demo | contenedor `iot-demo-simulator` en el servidor | ver abajo |

### Ubicación de referencia y tarjetas del dashboard (estado 2026-10-09)

- **Ubicación de referencia del predio**: la captura el técnico en la pantalla del equipo (*Ubicación*) y Agro la reporta al cloud con la operación v2 `location` (revisión 4 del contrato) en el mismo ciclo del latido; el cloud la guarda en `predios.latitud/longitud` y el detalle del predio la muestra. Es la que alimenta el clima de referencia; el GPS del nodo ya no hace falta.
- **Clima de referencia**: la tarjeta del dashboard pide Open-Meteo por la ubicación del predio (API gratuita). Con `OPEN_METEO_ENABLED=false` la tarjeta se oculta; sin ubicación en el predio responde 409 y la tarjeta explica que falta (la reporta el equipo).
- **Tarjetas configurables por cliente**: el admin elige en *Clientes → (cliente) → Dashboard* qué tarjetas ve ese cliente (8 claves: 3 prioritarias, riego, suelo, gráfica, ambiental y fuentes externas). Sin configurar, el dashboard muestra **solo las tarjetas cuyos datos existen** en la última lectura (es el estado por defecto del laboratorio).

Historial de la Pi: gateway 7 / predio 8 (`Raspberry Campo`, 3 ranuras) → gateway 10 / predio 11
(`Rancho Prueba`, 4 ranuras) → gateway 11 / predio 12 (`Rancho Nuevo`, 4 ranuras) → gateway 12 /
predio 13 (`Rancho del Valle`, 4 ranuras, 9/10). Los predios anteriores conservan sus datos; el
contenedor de demo sigue alimentando las 3 áreas del predio 8 con la credencial de gateway 7
(nunca revocada). El panel admin (`/admin/gateways`) guía el enlace en 4 pasos y la lista muestra
"Rancho · Cliente" con el estado en palabras.

### Ensayo E2E 2026-10-09 (cliente/predio/gateway nuevos)

Corrida completa verificada en el laboratorio con un rancho nuevo:

| Pieza | Valor |
|---|---|
| Cliente | `rancho.demo@test.com` / `prueba123` (`Rancho Demostración`, cliente 9) |
| Predio / áreas | predio 17 · `Parcela Nogal` (38), `Parcela Alfalfa` (39), `Parcela Manzana` (40), `Parcela Maíz` (41), nodos 41–44 con series `DEMO-01..04` |
| Gateway | 17 (4 ranuras 35–38, configuración v1) — las 4 quedaron `confirmed` con `bound_uid` `mesh-DEMO01..04` |
| Evidencia | telemetría fresca en las 4 áreas (suelo; riego/ambiente `null` en modo demo), heartbeat `connected`, `outbox_v2` confirmando, dashboard del cliente con humedad y «hace un momento» |

El equipo quedó **desvinculado** al terminar (identidad y caché v2 limpias) para poder demostrar el enlace en vivo; el rancho del ensayo sigue en el cloud con sus datos y su gateway activo (se puede reutilizar: al aprobar de nuevo ese gateway la pantalla avisa «reemplaza credencial» y las ranuras ya están confirmadas).

**Ojo con la serie de los nodos al dar de alta:** `nodos.numero_serie` es único en el cloud y `mesh-DEMO01..04` ya están registradas por ranchos anteriores. En el alta de un rancho nuevo usa otra serie (p. ej. `DEMO-01`) o déjala vacía: la identidad del vínculo viene del UID que reporta el equipo, no del campo serie (un duplicado ahora responde **409** con el mensaje del serial).

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

8. **Configura las tarjetas del cliente** (ventana B, admin): *Clientes → (el cliente nuevo) → Dashboard* → marcar las tarjetas que debe ver (p. ej. Humedad del Suelo, Suelo, Gráfica de humedad, Fuentes externas) → *Guardar*. Entrando como ese cliente, el dashboard muestra **exactamente** esas. Si se deja **sin configurar** (estado por defecto), muestra solo las tarjetas con datos: en modo demo el equipo entrega suelo, así que Humedad/Suelo/Gráfica aparecen y Flujo/E.T.O./Ambiental no. La tarjeta *Clima de referencia* aparece cuando el predio ya tiene ubicación (la reportó el equipo al vincularse).

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
6. Tarjetas configurables: admin → *Clientes → (cliente) → Dashboard* → guardar una selección y verla como cliente; dejarla sin configurar para el modo automático (solo lo que tiene datos).
7. Ubicación y clima: el predio del equipo (Rancho del Valle) ya tiene la ubicación que reportó la Raspberry; la tarjeta *Clima de referencia* del dashboard la usa. Para verlo en otro predio, capturar el punto en la pantalla del equipo (*Ubicación*) y esperar el siguiente latido.
