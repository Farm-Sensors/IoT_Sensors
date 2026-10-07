# Frozen frontend evidence — weather and latest-point NDVI

Truthful 200 bodies for Fabián. Do not invent API shape. Telemetry stays on `/api/v1/readings*`. Weather is disabled-by-default commercial Open-Meteo (`OPEN_METEO_ENABLED=false`). NDVI has no `X-Event-ID`; replay uses scene identity plus payload.

U1 uses these 200 fixtures. Agent briefs: `openspec/changes/archive/2026-10-07-integration-u1-dashboard-current/` and `openspec/changes/archive/2026-10-07-integration-u2-history-export/`. Ignore work packets.

## Routes

| Method | Path | Auth | Query |
|---|---|---|---|
| GET | `/api/v1/weather/current` | JWT | `irrigation_area_id` (required) |
| POST | `/api/v1/ndvi-snapshots` | `X-API-Key` | none |
| GET | `/api/v1/ndvi-snapshots/latest` | JWT | `irrigation_area_id` (required) |

## Status codes

| Lane | Codes |
|---|---|
| Weather | `200` fresh or stale (`cache_state`), `401`, `404` anti-enumeration (foreign/missing/inactive), `409` no usable GPS, `502` provider, `503` disabled/unconfigured |
| NDVI | `201` created, `200` replaced/replayed, `403`, `404`, `409` |

## Fixtures

| File | When |
|---|---|
| `weather-current-fresh-200.json` | Weather `200`, `cache_state=fresh` |
| `weather-current-stale-200.json` | Weather `200`, `cache_state=stale` |
| `ndvi-latest-200.json` | NDVI GET/POST success body |

NDVI is not a 13th telemetry field. Polygon/history NDVI is deferred.

OpenAPI now includes these weather and NDVI paths; this directory remains the frozen 200-body source of truth.
