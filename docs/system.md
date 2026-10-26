# Cómo funciona el sistema (fuente de verdad)

Este documento describe el sistema **tal como está en `main`**. Si un diagrama antiguo o un SRS de `docs/deliverables/` contradice esto, gana este archivo.

Contrato de máquina: [`contracts/edge-cloud/v2/`](../contracts/edge-cloud/v2/).  
Comportamiento detallado: `openspec/changes/archive/2026-10-08-edge-cloud-gateway-provisioning/` (cerrado el 2026-10-08) y `openspec/specs/`.

## Qué es cada pieza

| Pieza | Rol |
|---|---|
| **Agro.io** | Appliance en cada Raspberry Pi: radio/sensores, SQLite, pantalla local, envío HTTPS |
| **IoT_Sensors** | Core cloud: usuarios, jerarquía agrícola, histórico, dashboard, exportación |
| **Predio** | Un rancho. **Una Raspberry / un gateway por predio** |
| **Área de riego** | Zona dentro del predio. **Un nodo lógico por área** |
| **Nodo IoT** | Punto de monitoreo del área (la “torre”), no la Raspberry |
| **Gateway** | La Raspberry autenticada ante el core |

```text
Sensores LoRa → Raspberry Agro.io → HTTPS (contrato v2) → IoT_Sensors → MySQL / dashboard
```

Agro.io **no** se despliega en la VPS. El cloud no habla LoRa.

## Jerarquía cloud

```text
Cliente
  └── Predio (1 gateway)
        └── Área de riego (1 cultivo + 1 nodo lógico)
              └── Lecturas cada 10 min (12 campos)
```

GPS, cultivo y tamaño **no** van en cada lectura. NDVI **no** es un campo 13: es `POST /api/v1/ndvi-snapshots`.

## Instalación de un rancho

1. Un **administrador** prepara en IoT_Sensors cliente, predio y áreas (puede usar plantillas globales) y en *Equipos* elige el predio y sus áreas de riego → **Crear enlace**. Esa sola operación crea el **nodo lógico** de cada área que aún no lo tiene ("Nodo <área>") y restaura el que se haya eliminado (mismo id, conserva sus lecturas), **aprovisiona el gateway** del predio (queda `pending_activation`) y **publica su configuración** (versión 1), lista para que el equipo la lea en cuanto se vincule. Registrar nodos a mano en *Nodos* sigue siendo opcional (nombre, GPS). Publicar de nuevo (`POST /gateways/{id}/configuration`) solo hace falta para enlaces creados antes de este cambio.
2. **Emparejamiento (camino principal).** Con `GATEWAY_PAIRING_ENABLED` activa, la Raspberry muestra en su pantalla un **código corto** (`XXXX-XXXX`, 10 min) y un QR; el **administrador** aprueba la sesión desde su móvil o escritorio en IoT_Sensors (`/pair`) contra el gateway ya aprovisionado. El dispositivo obtiene su credencial al consultar el token. La pareja de operaciones de máquina (`pairing-sessions`, `pairing-sessions/token`) es **sin credencial** y está oculta del OpenAPI (`backend/app/api/v1/endpoints/gateway_pairing.py`); toda la superficie vive detrás de la flag, **OFF por defecto**.
3. **Respaldo: referencia de activación.** Igual que antes, un administrador puede emitir un **código/QR de un solo uso, 24 h** (`ar_`) y el **técnico** consumirlo en la Raspberry (pantalla Agro local, con internet al activar) vía `POST /api/v1/gateways/activate`. Sigue siendo válido y no cambia.
4. Agro detecta hardware por **UID/serie inmutable**. El **técnico elige el área/slot**; el core **no infiere el área desde el UID** ni desde ningún código de emparejamiento: aprobar una sesión solo liga la sesión a un gateway ya existente, nunca crea predio, área, nodo ni vínculo.
5. Agro envía candidatos; el **mismo gateway confirma** (sin JWT de usuario).
6. Se permite **activación parcial**: las áreas confirmadas operan; las faltantes quedan pendientes.
7. Un sensor inesperado solo puede proponerse a un **área ya existente**.
8. El histórico cloud de un nodo empieza **al activarse**. La **ubicación de referencia del predio** la captura el técnico en la pantalla del equipo (preferencias de la UI) y Agro la reporta al cloud con `POST /api/v1/gateways/me/location` (revisión 4 del contrato); es la que alimenta el clima de referencia y el mapa. El GPS del nodo sigue siendo opcional; el tamaño de área también.

Si se reemplaza el sensor físico, **se conserva el nodo cloud** y se registra el nuevo UID. Si se reemplaza la Raspberry, es un **gateway nuevo** y se revoca el anterior.

## Autenticación

| Actor | Cómo |
|---|---|
| Admin / Cliente | JWT (`Authorization: Bearer`) |
| Raspberry / simulador | Credencial de **gateway** en `X-API-Key` |

Telemetría además lleva `X-Logical-Node-Id` y `X-Event-ID`.  
Las API keys por nodo **ya no autentican**. Pueden quedar en BD solo como observación.

No hay ventana dual-auth: o gateway, o nada.

## Flujo diario de datos

1. Agro calibra y arma **12 campos** (`soil`, `irrigation`, `environmental`). Lo no medido va `null`; `0` es un cero real. Hoy el mapper de suelo existe; riego/ambiente pueden ir `null`.
2. Si no hay red, Agro **encola** hasta que el core confirme. Datos confirmados se pueden guardar ~30 días en el Pi; si el disco se llena, se protegen los pendientes.
3. `POST /api/v1/readings` → MySQL. Idempotencia: **gateway + nodo lógico + event ID**. Mismo body → `200`; body distinto → `409`.
4. Lecturas tardías se guardan con su **timestamp de captura**. Horas imposibles se marcan sospechosas; no se usan como frescura normal.
5. Si un nodo cambia de área, las lecturas viejas **se quedan** en el área que tenían al capturarse.

Heartbeat cada **5 minutos**: `POST /api/v1/gateways/me/heartbeat`.  
En el mismo ciclo, si el equipo tiene ubicación configurada, la reporta con `POST /api/v1/gateways/me/location` (204); sin ubicación no envía nada.  
Estado de gateway (conectado / retrasado / desconectado / pendiente) es **distinto** de la frescura del nodo.

## Configuración

El core es la fuente de verdad. Agro hace **polling** (`304` si no cambió). Si el core está caído, Agro sigue con la última config válida.

Cambiar un nodo de área se **propone** en el core y se **confirma en campo**.

## Actualizaciones de Agro (v2)

El admin **autoriza** una imagen (versión + digest). El técnico **confirma** en la Raspberry. No hay OTA automática, rollback de flota ni despliegue gradual en esta versión.

## Frontend cloud

- Vocabulario de pantalla (panel, dashboard y pantalla del equipo): la Raspberry con Agro (técnicamente el *gateway*) se llama **equipo** y la zona con un cultivo y un nodo es el **área de riego** (o solo **área**); "gateway" solo aparece en los detalles técnicos de la API.
- Admin: menú **Equipos**, `/admin/gateways` (asistente de tres pasos: 1. elegir el rancho y sus áreas de riego — crea el enlace, los nodos que falten y deja lista la configuración —, 2. vincular el equipo aprobando el código de su pantalla (*Instalación → Paso 1* → «Vincular equipo»), con la referencia de activación como respaldo, y 3. ver los nodos enlazados, que el técnico asigna en la pantalla del equipo (*Pasos 3 y 4* → «Enviar asignaciones»); el enlace en curso queda en la URL, `?gateway=N`, así que recargar o volver no lo pierde) y `/admin/gateways/pair` (aprobar/denegar una sesión de emparejamiento por su código; `/pair` redirige allí). También configura, **por cliente**, qué tarjetas ve ese cliente en su dashboard (`/admin/clientes/{id}/dashboard`).
- Cliente: ve estado simple del equipo ("Equipo conectado", "Equipo retrasado"…) junto a la frescura de datos; su dashboard muestra las tarjetas configuradas y, si no hay configuración, **solo las tarjetas cuyos datos existen**.
- Tarjeta "Clima de referencia": pronóstico Open-Meteo para la **ubicación del predio** (API gratuita sin clave); si el predio aún no tiene ubicación, la tarjeta no se muestra.
- No se muestran secretos ni API keys de nodo.

## Qué queda fuera de este sistema (aún)

- IA, alertas activas, WhatsApp/email, n8n (código puede existir **dormido** detrás de flags; con el flag apagado el menú de admin y cliente oculta su módulo —Umbrales, la campana de alertas y el semáforo del dashboard van con alertas— vía `GET /api/v1/settings/modules`, aunque la ruta directa sigue abriendo). **La Fase 2 está bloqueada hasta nuevo aviso**: no se enciende ninguno de sus flags ni se arranca el perfil `phase2`; las excepciones vigentes aprobadas por el dueño son el NDVI de último punto (evento propio) y la tarjeta de clima de referencia (`OPEN_METEO_ENABLED`, API gratuita, por predio).
- NDVI histórico/polígonos.
- Interfaz móvil para QR/GPS.
- Comandos físicos hacia riego.
- PostgreSQL.

## Estado actual y pendientes (2026-10-26)

Foto de dónde estamos; se actualiza aquí mismo cuando cambia algo. Detalle del laboratorio y
credenciales en `test-data.md`; puertas de la integración en `integration/README.md`.

- **IoT_Sensors (cloud)**: el stack de laboratorio responde en Dokploy. MVP completo; Fase 2 dormida
  tras flags salvo las dos excepciones aprobadas (NDVI de último punto y clima de referencia).
  Contrato v2 en **revisión 4** (operación `location`), **aceptada el 2026-10-26** (commit `f336997`,
  digest `9e964fff…`; registro en `integration/README.md`).
  Laboratorio: admin, `alan2203mx@gmail.com` y `test@gmail.com` + catálogos, sin ranchos activos (el
  rancho de prueba del radio virtual se eliminó y su gateway 21 se revocó para repetir la prueba desde
  cero).
- **Agro (appliance)**: `main` en `6a95681` (tag `0.9.5`, producción, canal **stable**) y
  `integration/iot-v2` (canal **beta**) con `main` 0.9.5 unido y los PRs #22–#26 fusionados. La
  Raspberry de pruebas corre **beta `2.0.0-alpha.30`**, `mode: serial` leyendo un **radio virtual**
  (tramas reales de `H845D` renombradas a `RPL01`, una cada 60 s para pruebas manuales), **sin
  vincular** (lista para el flujo completo desde la pantalla). Su stable es el asset oficial 0.9.5.
  Datos reales conservados (`H845D`, `H4EBF`: 50 972 mediciones); ningún nodo físico transmite
  desde el 15 sep.
- **Integración con sensores reales**: verificada el 2026-10-26 con **tramas reales** del log de la
  Raspberry, reproducidas por el agente `alpha.25` instalado en la propia Raspberry (workspace
  aislado) contra el cloud: pairing por código → detección de `mesh-H845D` y `mesh-H4EBF` → dos
  áreas confirmadas → 30 lecturas `201` con los valores exactos de la trama → ubicación del
  predio → dashboard del cliente (última lectura, prioridades y clima). Antes, 9 346 tramas reales
  pasaron el esquema v2. Las tres correcciones de `alpha.25`: no enviar lecturas sin ningún valor
  (firmware viejo), usar el reloj del agente cuando la trama no trae hora, y calcular la humedad
  ECH-5 con la misma calibración que la pantalla.
- **Canales**: ida y vuelta `beta → stable → beta` verificada dos veces sin pérdida de datos. **Solo
  `beta` integra con IoT_Sensors**: `stable` (0.9.x) no tiene el carril v2, y la línea v2 no se
  fusiona a `main`. Desde `alpha.26` el botón "buscar actualizaciones" ya no ofrece releases de otro
  canal.
- **Flujo de producto completo sin nodo físico** (2026-10-26): con el radio virtual, el servicio
  real del agente, la pantalla *Instalación* del equipo, el panel admin y el dashboard del cliente:
  admin crea predio y área y, en *Equipos*, el enlace (nodo y configuración incluidos) → técnico vincula con el código → `mesh-RPL01`
  aparece detectado → se asigna a su área y la nube confirma → el cliente ve humedad, suelo,
  frescura, "Equipo conectado" y clima. Funciona de punta a punta. Los puntos de usabilidad de ese
  recorrido quedaron corregidos el mismo día: panel en 3 pasos con vocabulario "equipo" / "área de
  riego" (este repo) y pantalla *Instalación* clara en Agro `alpha.29` (PRs #22 y #23), verificada
  en el equipo.

**Pendientes / a pulir**

1. **Política vigente: `main` de Agro no se toca.** Es lo que funciona en producción y meter la
   integración podría romperlo. Todo lo de la integración se desarrolla y se prueba en **beta**
   (`integration/iot-v2`, `2.0.0-alpha.N`) hasta estar seguros de que funciona; cómo llegará después
   a producción se decide más adelante.
2. **Firmware de nodos**: solo el payload compacto (`"s1":…`) llega a la nube; verificar o reflashear
   cada nodo antes de instalarlo. Los nodos solo miden suelo: flujo y ETO llegan `null`.
3. **Endpoint público con HTTPS** para ranchos fuera de la red ITESM (hoy solo `10.32.81.230:3022`
   por HTTP).
4. **Unir `main` de Agro hacia v2** cada vez que `main` publique (la última unión, 0.9.5, se hizo el
   2026-10-26 con el PR #24 de Agro); `main` nunca recibe nada de v2.
5. Validar con **nodos reales encendidos** en campo (alcance de radio, energía, calibración).
6. **Mapeo NDVI por nodo** (hoy se configura a mano); **`http_sync` al backend del cliente** (hoy
   apagado).
7. Limpieza menor: `demo-node-01` inactivo, `C0` no habilitado, paquetes locales acumulados, log del
   agente de 44 MB con "heartbeat not sent" cada 5 s cuando no hay gateway.

## Dónde leer más

| Tema | Dónde |
|---|---|
| Cable HTTP exacto | `contracts/edge-cloud/v2/README.md` |
| Corte / rollback | `docs/integration/gateway-v2-cutover-runbook.md` |
| API de usuarios | `docs/api.md` |
| Tablas | `docs/data-model.md` |
| Integración con Agro: contrato, gates y entorno de desarrollo | `docs/integration/README.md` |
| Credenciales y datos de la demo | `docs/test-data.md` |
| Agro edge: código de la línea v2, despliegue y visor | repo Agro.io, rama `integration/iot-v2` (ver `docs/integration/v2-release-line.md` allí) |
