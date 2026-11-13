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
  return "SIN COMUNICACIÓN";
}

export function getIrrigationStatusClass(state: IrrigationDisplayState): string {
  if (state === "active") return "text-[var(--accent-primary)]";
  if (state === "stale") return "text-[var(--status-warning-text)]";
  return "text-[var(--text-muted)]";
}

export function getSemaphoreLabel(level: SemaphoreLevel): string {
  if (level === null) return "Sin umbral definido";
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Riesgo";
  return "Óptimo";
}

export function getSemaphoreClass(level: SemaphoreLevel): string {
  if (level === null) return "text-[var(--text-muted)]";
  if (level === "critical") return "bg-[var(--status-danger-bg)] text-[var(--status-danger)]";
  if (level === "warning") return "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  return "bg-[var(--status-active-bg)] text-[var(--status-active-text)]";
}

/** Puntos porcentuales mínimos del eje Y de humedad: 12.90 vs 12.91 debe verse casi plano. */
export const HUMIDITY_AXIS_MIN_SPAN = 4;

/**
 * Rango del eje Y de la gráfica de humedad (%). Abarca los datos con al menos
 * `HUMIDITY_AXIS_MIN_SPAN` puntos centrados en ellos, recortado a 0–100 y con
 * extremos enteros. Sin datos medidos usa 0–100.
 */
export function getHumidityAxisDomain(values: ReadonlyArray<number | null>): [number, number] {
  const measured = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (measured.length === 0) return [0, 100];
  const min = Math.min(...measured);
  const max = Math.max(...measured);
  const span = Math.max(max - min, HUMIDITY_AXIS_MIN_SPAN);
  let low = (min + max) / 2 - span / 2;
  let high = low + span;
  if (low < 0) {
    high -= low;
    low = 0;
  }
  if (high > 100) {
    low = Math.max(0, low - (high - 100));
    high = 100;
  }
  return [Math.floor(low), Math.ceil(high)];
}

/**
 * Qué tarjetas muestra el dashboard sin configuración del admin. Los tres datos prioritarios,
 * el estado del riego y las tres categorías se muestran siempre: un campo que el nodo no envía
 * se lee «Sin datos», no desaparece (AGENTS.md §2.1–2.2). Solo la gráfica de humedad depende de
 * que haya humedad.
 */
const CARD_DATA_CHECKS: Record<DashboardCardKey, (reading: ReadingResponse | null) => boolean> = {
  "priority.humidity": () => true,
  "priority.flow": () => true,
  "priority.eto": () => true,
  "irrigation.status": () => true,
  "soil.details": () => true,
  "soil.chart": (reading) => reading?.soil?.humidity != null,
  "environmental.details": () => true,
  "sources.external": () => true,
};

/**
 * Resuelve qué tarjetas del dashboard deben mostrarse.
 * Con `cards` explícitas se muestra exactamente esa selección; con `null`
 * (sin configurar, o si la consulta de preferencias falló) se aplica la regla
 * automática de `CARD_DATA_CHECKS`.
 */
export function resolveVisibleCards(
  cards: DashboardCardKey[] | null,
  reading: ReadingResponse | null,
): Set<DashboardCardKey> {
  if (cards !== null) return new Set(cards);
  return new Set(DASHBOARD_CARD_KEYS.filter((key) => CARD_DATA_CHECKS[key](reading)));
}
