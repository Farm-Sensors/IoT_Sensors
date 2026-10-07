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

> **Nota para el simulador:** Usa la credencial de gateway del predio (`--gateway-key` / `SIM_GATEWAY_KEY`) y el ID de nodo lógico (`--logical-node-id` / `SIMULATOR_LOGICAL_NODE_ID`, repetible para varios nodos). Las keys `ak_partner_*` y las demo son legado: no envían telemetría.
