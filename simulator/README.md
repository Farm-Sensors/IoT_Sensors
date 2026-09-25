# 📡 Simulador IoT — Sistema de Riego Agrícola

Simula el envío de lecturas de sensores cada 10 minutos al backend.

## Instalación

```bash
cd simulator
pip install -r requirements.txt
```

## Uso

### 1. Obtener la credencial de gateway
Activa un gateway y usa su credencial más el ID del nodo lógico. `--api-key` de nodo ya no se acepta.

### 2. Ejecutar el simulador

```bash
# Modo normal (envía cada 10 min)
python simulator.py --gateway-key gk_xxxxxx --logical-node-id 12

# Modo rápido para pruebas (cada 30 seg)
python simulator.py --gateway-key gk_xxxxxx --logical-node-id 12 --interval 30

# Generar 7 días de historial + iniciar loop
python simulator.py --gateway-key gk_xxxxxx --logical-node-id 12 --backfill 7

# Solo ver qué datos generaría (sin enviar)
python simulator.py --gateway-key gk_xxxxxx --logical-node-id 12 --dry-run

# Apuntar a otro servidor
python simulator.py --gateway-key gk_xxxxxx --logical-node-id 12 --base-url https://mi-servidor.com/api/v1
```

### 3. Simulador rápido multi-nodo (demo en vivo)

`simulator_fast.py` incluye soporte para varios nodos en paralelo, modo de picos controlados para demo y carga de API keys desde archivo.

```bash
# Demo total de un comando (usa preset partner-socio y despacha notificaciones)
python simulator_fast.py --quick-demo

# 2 nodos en paralelo (intervalo 2s)
python simulator_fast.py \
  --preset partner-socio \
  --interval 2

# Modo demo de alertas controladas
python simulator_fast.py \
  --preset partner-socio \
  --mode demo-alerts \
  --demo-spike-every 6 \
  --interval 2

# Cargar API keys desde archivo (una por linea)
python simulator_fast.py --api-keys-file ./keys.txt --mode demo-alerts

# Backfill por cada nodo y luego loop en vivo
python simulator_fast.py --api-keys-file ./keys.txt --backfill 7 --interval 2
```

`--quick-demo` habilita:
- preset `partner-socio` (Granja Hogar + Campus Reforestado)
- modo `demo-alerts`
- dispatch automatico de notificaciones cada 20s
- trigger automatico de reporte IA semanal (ventana 7 dias)
- generacion de reporte IA por cada area asociada a las API keys activas
- login admin local por defecto (`admin@sensores.com` / `admin123`)

Ejemplo con trigger IA manual:

```bash
python simulator_fast.py \
  --api-keys-file ./keys.txt \
  --mode demo-alerts \
  --interval 2 \
  --ai-weekly-report \
  --ai-weekly-report-per-key-area \
  --ai-weekly-report-force \
  --ai-weekly-report-days 7 \
  --ai-weekly-report-initial-delay 30 \
  --ai-weekly-report-interval 120 \
  --admin-email admin@sensores.com \
  --admin-password admin123
```

### 4. Launcher rápido VPS (partner)

Para no copiar el comando largo cada vez:

```bash
cd simulator
SIM_ADMIN_PASSWORD='TU_PASSWORD_ADMIN' ./run_partner_vps.sh
```

Atajo desde la raíz del repo:

```bash
SIM_ADMIN_PASSWORD='TU_PASSWORD_ADMIN' make demo-live-partner-vps
```

### Variables de entorno (alternativa a CLI)
```bash
export SIMULATOR_API_KEY=ak_n01_xxxxxx
export SIMULATOR_API_KEYS="key1,key2,key3"
export SIMULATOR_PRESET=seed-demo
# Preset alterno para nodos productivos del socio (local seed)
# export SIMULATOR_PRESET=partner-socio
export SIMULATOR_ADMIN_EMAIL=admin@sensores.com
export SIMULATOR_ADMIN_PASSWORD=admin123
export SIMULATOR_BASE_URL=http://localhost:5050/api/v1
export SIMULATOR_INTERVAL=600
python simulator.py
```

## Datos generados

El simulador genera datos coherentes con la hora del día:

| Parámetro | Comportamiento |
|-----------|---------------|
| ☀️ Radiación solar | Curva solar realista (pico ~14:00, 0 de noche) |
| 🌡️ Temp. ambiente | Correlacionada con sol + lag de 2 hrs |
| 🌱 Temp. suelo | Versión amortiguada de temp. ambiente |
| 💧 Humedad suelo | Baja con evaporación diurna, sube con riego |
| 🚿 Riego | Activo 5-7 AM y 5-7 PM (programado) |
| 💨 Viento | Ligeramente mayor al mediodía |
| 📊 ETo | Calculado de radiación + temp + viento |
