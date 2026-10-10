# Datos de Prueba (estado limpio — 2026-10-10)

El sistema quedó **vacío a propósito** para empezar a probar desde cero. Solo existe lo
que sigue; nada de ranchos, nodos ni lecturas en el cloud.

## 👥 Usuarios

### Administrador
- **Login:** `admin@sensores.com`
- **Password:** `admin123`

### Clientes (usuarios finales)
- **Login:** `alan2203mx@gmail.com` · **Password:** `123` — cliente de prueba (empresa "Agricola del Norte"), **sin predios**.
- **Login:** `test@gmail.com` · **Password:** `123` — cliente de prueba (empresa "Test"), **sin predios**.

Ambos entran a un dashboard vacío: no hay predios, áreas, nodos ni lecturas.

## 🗄️ Qué conserva la base del cloud

- Catálogos administrables: `tipos_cultivo` (**Nogal, Alfalfa, Manzana, Maíz, Chile, Algodón**) y `perfiles_hardware` (3 perfiles).
- Nada más: se borraron clientes, predios, áreas, nodos, lecturas, gateways, ranuras, vínculos,
  configuraciones publicadas, referencias de activación, sesiones de emparejamiento, snapshots NDVI,
  preferencias y tokens.

## 🍓 Raspberry de pruebas (`10.32.90.229`, `agroio@`)

- Release **`2.0.0-alpha.13`**, **sin gateway vinculado**: la pantalla está en *Instalación → Paso 1* con el botón **"Vincular dispositivo"** (lista para emparejar cuando quieras).
- Modo **demo silencioso** (`demo_nodes: 0`): no fabrica datos; el carril v2 sigue vivo (latido y consulta de configuración) para cuando la vincules.
- **Se conserva el histórico del sensor real**: equipos `H4EBF` y `H845D` (puerto `/dev/serial/by-id/usb-Arduino_CatWan_USBStick2040_613863E6332233A3-if00`) con **50 970 mediciones** (8 jul → 15 sep 2026), **8 495 lecturas crudas** y **16 512 alertas**. Los 4 nodos demo (`DEMO01..04`) y sus datos se eliminaron.
- Configuración (`/etc/agroio/agent.json`) intacta: puerto serie, umbrales (humedad < 20, temperatura > 35), `http_sync` al receptor del laboratorio y `cloud_lane: v2`. Respaldos automáticos de config en `/etc/agroio/backups/`.
- Volver a leer el sensor físico: `sudo -n /opt/agroio/current/ops/scripts/agroio-config.sh --set-mode serial` y después `... agroio-service-control.sh --restart-edge`.

## 🧪 Laboratorio (servidor)

- **Simulador de demo**: el contenedor `iot-demo-simulator` está **detenido** (no se eliminó). `docker start iot-demo-simulator` lo reanuda y `docker stop iot-demo-simulator` lo pausa; alimenta un predio del cloud con lecturas simuladas.
- **Receptor de referencia** para `http_sync`: contenedor `agro-telemetry` en `http://10.32.81.230:8090/` (sigue corriendo).
- **Recargar datos de prueba completos** (jerarquía, lecturas y umbrales): `app.db.seed` y `app.db.demo_seed run-all` (ver [`operations.md`](operations.md)). Recrea `admin@sensores.com`, `alan2203mx@gmail.com` y `jlopez@test.com` con los predios demo y las estructuras del socio formador (`Granja Hogar`, `Campus Reforestado`).

## 🧷 Guion corto para probar desde cero

1. Entra como admin → *Clientes → Nuevo Cliente* → *Predios → Nuevo Predio* → *Áreas de Riego* → *Nodos → Nuevo Nodo IoT*.
   Al registrar nodos, usa series que no existan (p. ej. `DEMO-01`): `numero_serie` es único y un duplicado responde **409**.
2. *Gateways* → paso 1: elige el rancho y marca sus parcelas → *Crear enlace* → paso 2: *Publicar configuración*.
3. En la pantalla del equipo: *Instalación → Paso 1* → **Vincular dispositivo** → copia el código (`XXXX-XXXX`) → en el panel, *Gateways* → paso 3: escribe el código, elige el gateway pendiente, confirma y **Aprobar emparejamiento**.
4. En la pantalla, pasos 2–4: asigna cada nodo a su ranura (los chips muestran el nombre de la parcela) y **Confirmar asignaciones**.
5. Verifica: *Gateways* → paso 4 (parcelas reportando y última lectura) y, como el cliente, el dashboard con humedad, frescura y "Gateway conectado".

## 🧾 Respaldos de la limpieza (2026-10-10 21:44 UTC)

- Cloud: `~/backups/cloud-sensores_riego-20261010_214434.sql`
- Raspberry: `~/backups/rpi-app-20261010_214434.db` (base local completa) y `~/backups/rpi-agent-20261010_214434.json` (configuración)
