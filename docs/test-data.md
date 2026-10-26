# Datos de Prueba (verificado 2026-10-26)

El sistema parte de una base limpia (2026-10-10) y hoy tiene **un rancho de prueba activo**,
alimentado por la Raspberry de pruebas con un radio virtual (ver abajo).

## 👥 Usuarios

### Administrador
- **Login:** `admin@sensores.com`
- **Password:** `admin123`

### Clientes (usuarios finales)
- **Login:** `alan2203mx@gmail.com` · **Password:** `123` — cliente de prueba (empresa "Agricola del Norte"), **sin predios**.
- **Login:** `test@gmail.com` · **Password:** `123` — cliente de prueba (empresa "Test") con el predio **"Rancho Prueba Radio Virtual"** → área "Parcela Nogal Norte" (Nogal, 2.5 ha) → nodo "Torre Nogal Norte" (serie `RPL01-LAB`), gateway **21** vinculada a la Raspberry. Su dashboard muestra lecturas cada 10 min, frescura, "Gateway conectado" y el clima de referencia.

`alan2203mx@gmail.com` entra a un dashboard vacío.

## 🗄️ Qué conserva la base del cloud

- Catálogos administrables: `tipos_cultivo` (**Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón**) y `perfiles_hardware` (3 perfiles).
- Nada más activo: se borraron clientes, predios, áreas, nodos, lecturas, gateways, ranuras, vínculos,
  configuraciones publicadas, referencias de activación, sesiones de emparejamiento, snapshots NDVI,
  preferencias y tokens.
- Residuo del E2E con tramas reales del 2026-10-26 (no visible en ninguna pantalla): la **gateway 20
  revocada** y el predio 19 "E2E tramas reales (temporal)" con sus áreas 47/48 y nodos 45/46
  **eliminados** (borrado lógico), que conservan 30 lecturas de `H845D` en la base.

## 🍓 Raspberry de pruebas (`10.32.90.229`, `agroio@`)

- Corre el **canal beta** de Agro (**`2.0.0-alpha.27`**, rama `feat/install-screen-clarity`, PRs #22 y #23), **vinculada a la gateway 21** (propiedad 20) desde *Instalación*, con la ranura 43 confirmada para `mesh-RPL01`. Lee un **radio virtual** (`/opt/agroio/data/vradio`, herramienta `ops/dev/virtual-radio/vradio.py` de Agro) que reproduce tramas reales de `H845D` renombradas a `RPL01`, una cada 10 min; corre a mano, así que un reinicio lo detiene y el agente vuelve al stick USB. Para detenerlo antes: `pkill -f "^python3 vradio.py"` y `sudo -n /opt/agroio/current/ops/scripts/agroio-config.sh --set-serial-port /dev/serial/by-id/usb-Arduino_CatWan_USBStick2040_613863E6330B3FA3-if00` + `agroio-service-control.sh --restart-edge`. Para volver a estable: `sudo /opt/agroio/channel/agroio-channel.sh --switch stable` (instala el paquete local `0.9.5`; en estable la gateway se calla).
- **Canales stable/beta**: el equipo puede cambiar de release en un comando
  (`sudo /opt/agroio/channel/agroio-channel.sh --switch beta|stable`). Cambiar de canal guarda y
  aplica la configuración de cada uno (perfiles en `/etc/agroio/profiles/`) y enciende/apaga el visor
  noVNC: en estable queda apagado (interfaz más ligera) y en beta encendido — **hoy está encendido**. Detalles en el repo
  Agro.io, rama `integration/iot-v2`: `docs/integration/release-channels.md`. Hay paquetes de ambos
  canales en `/opt/agroio/packages/`.
- `demo_nodes: 0`: aunque se cambie a `mode: demo`, no fabrica datos. Hoy el agente está en `mode: serial` leyendo el radio virtual; el nodo `RPL01` quedó registrado localmente como no autorizado y sin mediciones, así que el histórico real no se toca.
- **Se conserva el histórico del sensor real**: equipos `H4EBF` y `H845D` (puerto `/dev/serial/by-id/usb-Arduino_CatWan_USBStick2040_613863E6332233A3-if00`) con **50 972 mediciones** (8 jul → 15 sep 2026), **8 497 lecturas crudas** y **16 512 alertas**. Los 4 nodos demo (`DEMO01..04`) y sus datos se eliminaron. `demo-node-01` sigue como fila inactiva; `C0` se escuchó el 20 oct pero no está habilitado (`is_allowed=0`) y no tiene lecturas.
- Configuración (`/etc/agroio/agent.json`): umbrales (humedad < 20, temperatura > 35), `cloud_lane: v2`, `http_sync` **apagado** y `serial.port` apuntando al radio virtual (`/opt/agroio/data/vradio`). Respaldos automáticos de config en `/etc/agroio/backups/` (el previo a este cambio: `agent.20261026_090539.json`).
- **Modo del agente**: hoy `serial` (lee el radio y los nodos reales). Se cambia desde la pantalla
  (*Ajustes → "Configuración real del agente" → Modo*) o con
  `sudo -n /opt/agroio/current/ops/scripts/agroio-config.sh --set-mode serial|demo`.
- Unidades de laboratorio: `agroio-ui-webviewer` está **habilitada y activa** (visor noVNC);
  `agroio-telemetry-receiver` queda en disco pero **deshabilitada**. El receptor del laboratorio que
  sí corre es el contenedor `agro-telemetry` del servidor, no esa unidad.

## 🧪 Laboratorio (servidor)

- **Simulador de demo**: el contenedor `iot-demo-simulator` está **detenido** (no se eliminó). `docker start iot-demo-simulator` lo reanuda y `docker stop iot-demo-simulator` lo pausa; alimenta un predio del cloud con lecturas simuladas.
- **Receptor de referencia** para `http_sync`: contenedor `agro-telemetry` en `http://10.32.81.230:8090/` (sigue corriendo).
- **Recargar datos de prueba completos** (jerarquía, lecturas y umbrales): `app.db.seed` y `app.db.demo_seed run-all` (ver [`operations.md`](operations.md)). Recrea `admin@sensores.com`, `alan2203mx@gmail.com` y `jlopez@test.com` con los predios demo y las estructuras del socio formador (`Granja Hogar`, `Campus Reforestado`).

## 🧷 Guion corto para probar desde cero

1. Entra como admin → *Clientes → Nuevo Cliente* → *Predios → Nuevo Predio* → *Áreas de Riego*. No hace falta registrar nodos: el enlace los crea.
2. *Equipos* → paso 1: elige el rancho y marca sus áreas de riego → *Crear enlace* (crea el nodo de cada área que no lo tenga, restaura el que se haya eliminado y deja lista la configuración).
3. En la pantalla del equipo: *Instalación → Paso 1 · Vincular el equipo con la nube* → **Vincular equipo** → copia el código (`XXXX-XXXX`) → en el panel, *Equipos* → paso 2: escribe el código, elige el rancho, confirma y **Aprobar emparejamiento**.
4. En la pantalla: *Paso 2 · Nodos que están transmitiendo* → *Paso 3 · Elegir el área de cada nodo* → *Paso 4 · Enviar y confirmar* → **Enviar asignaciones**.
5. Verifica: *Equipos* → paso 3 (áreas reportando y última lectura) y, como el cliente, el dashboard con humedad, frescura y "Equipo conectado".

## 🧾 Respaldos de la limpieza (2026-10-10 21:44 UTC)

- Cloud: `~/backups/cloud-sensores_riego-20261010_214434.sql`
- Raspberry: `~/backups/rpi-app-20261010_214434.db` (base local completa) y `~/backups/rpi-agent-20261010_214434.json` (configuración)
