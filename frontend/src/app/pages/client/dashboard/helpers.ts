import type { ReadingResponse } from "../../../types/api";
import {
  DASHBOARD_CARD_KEYS,
  type DashboardCardKey,
} from "../../../services/dashboardPreferences";

export type PriorityKey = "soil.humidity" | "irrigation.flow_per_minute" | "environmental.eto";
export type SemaphoreLevel = "optimal" | "warning" | "critical" | null;

export type PriorityStatusItem = {
  parameter: string;
  level: SemaphoreLevel;
};

export const defaultSemaphore: Record<PriorityKey, SemaphoreLevel> = {
  "soil.humidity": null,
  "irrigation.flow_per_minute": null,
  "environmental.eto": null,
};

// Intervalo de auto-refresco del dashboard: 30s
export const DASHBOARD_REFRESH_MS = 30000;
export const FRESH_MINUTES_THRESHOLD = 20;

export type ConnectionState = "online" | "warning" | "offline" | "no_data";
export type IrrigationDisplayState = "active" | "inactive" | "stale" | "no_data";

export function getConnectionState(lastUpdate: Date | null): ConnectionState {
  if (!lastUpdate) return "no_data";
  const minutesAgo = Math.max(0, Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)));
  if (minutesAgo < FRESH_MINUTES_THRESHOLD) return "online";
  if (minutesAgo < 120) return "warning";
  return "offline";
}

export function getIrrigationDisplayState(
  irrigationActive: boolean | null,
  connectionState: ConnectionState,
): IrrigationDisplayState {
  if (irrigationActive === null || connectionState === "no_data") return "no_data";
  if (connectionState !== "online") return "stale";
  return irrigationActive ? "active" : "inactive";
}

export function getIrrigationStatusLabel(state: IrrigationDisplayState): string {
  if (state === "active") return "ACTIVO";
  if (state === "inactive") return "INACTIVO";
  if (state === "no_data") return "SIN DATOS";
  return "SIN COMUNICACION";
}

export function getIrrigationStatusClass(state: IrrigationDisplayState): string {
  if (state === "active") return "text-[var(--accent-primary)]";
  if (state === "stale") return "text-[var(--status-warning)]";
  return "text-[var(--text-muted)]";
}

export function getSemaphoreLabel(level: SemaphoreLevel): string {
  if (level === null) return "Sin datos de umbral";
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Riesgo";
  return "Óptimo";
}

export function getSemaphoreClass(level: SemaphoreLevel): string {
  if (level === null) return "text-[var(--text-muted)]";
  if (level === "critical") return "bg-[var(--status-danger-bg)] text-[var(--status-danger)]";
  if (level === "warning") return "bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
  return "bg-[var(--status-active-bg)] text-[var(--status-active)]";
}

/**
 * Dependencia de datos de cada tarjeta: la tarjeta automática se muestra solo si
 * al menos uno de sus campos viene en la última lectura (los campos ausentes son `null`).
 */
const CARD_DATA_CHECKS: Record<DashboardCardKey, (reading: ReadingResponse | null) => boolean> = {
  "priority.humidity": (reading) => reading?.soil?.humidity != null,
  "priority.flow": (reading) => reading?.irrigation?.flow_per_minute != null,
  "priority.eto": (reading) => reading?.environmental?.eto != null,
  "irrigation.status": (reading) => reading?.irrigation?.active != null,
  "soil.details": (reading) =>
    [reading?.soil?.conductivity, reading?.soil?.temperature, reading?.soil?.water_potential].some(
      (value) => value != null,
    ),
  "soil.chart": (reading) => reading?.soil?.humidity != null,
  "environmental.details": (reading) =>
    [
      reading?.environmental?.temperature,
      reading?.environmental?.relative_humidity,
      reading?.environmental?.wind_speed,
      reading?.environmental?.solar_radiation,
    ].some((value) => value != null),
  "sources.external": () => true,
};

/**
 * Resuelve qué tarjetas del dashboard deben mostrarse.
 * Con `cards` explícitas se muestra exactamente esa selección; con `null`
 * (sin configurar, o si la consulta de preferencias falló) se aplica la regla
 * automática: solo las tarjetas cuyo dato exista en la última lectura.
 */
export function resolveVisibleCards(
  cards: DashboardCardKey[] | null,
  reading: ReadingResponse | null,
): Set<DashboardCardKey> {
  if (cards !== null) return new Set(cards);
  return new Set(DASHBOARD_CARD_KEYS.filter((key) => CARD_DATA_CHECKS[key](reading)));
}
