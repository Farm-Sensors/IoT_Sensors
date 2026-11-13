import { AREA_STATE_LABEL, formatAgo, minutesSince } from "../pages/client/overview/areaStatus";

/**
 * Una sola regla de precisión y unidad por magnitud, para todas las pantallas.
 * Un valor ausente (`null`) se muestra como «Sin datos», nunca como 0.
 */
export const NO_DATA = "Sin datos";

export const METRIC_FORMAT = {
  humidity: { decimals: 1, unit: "%" },
  flow: { decimals: 1, unit: "L/min" },
  liters: { decimals: 0, unit: "L" },
  eto: { decimals: 2, unit: "mm/día" },
  conductivity: { decimals: 2, unit: "dS/m" },
  temperature: { decimals: 1, unit: "°C" },
  waterPotential: { decimals: 2, unit: "MPa" },
  relativeHumidity: { decimals: 0, unit: "%" },
  wind: { decimals: 1, unit: "km/h" },
  solarRadiation: { decimals: 0, unit: "W/m²" },
} as const;

export type MetricKey = keyof typeof METRIC_FORMAT;

const hasValue = (value: number | null | undefined): value is number => value != null && Number.isFinite(value);

/** Solo la cifra con la precisión de su magnitud (`"40.0"`), o «Sin datos». */
export function formatMetricValue(key: MetricKey, value: number | null | undefined): string {
  if (!hasValue(value)) return NO_DATA;
  const fixed = value.toFixed(METRIC_FORMAT[key].decimals);
  // -0.0 se lee como un valor negativo inventado.
  return /^-0(\.0+)?$/.test(fixed) ? fixed.slice(1) : fixed;
}

/** La cifra con su unidad (`"40.0 %"`), o «Sin datos» sin unidad. */
export function formatMetric(key: MetricKey, value: number | null | undefined): string {
  if (!hasValue(value)) return NO_DATA;
  return `${formatMetricValue(key, value)} ${METRIC_FORMAT[key].unit}`;
}

/** Fecha y hora local, corta: «13/11 15:04» (es-MX). */
export function formatStamp(date: Date): string {
  const day = date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} ${time}`;
}

/**
 * Frescura con fecha, hora y tiempo transcurrido: «Último dato 13/11 15:04 · hace 12 min».
 * Sin ningún dato dice «Sin lecturas todavía» (nunca reportó), distinto de «Sin comunicación».
 */
export function formatFreshness(date: Date | null, now = Date.now()): string {
  if (!date) return AREA_STATE_LABEL.sin_datos;
  return `Último dato ${formatStamp(date)} · ${formatAgo(minutesSince(date, now))}`;
}
