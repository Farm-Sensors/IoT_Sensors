#!/usr/bin/env python3
"""
📡 IoT Sensor Simulator — Sistema de Riego Agrícola
=====================================================
Simula el envío de lecturas de sensores cada 10 minutos al backend.
Genera datos matemáticamente coherentes según la hora del día.

Zero dependencias externas — usa solo la librería estándar de Python.

Uso:
  python simulator.py --api-key ak_n01_abc123
  python simulator.py --api-key ak_n01_abc123 --interval 30      # cada 30s (pruebas)
  python simulator.py --api-key ak_n01_abc123 --backfill 7       # genera 7 días de historial
  python simulator.py --api-key ak_n01_abc123 --dry-run          # sin enviar
"""

import argparse
import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "http://localhost:5050/api/v1"
DEFAULT_INTERVAL = 600  # 10 minutes


def get_config():
    parser = argparse.ArgumentParser(
        description="📡 IoT Sensor Simulator — Riego Agrícola"
    )
    parser.add_argument(
        "--api-key",
        default="",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--gateway-key",
        default=os.getenv("SIMULATOR_GATEWAY_KEY", ""),
        help="Credencial de gateway (o env SIMULATOR_GATEWAY_KEY)",
    )
    parser.add_argument(
        "--logical-node-id",
        default=os.getenv("SIMULATOR_LOGICAL_NODE_ID", ""),
        help="ID del nodo lógico autorizado (o env SIMULATOR_LOGICAL_NODE_ID)",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("SIMULATOR_BASE_URL", DEFAULT_BASE_URL),
        help=f"URL base del API (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=int(os.getenv("SIMULATOR_INTERVAL", str(DEFAULT_INTERVAL))),
        help=f"Intervalo en segundos (default: {DEFAULT_INTERVAL})",
    )
    parser.add_argument(
        "--backfill",
        type=int,
        default=0,
        help="Generar N días de datos históricos antes de iniciar el loop",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo imprime el payload sin enviarlo",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Realistic Data Generation
# ---------------------------------------------------------------------------

_state = {
    "soil_humidity": 35.0,
    "accumulated_liters": 0.0,
}


def _solar_factor(hour: float) -> float:
    """Returns 0..1 based on solar position. Peak at ~14:00."""
    if hour < 6 or hour > 20:
        return 0.0
    return max(0.0, math.sin(math.pi * (hour - 6) / 14))


def _is_irrigation_hour(hour: float) -> bool:
    """Irrigation runs early morning (5-7 AM) and late afternoon (5-7 PM)."""
    return (5.0 <= hour < 7.0) or (17.0 <= hour < 19.0)


def generate_reading(timestamp: datetime) -> dict:
    """
    Generate a sensor reading coherent with the time of day.
    
    - Solar radiation follows a bell curve peaking at 2 PM
    - Air temp correlates with sun (2 hr lag)
    - Soil temp is damped vs air temp
    - Soil humidity decreases with evaporation, increases with irrigation
    - Irrigation activates at 5-7 AM and 5-7 PM
    - ETo correlates with temp, wind, radiation
    """
    hour = timestamp.hour + timestamp.minute / 60.0
    solar = _solar_factor(hour)
    noise = random.gauss(0, 1)

    # --- Environmental ---
    temp_solar = _solar_factor(min(hour + 2, 24))
    env_temp = round(max(5.0, min(42.0, 12 + 23 * temp_solar + noise * 1.5)), 1)

    env_rh = round(max(20.0, min(98.0, 85 - 45 * solar + noise * 3)), 1)

    env_wind = round(max(0.0, min(40.0, 5 + 10 * solar + abs(noise) * 3)), 1)

    env_solar_rad = round(max(0.0, min(1100.0, 950 * solar + noise * 30)), 1) if solar > 0 else 0.0

    env_eto = round(max(0.0, min(12.0, (0.003 * env_solar_rad + 0.1 * env_temp + 0.05 * env_wind) * solar + noise * 0.3)), 2)

    # --- Soil ---
    soil_temp = round(max(8.0, min(38.0, 15 + 12 * _solar_factor(min(hour + 4, 24)) + noise * 0.5)), 1)

    soil_cond = round(max(0.5, min(5.0, 2.5 + noise * 0.3)), 2)

    irrigating = _is_irrigation_hour(hour)
    evap_loss = 0.15 * solar
    irrig_gain = 1.5 if irrigating else 0
    _state["soil_humidity"] += irrig_gain - evap_loss + noise * 0.1
    _state["soil_humidity"] = max(10.0, min(65.0, _state["soil_humidity"]))
    soil_hum = round(_state["soil_humidity"], 1)

    soil_wp = round(max(-3.0, min(-0.1, -0.03 * (60 - soil_hum) + noise * 0.05)), 2)

    # --- Irrigation ---
    flow = round(max(0.0, 8.0 + noise * 0.5), 1) if irrigating else 0.0
    _state["accumulated_liters"] += flow * (10.0 / 60.0)
    acc_liters = round(_state["accumulated_liters"], 1)

    return {
        "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "soil": {
            "conductivity": soil_cond,
            "temperature": soil_temp,
            "humidity": soil_hum,
            "water_potential": soil_wp,
        },
        "irrigation": {
            "active": irrigating,
            "accumulated_liters": acc_liters,
            "flow_per_minute": flow,
        },
        "environmental": {
            "temperature": env_temp,
            "relative_humidity": env_rh,
            "wind_speed": env_wind,
            "solar_radiation": env_solar_rad,
            "eto": env_eto,
        },
    }


# ---------------------------------------------------------------------------
# API Communication (stdlib only — no requests needed)
# ---------------------------------------------------------------------------


def send_reading(base_url: str, gateway_key: str, logical_node_id: str, payload: dict) -> bool:
    """POST a reading using urllib. Returns True on success."""
    url = f"{base_url}/readings"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "X-API-Key": gateway_key,
            "X-Logical-Node-Id": str(logical_node_id),
            "X-Event-ID": str(uuid.uuid4()),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                return True
            else:
                body = resp.read().decode("utf-8", errors="replace")
                print(f"  ⚠️  HTTP {resp.status}: {body[:200]}")
                return False
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ⚠️  HTTP {e.code}: {body[:200]}")
        return False
    except urllib.error.URLError as e:
        print(f"  ❌ No se pudo conectar: {e.reason}")
        return False
    except TimeoutError:
        print(f"  ⏰ Timeout al conectar a {url}")
        return False


def normalize_api_key(raw_key: str) -> tuple[str, bool]:
    """Trim API key and recover common copy/paste mistakes from dashboards."""
    key = raw_key.strip()
    marker = "ak_"

    # Accept values accidentally prefixed, e.g. "node-id-ak_xxx".
    if marker in key and not key.startswith(marker):
        return key[key.find(marker):], True

    return key, False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def backfill(base_url: str, gateway_key: str, logical_node_id: str, days: int, dry_run: bool):
    """Generate historical data for the last N days."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    current = start
    total = 0
    success = 0

    expected = days * 144
    print(f"\n📜 Backfill: generando {days} días de historial (~{expected} lecturas)...")
    print(f"   Desde: {start.strftime('%Y-%m-%d %H:%M')} UTC")
    print(f"   Hasta: {now.strftime('%Y-%m-%d %H:%M')} UTC\n")

    while current < now:
        payload = generate_reading(current)
        total += 1

        if dry_run:
            if total <= 3 or total % 144 == 0:
                print(f"  [DRY] {payload['timestamp']} | "
                      f"Hum: {payload['soil']['humidity']}% | "
                      f"Temp: {payload['environmental']['temperature']}°C | "
                      f"Riego: {'ON' if payload['irrigation']['active'] else 'OFF'}")
        else:
            if send_reading(base_url, gateway_key, logical_node_id, payload):
                success += 1
            if total % 144 == 0:
                print(f"  ✅ Día {total // 144}/{days} ({success}/{total} ok)")
            time.sleep(0.05)  # avoid overwhelming the server

        current += timedelta(minutes=10)

    print(f"\n{'📜 [DRY-RUN] ' if dry_run else '📜 '}Backfill completado: "
          f"{success if not dry_run else total}/{total} lecturas.\n")


def main():
    args = get_config()
    if args.api_key or os.getenv("SIMULATOR_API_KEY"):
        print("❌ --api-key ya no es válido. Usa --gateway-key y --logical-node-id.")
        sys.exit(2)
    if not args.gateway_key or not args.logical_node_id:
        print("❌ Debes especificar --gateway-key y --logical-node-id.")
        sys.exit(1)

    key_display = (f"{args.gateway_key[:12]}...{args.gateway_key[-4:]}"
                   if len(args.gateway_key) > 16 else args.gateway_key)

    print("=" * 60)
    print("  📡 Simulador IoT — Sistema de Riego Agrícola")
    print("=" * 60)
    print(f"  🔗 Server:    {args.base_url}")
    print(f"  🔑 Gateway:   {key_display}")
    print(f"  🧩 Nodo:      {args.logical_node_id}")
    print(f"  ⏱️  Intervalo: {args.interval}s ({args.interval / 60:.1f} min)")
    print(f"  🧪 Dry-run:   {'Sí' if args.dry_run else 'No'}")
    print("=" * 60)

    if args.backfill > 0:
        backfill(args.base_url, args.gateway_key, args.logical_node_id, args.backfill, args.dry_run)

    print(f"\n🔄 Loop activo cada {args.interval}s (Ctrl+C para detener)\n")
    sent = 0
    failed = 0

    try:
        while True:
            now = datetime.now(timezone.utc)
            p = generate_reading(now)

            label = (f"Hum: {p['soil']['humidity']}% ⭐ | "
                     f"Temp: {p['environmental']['temperature']}°C | "
                     f"Riego: {'ON 💧' if p['irrigation']['active'] else 'OFF'} | "
                     f"Flujo: {p['irrigation']['flow_per_minute']} L/min ⭐ | "
                     f"ETo: {p['environmental']['eto']} ⭐")

            if args.dry_run:
                print(f"  [DRY] {p['timestamp']} | {label}")
            else:
                if send_reading(args.base_url, args.gateway_key, args.logical_node_id, p):
                    sent += 1
                    print(f"  ✅ [{sent}] {p['timestamp']} | {label}")
                else:
                    failed += 1
                    print(f"  ❌ [{failed} fails] {p['timestamp']}")

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print(f"\n\n🛑 Simulador detenido. Enviadas: {sent} | Fallidas: {failed}\n")


if __name__ == "__main__":
    main()
