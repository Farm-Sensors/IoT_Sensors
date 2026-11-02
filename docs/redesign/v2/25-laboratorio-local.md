# Laboratorio local del rediseño (2026-11-02)

Estado de la base **local de desarrollo** (`sensores_riego` en el contenedor `sensores_mysql`, solo en `127.0.0.1`) para revisar la interfaz con datos. No es el laboratorio compartido de `docs/test-data.md` ni toca el VPS.

## Predios y simuladores

| Predio | Áreas | Equipo | Simulador |
|---|---|---|---|
| DEMO - Rancho Norte (1) | 4 (Nogal Norte, Alfalfa Este, Chile Principal, «Área 2») | equipo 1 | `make dev` (desde el 29-oct): nodos lógicos 1 a 4, cada 60 s |
| Granja Hogar (2) | 1 | equipo nuevo (el anterior estaba revocado) | `simulator_fast.py`, nodo 5, historial de 7 días y cada 60 s |
| Campus Reforestado (3) | 1 | equipo nuevo | ídem, nodo 6 |
| **Rancho Los Olivos (40)** | 3 (Manzano Sur 7,5 ha, Maíz Ribera 9 ha, Algodón Llano 6 ha) | equipo 19, creado **por la interfaz** | ídem, nodos 27 a 29, historial de 7 días |

Los simuladores adicionales se lanzaron con `uv run … simulator_fast.py --gateway-key … --logical-node-id … --backfill 7 --interval 60`; sus credenciales están en `.dev/state/gateway-p<predio>.env` (permisos 600, no versionado) y sus bitácoras en `.dev/logs/simulator-p<predio>.log` (Python no vacía el búfer hasta que haya salida suficiente; para ver la actividad, consultar la API). Para detenerlos: `kill $(cat .dev/pids/simulator-p<predio>.pgid)`.

## Cómo se creó Rancho Los Olivos (flujo completo con la interfaz)

1. **Clientes › Agricola del Norte › Nuevo Predio** (nombre y ubicación).
2. **Nueva Área** ×3 (cultivo del catálogo y hectáreas).
3. En cada área: **Nuevo Ciclo** (fechas) y **Nuevo Nodo** (nombre, serie y coordenadas).
4. **Red › Equipos › Nuevo equipo**: predio y áreas → paso «Vincular equipo».
5. **Lado del equipo (emulado por la API del contrato v2):** inicio de sesión de vinculación (`pairing-sessions`) → el admin escribe el código y lo aprueba en la interfaz → el equipo recoge su credencial, informa la ubicación del predio y, por cada área, envía y confirma el candidato de nodo.
6. **Umbrales** (Humedad del suelo y Flujo de agua) creados con la pantalla del admin.
7. Simulador con la credencial del equipo.

También se completaron por la interfaz los ciclos que faltaban en las áreas de DEMO y de Campus Reforestado.

## Configuración local (no versionada)

En `backend/.env` (ignorado por git): `ALERTS_ENABLED`, `NOTIFICATIONS_ENABLED`, `AI_REPORTS_ENABLED` y `AI_ASSISTANT_ENABLED` en `true` (para ver Fase 2) y, para probar la vinculación, `GATEWAY_PAIRING_ENABLED=true` con `PAIRING_VERIFICATION_BASE_URL=http://localhost:5173` y una clave `PAIRING_CODE_HMAC_KEY` aleatoria. Siguen apagados `AZURE_OPENAI_ENABLED`, correo, WhatsApp y el perfil `phase2`. Las copias de seguridad del `.env` anterior quedaron en `/tmp/backend.env.bak` y `/tmp/backend.env.bak2`.

## Qué se vio al recorrerlo

- Con datos reales, el predio nuevo aparece en Mis predios con sus 3 parcelas en una fila, en Equipos como «Listo · Todas las áreas reciben datos», y su Área › Ahora muestra el semáforo («Óptimo» donde hay umbral, «Sin umbral definido» donde no).
- Con los simuladores de los demás predios, los equipos creados antes por `make dev` (que no pasaron por la confirmación de nodos) siguen diciendo «Llegan datos, sin nodo asignado»: el simulador envía lecturas sin pasar por ese paso. Es una limitación del laboratorio, no de la pantalla.
- Con las alertas encendidas y los umbrales de DEMO (por ejemplo, humedad entre 20 y 46 %), el simulador, cuya humedad llega a 67 %, genera unas 6 alertas por minuto. Acumula miles en la tabla `alertas`.
