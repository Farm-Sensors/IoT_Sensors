# Estado de los sistemas (2026-10-11)

Foto del estado real de IoT_Sensors, Agro.io y su integración: qué está hecho, qué está en
verificación y qué falta pulir. Es un documento vivo: se actualiza cuando cambia algo (ver la regla
de documentación en `AGENTS.md`). Para el "cómo funciona" ver [`system.md`](system.md); para el
laboratorio y credenciales, [`test-data.md`](test-data.md); para las puertas de la integración,
[`integration/README.md`](integration/README.md).

## Resumen

IoT_Sensors está en MVP estable con el laboratorio **purga intencional** (solo admin y dos clientes de
prueba); Agro corre la **línea beta** en la Raspberry con el carril v2 listo y canales stable/beta
operativos; la integración **está verificada de punta a punta** (pairing por QR, bindings, telemetría,
dashboard del cliente). Lo que falta es deuda de **proceso y porteo**, no de funcionamiento.

## IoT_Sensors (cloud)

- **Repo**: `main` al día (`cec8e97`), árbol limpio, sin PRs abiertos. Desplegado en Dokploy
  (compose `iot-sensors`), auto-deploy por push.
- **Alcance**: MVP completo (ingesta, usuarios, jerarquía cliente→predio→área→nodo, dashboard,
  histórico, exportación CSV/XLSX/PDF). Fase 2 **dormida tras flags** (alertas, notificaciones, IA),
  con dos excepciones aprobadas y documentadas: NDVI de último punto y tarjeta de clima de referencia
  (`OPEN_METEO_ENABLED=true` con la API gratuita).
- **Contrato v2**: paquete en **revisión 4** (operación `location`; revisiones 2–4 son adiciones
  nuestras). El marcador "accepted upstream" del paquete sigue en la **revisión 1**: la aceptación
  formal de las revisiones nuevas está **pendiente**.
- **Laboratorio** (`http://10.32.81.230:3022`, sano): base **purgada a propósito** — solo
  `admin@sensores.com`, `alan2203mx@gmail.com` y `test@gmail.com`, más los catálogos
  (`tipos_cultivo` 6, `perfiles_hardware` 3). Cero predios, áreas, nodos, lecturas, gateways y NDVI.
- **Flags encendidos en el laboratorio** (solo lab): `GATEWAY_PAIRING_ENABLED=true`,
  `OPEN_METEO_ENABLED=true`. El resto de Fase 2 en `false`.

## Agro.io (appliance)

- **Repos**: `Agro.io` (`main`) y `Agro.io-v2` (`integration/iot-v2` en `c241a15`), ambos al día y
  limpios. **PR #21** (canales stable/beta) mergeado a la línea v2; sin PRs ni issues abiertos.
- **La Raspberry** (`10.32.90.229`, `agroio@`): release **`2.0.0-alpha.24`**, **canal beta**,
  `mode: serial`, `cloud_lane: v2` → cloud del laboratorio, `http_sync` apagado, visor noVNC
  encendido, **sin gateway vinculado** (pantalla en *Instalación → Paso 1*).
- **Datos reales conservados**: `H845D` y `H4EBF` con ~50 970 mediciones (el último dato real es del
  **15 sep 2026**); `discovery_evidence` vacía porque **ningún nodo está transmitiendo** ahora.
- **Canales stable/beta**: operativos con un comando (`/opt/agroio/channel/agroio-channel.sh`), con
  perfiles guardados por canal y guardianes automáticos en la línea (migraciones/esquema/claves).
- **Restos menores**: `demo-node-01` inactivo (de un arranque en modo demo), paquetes locales
  acumulados en `/opt/agroio/packages` y `artifacts/`, unidad `agroio-telemetry-receiver` en disco
  pero deshabilitada.

## Integración (flujo end-to-end)

- **Verificado** (2026-10-09/10): alta de rancho en el cloud → gateway de 4 ranuras → publicación de
  configuración → **pairing por QR** desde la pantalla del equipo → aprobación en el panel admin →
  4 ranuras `confirmed` con `bound_uid` real → telemetría fresca en las 4 áreas → dashboard del
  cliente con humedad, frescura y "Gateway conectado". Evidencia en `test-data.md` y en memoria.
- **Hoy**: el cloud quedó limpio, así que el carril v2 del equipo está configurado pero **sin rancho
  destino** (identidad vacía). Para repetir el flujo hay que crear un rancho nuevo (o re-sembrar con
  `app.db.seed` + `app.db.demo_seed run-all`).

## Qué falta / pulir

1. **Aceptación del contrato revisión 4** (gobernanza en IoT_Sensors; hoy el marcador sigue en la 1).
2. **Portar los canales stable/beta a `main`** (5 archivos, listados en
   `release-channels.md` del repo Agro): así el equipo cambia de canal sin depender de la ruta neutral.
3. Decidir si las pantallas **Instalación** y **Actualización** (hoy solo en la línea beta) van a
   producción.
4. **Validar con hardware real**: encender los nodos para que aparezcan en *Instalación → Paso 2* y
   fluyan sus lecturas (o ensayar con `mode: demo`).
5. **Mapeo NDVI por nodo** (hoy se configura a mano en `agent.json`).
6. **`http_sync` al backend del cliente** (endpoint + habilitar; hoy apagado).
7. **Limpieza menor**: `demo-node-01`, paquetes acumulados, unidad del receptor.
8. **Consistencia de idioma** en la documentación de Agro (inglés) frente a IoT_Sensors (español).

## Dónde está todo (para retomar en un chat nuevo)

- **Docs IoT_Sensors**: `docs/system.md` (fuente de verdad del flujo), `api.md`, `data-model.md`,
  `operations.md`, `deployment.md`, `test-data.md` (laboratorio y credenciales), `status.md` (este
  archivo), `AGENTS.md` (contexto + regla de documentación/memoria), `contracts/edge-cloud/v2/README.md`.
- **Docs Agro.io**: `docs/integration/README.md` (puertas de aceptación), `iot-sensors.md`,
  `v2-release-line.md`, `release-channels.md`, `assigned-scope.md`, `gateway-v2-cutover-runbook.md`,
  `configuration-ui.md`, `AGENTS.md`.
- **Memoria (Engram)**: contrato rev 4; ubicación de referencia + clima por predio; tarjetas de
  dashboard configurables; ensayo E2E del rancho nuevo; canales + guardianes + normalizador; regla de
  documentación; estado del laboratorio (topic `agro-io/lab-state`).
