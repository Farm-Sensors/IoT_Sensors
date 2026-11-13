import { FRESH_MINUTES_THRESHOLD } from "../dashboard/helpers";

/** Estado de los DATOS de un área (nunca una recomendación de riego: eso requiere umbrales, de Fase 2). */
export type AreaState = "al_dia" | "sin_comunicacion" | "sin_datos" | "sin_nodo";

export const AREA_STATE_LABEL: Record<AreaState, string> = {
  al_dia: "Al día",
  sin_comunicacion: "Sin comunicación",
  sin_datos: "Sin lecturas todavía",
  sin_nodo: "Sin nodo",
};

export const AREA_STATE_ORDER: AreaState[] = ["al_dia", "sin_comunicacion", "sin_datos", "sin_nodo"];

export function minutesSince(lastUpdate: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - lastUpdate.getTime()) / 60000));
}

/** Mismo umbral que `FreshnessIndicator` y el backend: menos de 20 min es «al día». */
export function areaState(hasNode: boolean, lastUpdate: Date | null, now = Date.now()): AreaState {
  if (!hasNode) return "sin_nodo";
  if (!lastUpdate) return "sin_datos";
  return minutesSince(lastUpdate, now) < FRESH_MINUTES_THRESHOLD ? "al_dia" : "sin_comunicacion";
}

export function formatAgo(minutes: number): string {
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
  }
  const d = Math.floor(minutes / 1440);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

export interface SeriesPoint {
  t: Date;
  humidity: number | null;
  flow: number | null;
}

export interface OverviewSummary {
  reporting: number;
  total: number;
  avgHumidity: number | null;
  flowNow: number | null;
  /** Áreas al día con el riego encendido (`irrigation.active === true`). */
  irrigating: number;
  /** Áreas al día que sí informan si riegan; un `null` es «Sin datos», nunca «apagado». */
  irrigationKnown: number;
  avgEto: number | null;
  attention: number;
  counts: Record<AreaState, number>;
}

interface SummaryInput {
  state: AreaState;
  humidity: number | null;
  flow: number | null;
  eto: number | null;
  irrigating: boolean | null;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Resume solo las áreas al día; un `null` nunca cuenta como 0. */
export function summarize(rows: SummaryInput[]): OverviewSummary {
  const counts: Record<AreaState, number> = { al_dia: 0, sin_comunicacion: 0, sin_datos: 0, sin_nodo: 0 };
  rows.forEach((r) => { counts[r.state] += 1; });
  const ok = rows.filter((r) => r.state === "al_dia");
  const flows = ok.map((r) => r.flow).filter((v): v is number => v !== null);
  return {
    reporting: ok.length,
    total: rows.length,
    avgHumidity: mean(ok.map((r) => r.humidity).filter((v): v is number => v !== null)),
    flowNow: flows.length ? flows.reduce((a, b) => a + b, 0) : null,
    irrigating: ok.filter((r) => r.irrigating === true).length,
    irrigationKnown: ok.filter((r) => r.irrigating !== null).length,
    avgEto: mean(ok.map((r) => r.eto).filter((v): v is number => v !== null)),
    attention: rows.length - ok.length,
    counts,
  };
}

/** Litros por hora de las últimas 24 h: L/min × intervalo entre lecturas (10 min). */
export const READING_INTERVAL_MIN = 10;

/** Una hora sin ninguna lectura de flujo queda en `null` (sin datos), nunca en 0 L. */
export function hourlyLiters(seriesByArea: SeriesPoint[][], now = Date.now()): { start: Date; liters: number | null }[] {
  const t0 = now - 24 * 3600_000;
  const buckets: { start: Date; liters: number | null }[] = Array.from({ length: 24 }, (_, i) => ({ start: new Date(t0 + i * 3600_000), liters: null }));
  seriesByArea.flat().forEach((p) => {
    if (p.flow === null) return;
    const k = Math.floor((p.t.getTime() - t0) / 3600_000);
    if (k >= 0 && k < 24) buckets[k].liters = (buckets[k].liters ?? 0) + p.flow * READING_INTERVAL_MIN;
  });
  return buckets;
}

/**
 * Humedad por hora de un predio: promedio de las lecturas no nulas de sus áreas en cada hora.
 * Una hora sin ninguna lectura no genera punto (nunca se rellena con 0).
 */
export function hourlyHumidity(seriesByArea: SeriesPoint[][], now = Date.now()): SeriesPoint[] {
  const t0 = now - 24 * 3600_000;
  const sums = Array.from({ length: 24 }, () => ({ total: 0, n: 0 }));
  seriesByArea.flat().forEach((p) => {
    if (p.humidity === null) return;
    const k = Math.floor((p.t.getTime() - t0) / 3600_000);
    if (k >= 0 && k < 24) { sums[k].total += p.humidity; sums[k].n += 1; }
  });
  return sums.flatMap((s, k) => (s.n ? [{ t: new Date(t0 + k * 3600_000), humidity: s.total / s.n, flow: null }] : []));
}

/** Texto de ubicación legible: unas coordenadas en crudo no se muestran como si fueran un lugar. */
export function locationLabel(location: string | null | undefined): string {
  const value = location?.trim();
  if (!value) return "Sin ubicación registrada";
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(value) ? "Ubicado por coordenadas" : value;
}
