import { format, startOfDay, startOfMonth, startOfYear, subDays } from "date-fns";

export const QUICK_RANGES = ["Hoy", "Últimos 7 días", "Últimos 30 días", "Este mes", "Este año"] as const;
export type DateRangeMode = typeof QUICK_RANGES[number] | "Personalizado";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export function quickRangeDates(range: Exclude<DateRangeMode, "Personalizado">, now = new Date()) {
  const end = startOfDay(now);
  const start = range === "Hoy" ? end : range === "Este mes" ? startOfMonth(now) :
    range === "Este año" ? startOfYear(now) : subDays(end, range === "Últimos 30 días" ? 29 : 6);
  return { start, end };
}

// OpenAPI accepts calendar dates, not instants. Never shift a picked day via UTC getters.
export function dateParam(date: Date): string { return format(date, "yyyy-MM-dd"); }

/** Zona horaria del navegador (IANA): los días del filtro y las horas exportadas son locales a ella. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function readingQuery(areaId: number, start: Date, end: Date, cycleId?: number) {
  const params = new URLSearchParams({ irrigation_area_id: String(areaId), start_date: dateParam(start), end_date: dateParam(end), tz: browserTimeZone() });
  if (cycleId !== undefined) params.set("crop_cycle_id", String(cycleId));
  return params;
}
