#!/usr/bin/env python3
"""
IoT Simulator (fast) with multi-node live mode.

Features:
- Multiple API keys (`--api-key` repeatable and `--api-keys-file`)
- Per-node independent sensor state
- Backfill mode
- Demo alert mode with periodic controlled spikes
"""

from __future__ import annotations

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
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

DEFAULT_BASE_URL = "http://localhost:5050/api/v1"
DEFAULT_INTERVAL = 2
DEFAULT_MODE = "standard"
DEFAULT_DEMO_SPIKE_EVERY = 9
DEFAULT_SEED = 20260423
DEFAULT_DISPATCH_INTERVAL = 20
DEFAULT_DISPATCH_LIMIT = 200
DEFAULT_ADMIN_EMAIL = "admin@sensores.com"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_HTTP_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 "
    "SensoresIoT-Simulator/1.0"
)
DEFAULT_AI_WEEKLY_REPORT_INTERVAL = 90
DEFAULT_AI_WEEKLY_REPORT_DAYS = 7
DEFAULT_AI_WEEKLY_REPORT_INITIAL_DELAY = 35
DEMO_SEED_API_KEYS = [
    "99189486-8181-4e8c-8c6d-b3da66e6712b",  # Nodo DEMO - Nogal Norte
    "c1f5cd79-e760-4a9f-92ea-31ea685a3add",  # Nodo DEMO - Alfalfa Este
    "02b21674-0099-4470-a8dd-b4ebd7d8c2b0",  # Nodo DEMO - Chile Principal
    "ak_b2727bc1d95e342932612ee5573fdb18",   # Nodo DEMO - Prueba E2E
]
PARTNER_SOCIO_API_KEYS = [
    "ak_partner_granja_hogar_001",         # Nodo Granja Hogar
    "ak_partner_campus_reforestado_001",   # Nodo Campus Reforestado
]


@dataclass
class NodeState:
    rng: random.Random
    soil_humidity: float
    accumulated_liters: float
    flow_base: float
    temp_offset: float
    tick: int = 0


@dataclass
class NodeContext:
    api_key: str
    logical_node_id: str
    label: str
    state: NodeState
    sent: int = 0
    failed: int = 0


def get_config():
    parser = argparse.ArgumentParser(description="IoT Sensor Simulator (fast mode)")
    parser.add_argument(
        "--api-key",
        action="append",
        default=[],
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--gateway-key",
        default=os.getenv("SIMULATOR_GATEWAY_KEY", ""),
        help="Credencial de gateway (o env SIMULATOR_GATEWAY_KEY)",
    )
    parser.add_argument(
        "--logical-node-id",
        action="append",
        default=[],
        help="ID de nodo lógico (repetible; o env SIMULATOR_LOGICAL_NODE_ID)",
    )
    parser.add_argument(
        "--api-keys-file",
        default="",
        help="Archivo con API keys (una por linea; # para comentarios)",
    )
    parser.add_argument(
        "--preset",
        choices=["none", "seed-demo", "partner-socio"],
        default=os.getenv("SIMULATOR_PRESET", "none"),
        help=(
            "Preset de API keys. "
            "'seed-demo' carga 4 keys demo, "
            "'partner-socio' carga 2 keys productivas del socio local."
        ),
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
        help="Generar N dias historicos antes de iniciar loop en vivo",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo imprime payload sin enviarlo",
    )
    parser.add_argument(
        "--mode",
        choices=["standard", "demo-alerts"],
        default=os.getenv("SIMULATOR_MODE", DEFAULT_MODE),
        help="Modo de generacion: standard o demo-alerts",
    )
    parser.add_argument(
        "--demo-spike-every",
        type=int,
        default=int(
            os.getenv("SIMULATOR_DEMO_SPIKE_EVERY", str(DEFAULT_DEMO_SPIKE_EVERY))
        ),
        help=f"Cada cuantas lecturas por nodo se fuerza un pico demo (default: {DEFAULT_DEMO_SPIKE_EVERY})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=int(os.getenv("SIMULATOR_SEED", str(DEFAULT_SEED))),
        help=f"Semilla deterministica base (default: {DEFAULT_SEED})",
    )
    parser.add_argument(
        "--dispatch-notifications",
        action="store_true",
        help="Despacha notificaciones periodicamente via /alerts/dispatch-notifications",
    )
    parser.add_argument(
        "--dispatch-interval",
        type=int,
        default=int(
            os.getenv(
                "SIMULATOR_DISPATCH_INTERVAL",
                str(DEFAULT_DISPATCH_INTERVAL),
            )
        ),
        help=f"Intervalo en segundos para dispatch de notificaciones (default: {DEFAULT_DISPATCH_INTERVAL})",
    )
    parser.add_argument(
        "--dispatch-limit",
        type=int,
        default=int(
            os.getenv("SIMULATOR_DISPATCH_LIMIT", str(DEFAULT_DISPATCH_LIMIT))
        ),
        help=f"Limite por ejecucion de dispatch (default: {DEFAULT_DISPATCH_LIMIT})",
    )
    parser.add_argument(
        "--admin-email",
        default=os.getenv("SIMULATOR_ADMIN_EMAIL", ""),
        help="Email admin para login automatico de dispatch",
    )
    parser.add_argument(
        "--admin-password",
        default=os.getenv("SIMULATOR_ADMIN_PASSWORD", ""),
        help="Password admin para login automatico de dispatch",
    )
    parser.add_argument(
        "--quick-demo",
        action="store_true",
        help=(
            "Modo de demo total: preset partner-socio + demo-alerts + "
            "dispatch automatico de notificaciones"
        ),
    )
    parser.add_argument(
        "--ai-weekly-report",
        action="store_true",
        help="Genera reporte IA semanal periodico via /ai-reports/generate",
    )
    parser.add_argument(
        "--ai-weekly-report-interval",
        type=int,
        default=int(
            os.getenv(
                "SIMULATOR_AI_WEEKLY_REPORT_INTERVAL",
                str(DEFAULT_AI_WEEKLY_REPORT_INTERVAL),
            )
        ),
        help=(
            "Intervalo en segundos para intentar trigger de reporte IA "
            f"(default: {DEFAULT_AI_WEEKLY_REPORT_INTERVAL})"
        ),
    )
    parser.add_argument(
        "--ai-weekly-report-initial-delay",
        type=int,
        default=int(
            os.getenv(
                "SIMULATOR_AI_WEEKLY_REPORT_INITIAL_DELAY",
                str(DEFAULT_AI_WEEKLY_REPORT_INITIAL_DELAY),
            )
        ),
        help=(
            "Espera inicial (seg) antes del primer trigger IA semanal "
            f"(default: {DEFAULT_AI_WEEKLY_REPORT_INITIAL_DELAY})"
        ),
    )
    parser.add_argument(
        "--ai-weekly-report-days",
        type=int,
        default=int(
            os.getenv(
                "SIMULATOR_AI_WEEKLY_REPORT_DAYS",
                str(DEFAULT_AI_WEEKLY_REPORT_DAYS),
            )
        ),
        help=f"Ventana de reporte en dias (default: {DEFAULT_AI_WEEKLY_REPORT_DAYS})",
    )
    parser.add_argument(
        "--ai-weekly-report-force",
        action="store_true",
        help="Fuerza generacion de reporte IA aunque ya exista para ese rango",
    )
    parser.add_argument(
        "--ai-weekly-report-notify",
        action="store_true",
        help="Permite notificar reporte IA por canales configurados",
    )
    parser.add_argument(
        "--ai-weekly-report-client-id",
        type=int,
        default=None,
        help="Scope opcional de cliente para reporte IA",
    )
    parser.add_argument(
        "--ai-weekly-report-irrigation-area-id",
        type=int,
        default=None,
        help="Scope opcional de area de riego para reporte IA",
    )
    parser.add_argument(
        "--ai-weekly-report-per-key-area",
        action="store_true",
        help=(
            "Genera un reporte IA por cada area asociada a las API keys "
            "activas del simulador (usa /nodes/geo)."
        ),
    )
    return parser.parse_args()


def normalize_api_key(raw_key: str) -> tuple[str, bool]:
    key = raw_key.strip()
    marker = "ak_"
    if marker in key and not key.startswith(marker):
        return key[key.find(marker):], True
    return key, False


def load_api_keys(args) -> tuple[list[str], int]:
    keys: list[str] = []
    normalized_count = 0

    if args.preset == "seed-demo":
        keys.extend(DEMO_SEED_API_KEYS)
    elif args.preset == "partner-socio":
        keys.extend(PARTNER_SOCIO_API_KEYS)

    for item in args.api_key:
        if item.strip():
            keys.append(item.strip())

    env_multi = os.getenv("SIMULATOR_API_KEYS", "").strip()
    if env_multi:
        keys.extend(k.strip() for k in env_multi.split(",") if k.strip())

    env_single = os.getenv("SIMULATOR_API_KEY", "").strip()
    if env_single:
        keys.append(env_single)

    if args.api_keys_file:
        try:
            with open(args.api_keys_file, "r", encoding="utf-8") as handle:
                for raw in handle:
                    line = raw.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        _, line = line.split("=", 1)
                        line = line.strip()
                    keys.append(line)
        except OSError as exc:
            print(f"No se pudo leer --api-keys-file: {exc}")
            sys.exit(1)

    seen: set[str] = set()
    deduped: list[str] = []
    for raw in keys:
        normalized, changed = normalize_api_key(raw)
        if changed:
            normalized_count += 1
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(normalized)

    return deduped, normalized_count


def apply_quick_demo_defaults(args) -> None:
    if not args.quick_demo:
        return

    if args.preset == "none":
        args.preset = "partner-socio"
    if args.mode == DEFAULT_MODE:
        args.mode = "demo-alerts"
    if args.demo_spike_every == DEFAULT_DEMO_SPIKE_EVERY:
        args.demo_spike_every = 6
    if args.interval == DEFAULT_INTERVAL:
        args.interval = 2

    args.dispatch_notifications = True
    if not args.admin_email:
        args.admin_email = DEFAULT_ADMIN_EMAIL
    if not args.admin_password:
        args.admin_password = DEFAULT_ADMIN_PASSWORD
    args.ai_weekly_report = True
    if args.ai_weekly_report_interval == DEFAULT_AI_WEEKLY_REPORT_INTERVAL:
        args.ai_weekly_report_interval = 15
    if args.ai_weekly_report_initial_delay == DEFAULT_AI_WEEKLY_REPORT_INITIAL_DELAY:
        args.ai_weekly_report_initial_delay = 15
    if not args.ai_weekly_report_force:
        args.ai_weekly_report_force = True
    args.ai_weekly_report_per_key_area = True


def _init_node_state(node_index: int, seed: int) -> NodeState:
    rng = random.Random(seed + ((node_index + 1) * 1013))
    return NodeState(
        rng=rng,
        soil_humidity=rng.uniform(31.0, 43.5),
        accumulated_liters=rng.uniform(40.0, 160.0),
        flow_base=rng.uniform(7.0, 9.2),
        temp_offset=rng.uniform(-1.3, 1.3),
    )


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _solar_factor(hour: float) -> float:
    if hour < 6 or hour > 20:
        return 0.0
    return max(0.0, math.sin(math.pi * (hour - 6) / 14))


def _is_irrigation_hour(hour: float, humidity: float) -> bool:
    morning = 5.0 <= hour < 7.0
    evening = 17.0 <= hour < 19.0
    emergency = humidity < 22.0 and (11.0 <= hour < 12.0)
    return morning or evening or emergency


def _generate_reading(
    timestamp: datetime,
    state: NodeState,
    mode: str,
    demo_spike_every: int,
) -> tuple[dict, list[str]]:
    rng = state.rng
    state.tick += 1

    hour = timestamp.hour + (timestamp.minute / 60.0)
    solar = _solar_factor(hour)
    noise = rng.gauss(0.0, 1.0)

    env_temp = _clamp(
        12.0 + (22.0 * _solar_factor(min(hour + 2, 24))) + (noise * 1.35) + state.temp_offset,
        6.0,
        43.0,
    )
    env_rh = _clamp(85.0 - (43.0 * solar) + (noise * 2.6), 18.0, 98.0)
    env_wind = _clamp(4.0 + (11.0 * solar) + abs(noise * 2.4), 0.0, 40.0)
    env_solar_rad = 0.0
    if solar > 0:
        env_solar_rad = _clamp((940.0 * solar) + (noise * 24.0), 0.0, 1100.0)

    env_eto = _clamp(
        ((0.0028 * env_solar_rad) + (0.09 * env_temp) + (0.045 * env_wind))
        * (0.35 + (0.65 * solar))
        + (noise * 0.24),
        0.0,
        11.5,
    )

    soil_temp = _clamp(
        14.0 + (11.0 * _solar_factor(min(hour + 4, 24))) + (noise * 0.45),
        7.0,
        38.0,
    )
    soil_cond = _clamp(2.4 + (noise * 0.25), 0.5, 5.0)

    irrigating = _is_irrigation_hour(hour, state.soil_humidity)
    demo_flow_burst = False
    if mode == "demo-alerts":
        burst_every = max(4, demo_spike_every)
        burst_window = max(2, burst_every // 2)
        # Fuerza rafagas de flujo en demo para que el dashboard muestre cambios
        # perceptibles aun fuera de horarios de riego reales.
        if (state.tick % burst_every) < burst_window:
            demo_flow_burst = True
            irrigating = True
    evap_loss = 0.08 + (0.17 * solar) + (max(env_temp - 31.0, 0.0) * 0.02)
    irrig_gain = (1.3 + rng.uniform(0.2, 1.3)) if irrigating else 0.0

    state.soil_humidity += irrig_gain - evap_loss + (noise * 0.08)
    state.soil_humidity = _clamp(state.soil_humidity, 9.0, 67.0)

    flow = 0.0
    if irrigating:
        flow = _clamp(state.flow_base + rng.uniform(-1.8, 1.8) + (noise * 0.35), 2.8, 14.5)
        if demo_flow_burst:
            flow = _clamp(
                flow + rng.uniform(0.6, 2.4),
                3.2,
                14.5,
            )

    spike_hints: list[str] = []
    if mode == "demo-alerts" and demo_spike_every > 0 and state.tick % demo_spike_every == 0:
        phase = (state.tick // demo_spike_every) % 3
        if phase == 1:
            state.soil_humidity = _clamp(rng.uniform(14.0, 20.0), 9.0, 67.0)
            spike_hints.append("soil.humidity:LOW")
        elif phase == 2:
            irrigating = True
            flow = _clamp(rng.uniform(11.0, 14.5), 2.8, 14.5)
            spike_hints.append("irrigation.flow_per_minute:HIGH")
        else:
            env_eto = _clamp(rng.uniform(6.2, 8.4), 0.0, 11.5)
            spike_hints.append("environmental.eto:HIGH")

    state.accumulated_liters += flow * (10.0 / 60.0)
    soil_wp = _clamp((-0.03 * (60.0 - state.soil_humidity)) + (noise * 0.04), -3.0, -0.1)

    payload = {
        "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "soil": {
            "conductivity": round(soil_cond, 2),
            "temperature": round(soil_temp, 1),
            "humidity": round(state.soil_humidity, 1),
            "water_potential": round(soil_wp, 2),
        },
        "irrigation": {
            "active": irrigating,
            "accumulated_liters": round(state.accumulated_liters, 1),
            "flow_per_minute": round(flow, 1),
        },
        "environmental": {
            "temperature": round(env_temp, 1),
            "relative_humidity": round(env_rh, 1),
            "wind_speed": round(env_wind, 1),
            "solar_radiation": round(env_solar_rad, 1),
            "eto": round(env_eto, 2),
        },
    }

    probable_breaches = list(spike_hints)
    if payload["soil"]["humidity"] < 24.0:
        probable_breaches.append("soil.humidity<24")
    if payload["irrigation"]["flow_per_minute"] > 10.5:
        probable_breaches.append("flow>10.5")
    if payload["environmental"]["eto"] > 5.8:
        probable_breaches.append("eto>5.8")

    return payload, probable_breaches


def send_reading(base_url: str, api_key: str, payload: dict, logical_node_id: str | None = None) -> bool:
    url = f"{base_url}/readings"
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": DEFAULT_HTTP_USER_AGENT,
        "X-Event-ID": str(uuid.uuid4()),
    }
    if logical_node_id:
        headers["X-Logical-Node-Id"] = str(logical_node_id)
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                return True
            body = resp.read().decode("utf-8", errors="replace")
            print(f"HTTP {resp.status}: {body[:200]}")
            return False
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}: {body[:200]}")
        return False
    except urllib.error.URLError as exc:
        print(f"No se pudo conectar: {exc.reason}")
        return False
    except TimeoutError:
        print(f"Timeout al conectar a {url}")
        return False


def _post_json(
    url: str,
    payload: dict,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/plain, */*")
    req.add_header("User-Agent", DEFAULT_HTTP_USER_AGENT)
    if headers:
        for key, value in headers.items():
            req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            parsed = json.loads(body) if body else {}
            return resp.status, parsed
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {"detail": body[:300]}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        return 0, {"detail": f"No se pudo conectar: {exc.reason}"}
    except TimeoutError:
        return 0, {"detail": "Timeout al conectar"}


def _get_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    req.add_header("Accept", "application/json, text/plain, */*")
    req.add_header("User-Agent", DEFAULT_HTTP_USER_AGENT)
    if headers:
        for key, value in headers.items():
            req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            parsed = json.loads(body) if body else {}
            return resp.status, parsed
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else {}
        except json.JSONDecodeError:
            parsed = {"detail": body[:300]}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        return 0, {"detail": f"No se pudo conectar: {exc.reason}"}
    except TimeoutError:
        return 0, {"detail": "Timeout al conectar"}


def resolve_irrigation_areas_for_keys(
    base_url: str,
    access_token: str,
    api_keys: list[str],
) -> tuple[list[dict[str, object]], str | None]:
    wanted_keys = {normalize_api_key(k)[0] for k in api_keys}
    if not wanted_keys:
        return [], "no hay API keys activas"

    headers = {"Authorization": f"Bearer {access_token}"}
    per_page = 200
    page = 1
    fetched = 0
    total = 0
    matched_by_area: dict[int, dict[str, object]] = {}

    while True:
        qs = urlencode(
            {
                "page": page,
                "per_page": per_page,
                "include_without_coordinates": "true",
            }
        )
        status, payload = _get_json(f"{base_url}/nodes/geo?{qs}", headers=headers)
        if status != 200:
            return [], (
                f"/nodes/geo fallo (status={status}) detail={payload.get('detail')}"
            )

        rows = payload.get("data") or []
        if not isinstance(rows, list):
            return [], "respuesta invalida de /nodes/geo"

        fetched += len(rows)
        raw_total = payload.get("total")
        if isinstance(raw_total, int):
            total = raw_total
        elif total == 0:
            total = len(rows)

        for row in rows:
            if not isinstance(row, dict):
                continue
            row_key = str(row.get("api_key") or "")
            normalized_key, _ = normalize_api_key(row_key)
            if normalized_key not in wanted_keys:
                continue

            area_id_raw = row.get("irrigation_area_id")
            if not isinstance(area_id_raw, int):
                continue
            if area_id_raw in matched_by_area:
                continue

            matched_by_area[area_id_raw] = {
                "irrigation_area_id": area_id_raw,
                "irrigation_area_name": str(row.get("irrigation_area_name") or ""),
                "property_name": str(row.get("property_name") or ""),
                "api_key": normalized_key,
            }

        if fetched >= total or not rows:
            break
        page += 1

    matched = sorted(
        matched_by_area.values(),
        key=lambda item: int(item.get("irrigation_area_id") or 0),
    )
    return matched, None


def admin_login(base_url: str, email: str, password: str) -> tuple[str | None, str | None]:
    status, payload = _post_json(
        f"{base_url}/auth/login",
        {"email": email, "password": password},
    )
    if status == 200 and payload.get("access_token"):
        return str(payload["access_token"]), None
    return None, f"login admin fallo (status={status}) detail={payload.get('detail')}"


def dispatch_notifications(
    base_url: str,
    access_token: str,
    *,
    limit: int,
) -> tuple[int, dict]:
    qs = urlencode({"limit": limit, "only_unread": "true"})
    return _post_json(
        f"{base_url}/alerts/dispatch-notifications?{qs}",
        {},
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _utc_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def trigger_ai_weekly_report(
    base_url: str,
    access_token: str,
    *,
    days: int,
    force: bool,
    notify: bool,
    client_id: int | None,
    irrigation_area_id: int | None,
) -> tuple[int, dict]:
    now_utc = datetime.now(timezone.utc)
    range_end = now_utc
    range_start = now_utc - timedelta(days=max(1, days))

    payload: dict[str, object] = {
        "start_datetime": _utc_iso(range_start),
        "end_datetime": _utc_iso(range_end),
        "notify": notify,
        "force": force,
    }
    if client_id is not None:
        payload["client_id"] = int(client_id)
    if irrigation_area_id is not None:
        payload["irrigation_area_id"] = int(irrigation_area_id)

    return _post_json(
        f"{base_url}/ai-reports/generate",
        payload,
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _masked_key(api_key: str) -> str:
    if len(api_key) <= 16:
        return api_key
    return f"{api_key[:8]}...{api_key[-4:]}"


def _print_line(
    *,
    prefix: str,
    node_label: str,
    payload: dict,
    probable_breaches: list[str],
) -> None:
    breach_tag = ", ".join(probable_breaches) if probable_breaches else "none"
    print(
        f"{prefix} [{node_label}] {payload['timestamp']} | "
        f"SoilHum={payload['soil']['humidity']}% | "
        f"Flow={payload['irrigation']['flow_per_minute']} L/min | "
        f"ETo={payload['environmental']['eto']} | "
        f"Breach? {breach_tag}"
    )


def backfill(
    *,
    base_url: str,
    nodes: list[NodeContext],
    days: int,
    dry_run: bool,
    mode: str,
    demo_spike_every: int,
) -> None:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    expected = days * 144

    print(
        f"\nBackfill: {days} dias por nodo (~{expected} lecturas por nodo, {len(nodes)} nodos)"
    )
    print(f"Desde: {start.strftime('%Y-%m-%d %H:%M')} UTC")
    print(f"Hasta: {now.strftime('%Y-%m-%d %H:%M')} UTC\n")

    for node in nodes:
        current = start
        total = 0
        ok = 0
        print(f"-> {node.label} ({_masked_key(node.api_key)})")
        while current < now:
            payload, probable = _generate_reading(
                current,
                node.state,
                mode,
                demo_spike_every,
            )
            total += 1
            if dry_run:
                if total <= 2 or total % 144 == 0:
                    _print_line(
                        prefix="  [DRY-BF]",
                        node_label=node.label,
                        payload=payload,
                        probable_breaches=probable,
                    )
            else:
                if send_reading(base_url, node.api_key, payload, node.logical_node_id):
                    ok += 1
                if total % 144 == 0:
                    print(f"  Dia {total // 144}/{days} ({ok}/{total} ok)")
                time.sleep(0.03)
            current += timedelta(minutes=10)
        print(f"  Backfill nodo completo: {ok if not dry_run else total}/{total}\n")


def main():
    args = get_config()
    apply_quick_demo_defaults(args)
    if args.api_key or args.api_keys_file or os.getenv("SIMULATOR_API_KEY") or os.getenv("SIMULATOR_API_KEYS"):
        print("--api-key ya no es válido. Usa --gateway-key y --logical-node-id.")
        sys.exit(2)
    logical_ids = list(args.logical_node_id)
    env_logical = os.getenv("SIMULATOR_LOGICAL_NODE_ID")
    if env_logical and not logical_ids:
        logical_ids = [env_logical]
    if not args.gateway_key or not logical_ids:
        print("Debes indicar --gateway-key y al menos un --logical-node-id.")
        sys.exit(1)

    nodes: list[NodeContext] = []
    for index, logical_id in enumerate(logical_ids):
        label = f"node-{index + 1:02d}"
        state = _init_node_state(index, args.seed)
        nodes.append(
            NodeContext(
                api_key=args.gateway_key,
                logical_node_id=str(logical_id),
                label=label,
                state=state,
            )
        )

    print("=" * 72)
    print("IoT Simulator FAST - Multi Nodo")
    print("=" * 72)
    print(f"Server:         {args.base_url}")
    print(f"Intervalo:      {args.interval}s")
    print(f"Modo:           {args.mode}")
    print(f"Demo spike:     cada {args.demo_spike_every} lecturas por nodo")
    print(f"Dry-run:        {'si' if args.dry_run else 'no'}")
    print(f"Preset:         {args.preset}")
    print(f"Quick-demo:     {'si' if args.quick_demo else 'no'}")
    print(
        "Dispatch notif: "
        f"{'si' if args.dispatch_notifications else 'no'}"
        + (
            f" (cada {args.dispatch_interval}s)"
            if args.dispatch_notifications
            else ""
        )
    )
    print(
        "Reporte IA sem: "
        f"{'si' if args.ai_weekly_report else 'no'}"
        + (
            f" (cada {args.ai_weekly_report_interval}s, ventana={args.ai_weekly_report_days}d)"
            if args.ai_weekly_report
            else ""
        )
    )
    if args.ai_weekly_report:
        print(
            "IA por area key: "
            f"{'si' if args.ai_weekly_report_per_key_area else 'no'}"
        )
    print(f"Nodos activos:  {len(nodes)}")
    for node in nodes:
        print(f"  - {node.label}: {_masked_key(node.api_key)}")
    print("=" * 72)

    if args.backfill > 0:
        backfill(
            base_url=args.base_url,
            nodes=nodes,
            days=args.backfill,
            dry_run=args.dry_run,
            mode=args.mode,
            demo_spike_every=args.demo_spike_every,
        )

    admin_token: str | None = None
    ai_targets_by_key_area: list[dict[str, object]] = []
    next_dispatch_ts = time.monotonic() + max(3, args.dispatch_interval)
    next_ai_report_ts = (
        time.monotonic() + max(5, args.ai_weekly_report_initial_delay)
    )
    if args.dispatch_notifications and args.dry_run:
        print("Dispatch de notificaciones deshabilitado durante dry-run.")
    elif args.dispatch_notifications:
        if not args.admin_email or not args.admin_password:
            print(
                "Dispatch de notificaciones activo, pero faltan "
                "--admin-email/--admin-password."
            )
        else:
            admin_token, err = admin_login(
                args.base_url,
                args.admin_email,
                args.admin_password,
            )
            if admin_token is None:
                print(f"No se pudo iniciar sesion admin para dispatch: {err}")
            else:
                print("Sesion admin iniciada (dispatch/reportes IA).")
                if args.ai_weekly_report and args.ai_weekly_report_per_key_area:
                    ai_targets_by_key_area, resolve_err = resolve_irrigation_areas_for_keys(
                        args.base_url,
                        admin_token,
                        [node.api_key for node in nodes],
                    )
                    if resolve_err:
                        print(f"[AI-REPORT] no se pudieron resolver areas por key: {resolve_err}")
                    elif not ai_targets_by_key_area:
                        print("[AI-REPORT] no se encontro area asociada a las API keys activas.")
                    else:
                        print("[AI-REPORT] areas objetivo por API key:")
                        for target in ai_targets_by_key_area:
                            print(
                                "  - area_id={aid} area='{area}' predio='{property}' key={key}".format(
                                    aid=target.get("irrigation_area_id"),
                                    area=target.get("irrigation_area_name", ""),
                                    property=target.get("property_name", ""),
                                    key=_masked_key(str(target.get("api_key", ""))),
                                )
                            )

    if args.ai_weekly_report and args.dry_run:
        print("Trigger de reporte IA semanal deshabilitado durante dry-run.")
    elif args.ai_weekly_report and (not args.admin_email or not args.admin_password):
        print(
            "Trigger de reporte IA semanal activo, pero faltan "
            "--admin-email/--admin-password."
        )

    print(f"\nLoop en vivo cada {args.interval}s (Ctrl+C para detener)\n")
    try:
        while True:
            now = datetime.now(timezone.utc)
            for node in nodes:
                payload, probable = _generate_reading(
                    now,
                    node.state,
                    args.mode,
                    args.demo_spike_every,
                )

                if args.dry_run:
                    _print_line(
                        prefix="[DRY]",
                        node_label=node.label,
                        payload=payload,
                        probable_breaches=probable,
                    )
                    continue

                if send_reading(args.base_url, node.api_key, payload, node.logical_node_id):
                    node.sent += 1
                    _print_line(
                        prefix=f"[OK #{node.sent}]",
                        node_label=node.label,
                        payload=payload,
                        probable_breaches=probable,
                    )
                else:
                    node.failed += 1
                    _print_line(
                        prefix=f"[FAIL #{node.failed}]",
                        node_label=node.label,
                        payload=payload,
                        probable_breaches=probable,
                    )

            if args.dispatch_notifications and not args.dry_run:
                now_mono = time.monotonic()
                if now_mono >= next_dispatch_ts:
                    if admin_token is None and args.admin_email and args.admin_password:
                        admin_token, _ = admin_login(
                            args.base_url,
                            args.admin_email,
                            args.admin_password,
                        )

                    if admin_token is not None:
                        status, payload = dispatch_notifications(
                            args.base_url,
                            admin_token,
                            limit=args.dispatch_limit,
                        )
                        if status == 200:
                            print(
                                "[DISPATCH] pending={pending} processed={processed} "
                                "emailed={emailed} whatsapp={whatsapp}".format(
                                    pending=payload.get("pending_alerts", 0),
                                    processed=payload.get("processed_alerts", 0),
                                    emailed=payload.get("emailed_alerts", 0),
                                    whatsapp=payload.get("whatsapp_alerts", 0),
                                )
                            )
                        elif status == 401:
                            admin_token = None
                            print("[DISPATCH] token expirado/no valido, reintentando login.")
                        else:
                            print(
                                f"[DISPATCH] fallo status={status} detail={payload.get('detail')}"
                            )
                    else:
                        print(
                            "[DISPATCH] sin token admin, omitiendo ciclo de dispatch."
                        )
                    next_dispatch_ts = time.monotonic() + max(3, args.dispatch_interval)

            if args.ai_weekly_report and not args.dry_run:
                now_mono = time.monotonic()
                if now_mono >= next_ai_report_ts:
                    if admin_token is None and args.admin_email and args.admin_password:
                        admin_token, _ = admin_login(
                            args.base_url,
                            args.admin_email,
                            args.admin_password,
                        )

                    if admin_token is not None:
                        if args.ai_weekly_report_per_key_area:
                            if not ai_targets_by_key_area:
                                ai_targets_by_key_area, resolve_err = (
                                    resolve_irrigation_areas_for_keys(
                                        args.base_url,
                                        admin_token,
                                        [node.api_key for node in nodes],
                                    )
                                )
                                if resolve_err:
                                    print(
                                        "[AI-REPORT] no se pudieron resolver areas por key: "
                                        f"{resolve_err}"
                                    )
                            if not ai_targets_by_key_area:
                                print(
                                    "[AI-REPORT] sin areas resueltas por API key, "
                                    "omitiendo trigger semanal."
                                )
                            else:
                                generated_total = 0
                                skipped_total = 0
                                failed_total = 0
                                report_ids_total: list[int] = []
                                for target in ai_targets_by_key_area:
                                    area_id = int(target["irrigation_area_id"])
                                    status, payload = trigger_ai_weekly_report(
                                        args.base_url,
                                        admin_token,
                                        days=args.ai_weekly_report_days,
                                        force=args.ai_weekly_report_force,
                                        notify=args.ai_weekly_report_notify,
                                        client_id=None,
                                        irrigation_area_id=area_id,
                                    )
                                    if status == 200:
                                        generated = int(payload.get("generated_count", 0))
                                        skipped = int(payload.get("skipped_count", 0))
                                        failed = int(payload.get("failed_count", 0))
                                        ids = payload.get("report_ids", [])
                                        generated_total += generated
                                        skipped_total += skipped
                                        failed_total += failed
                                        if isinstance(ids, list):
                                            for rid in ids:
                                                if isinstance(rid, int):
                                                    report_ids_total.append(rid)
                                        print(
                                            "[AI-REPORT][area={area_id}] generated={generated} "
                                            "skipped={skipped} failed={failed} ids={ids}".format(
                                                area_id=area_id,
                                                generated=generated,
                                                skipped=skipped,
                                                failed=failed,
                                                ids=ids,
                                            )
                                        )
                                        continue
                                    if status == 401:
                                        admin_token = None
                                        print(
                                            "[AI-REPORT] token expirado/no valido, "
                                            "reintentando login."
                                        )
                                        break
                                    failed_total += 1
                                    print(
                                        "[AI-REPORT][area={area_id}] fallo status={status} "
                                        "detail={detail}".format(
                                            area_id=area_id,
                                            status=status,
                                            detail=payload.get("detail"),
                                        )
                                    )

                                print(
                                    "[AI-REPORT] total generated={generated} skipped={skipped} "
                                    "failed={failed} ids={ids}".format(
                                        generated=generated_total,
                                        skipped=skipped_total,
                                        failed=failed_total,
                                        ids=report_ids_total,
                                    )
                                )
                        else:
                            status, payload = trigger_ai_weekly_report(
                                args.base_url,
                                admin_token,
                                days=args.ai_weekly_report_days,
                                force=args.ai_weekly_report_force,
                                notify=args.ai_weekly_report_notify,
                                client_id=args.ai_weekly_report_client_id,
                                irrigation_area_id=args.ai_weekly_report_irrigation_area_id,
                            )
                            if status == 200:
                                print(
                                    "[AI-REPORT] generated={generated} skipped={skipped} "
                                    "failed={failed} ids={ids}".format(
                                        generated=payload.get("generated_count", 0),
                                        skipped=payload.get("skipped_count", 0),
                                        failed=payload.get("failed_count", 0),
                                        ids=payload.get("report_ids", []),
                                    )
                                )
                            elif status == 401:
                                admin_token = None
                                print("[AI-REPORT] token expirado/no valido, reintentando login.")
                            else:
                                print(
                                    f"[AI-REPORT] fallo status={status} detail={payload.get('detail')}"
                                )
                    else:
                        print(
                            "[AI-REPORT] sin token admin, omitiendo trigger semanal."
                        )

                    next_ai_report_ts = time.monotonic() + max(
                        10, args.ai_weekly_report_interval
                    )
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nSimulador detenido.")
        for node in nodes:
            print(f"  {node.label}: sent={node.sent} failed={node.failed}")


if __name__ == "__main__":
    main()
