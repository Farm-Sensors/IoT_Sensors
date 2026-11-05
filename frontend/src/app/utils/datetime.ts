const ISO_NAIVE_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;
const ISO_OFFSET_SUFFIX = /[+-]\d{2}:\d{2}$/;

/**
 * Appends `Z` to naive (timezone-less) backend timestamps so they parse as UTC.
 * Strings that already carry a timezone, plain dates (`YYYY-MM-DD`), or any
 * non-datetime text are returned untouched.
 */
export function normalizeTimestamp(value: string): string {
  if (value.endsWith("Z") || ISO_OFFSET_SUFFIX.test(value)) return value;
  if (!ISO_NAIVE_DATETIME.test(value)) return value;
  return `${value}Z`;
}

export function parseBackendTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(normalizeTimestamp(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Recursively normalizes naive backend datetimes inside API responses
 * (arrays and plain objects included). Never applied to user-authored text.
 */
export function normalizeBackendDates<T>(data: T): T {
  if (data == null) return data;

  if (typeof data === "string") {
    return normalizeTimestamp(data) as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizeBackendDates(item)) as T;
  }

  if (typeof data === "object" && data.constructor === Object) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeBackendDates(value);
    }
    return normalized as T;
  }

  return data;
}

/**
 * Formats the elapsed time since the last update, e.g. "Hace 2 h 30 min".
 */
export function formatElapsed(lastUpdate: Date | null): string {
  if (!lastUpdate) return "Sin datos";

  const minutesAgo = Math.max(0, Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60)));
  if (minutesAgo < 1) return "Ahora";
  if (minutesAgo < 60) return `Hace ${minutesAgo} min`;

  const hours = Math.floor(minutesAgo / 60);
  const minutes = minutesAgo % 60;
  if (hours < 24) {
    return minutes > 0 ? `Hace ${hours} h ${minutes} min` : `Hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "Hace 1 día" : `Hace ${days} días`;
}