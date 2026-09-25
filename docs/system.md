# Cómo funciona el sistema (fuente de verdad)

Este documento describe el sistema **tal como está en `main`**. Si un diagrama antiguo o un SRS de `docs/deliverables/` contradice esto, gana este archivo.

Contrato de máquina: [`contracts/edge-cloud/v2/`](../contracts/edge-cloud/v2/).  
Comportamiento detallado: `openspec/changes/edge-cloud-gateway-provisioning/` (aún no archivado a `openspec/specs/`).

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

1. Un **administrador** prepara en IoT_Sensors cliente, predio, áreas y nodos pendientes (puede usar plantillas globales).
2. Se genera un **código/QR de un solo uso, 24 h**.
3. El **técnico** en la Raspberry (pantalla Agro local, con internet al activar) consume el código.
4. Agro detecta hardware por **UID/serie inmutable**. El técnico **elige el área/slot**; el core no infiere el área desde el UID.
5. Agro envía candidatos; el **mismo gateway confirma** (sin JWT de usuario).
6. Se permite **activación parcial**: las áreas confirmadas operan; las faltantes quedan pendientes.
7. Un sensor inesperado solo puede proponerse a un **área ya existente**.
8. El histórico cloud de un nodo empieza **al activarse**. GPS lo captura el técnico cuando se pueda; el tamaño de área es opcional después.

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
Estado de gateway (conectado / retrasado / desconectado / pendiente) es **distinto** de la frescura del nodo.

## Configuración

El core es la fuente de verdad. Agro hace **polling** (`304` si no cambió). Si el core está caído, Agro sigue con la última config válida.

Cambiar un nodo de área se **propone** en el core y se **confirma en campo**.

## Actualizaciones de Agro (v2)

El admin **autoriza** una imagen (versión + digest). El técnico **confirma** en la Raspberry. No hay OTA automática, rollback de flota ni despliegue gradual en esta versión.

## Frontend cloud

- Admin: `/admin/gateways` (provisionar, QR/referencia de activación, publicar config).
- Cliente: ve estado simple del gateway junto a la frescura de datos.
- No se muestran secretos ni API keys de nodo.

## Qué queda fuera de este sistema (aún)

- IA, alertas activas, WhatsApp/email, n8n (código puede existir **dormido** detrás de flags).
- NDVI histórico/polígonos.
- Interfaz móvil para QR/GPS.
- Comandos físicos hacia riego.
- PostgreSQL.

## Dónde leer más

| Tema | Dónde |
|---|---|
| Cable HTTP exacto | `contracts/edge-cloud/v2/README.md` |
| Corte / rollback | `docs/integration/gateway-v2-cutover-runbook.md` |
| API de usuarios | `docs/api.md` |
| Tablas | `docs/data-model.md` |
| Agro edge | repo Agro.io, rama `integration/iot-v2` |
