import { AlertTriangle, Info, OctagonAlert, type LucideIcon } from "lucide-react";
import type { AlertItem } from "../../services/alerts";

/** Gravedad con nombre en español, icono y colores de texto/fondo con contraste (nunca solo color). */
export const SEVERITY_META: Record<AlertItem["severity"], { label: string; icon: LucideIcon; text: string; bg: string; bar: string }> = {
  critical: { label: "Crítica", icon: OctagonAlert, text: "text-[var(--status-danger-text)]", bg: "bg-[var(--status-danger-bg)]", bar: "bg-[var(--status-danger-text)]" },
  warning: { label: "Aviso", icon: AlertTriangle, text: "text-[var(--status-warning-text)]", bg: "bg-[var(--status-warning-bg)]", bar: "bg-[var(--status-warning-text)]" },
  info: { label: "Información", icon: Info, text: "text-[var(--status-info-text)]", bg: "bg-[var(--status-info-bg)]", bar: "bg-[var(--status-info-text)]" },
};

export const TYPE_LABEL: Record<AlertItem["type"], string> = {
  threshold: "Umbral",
  inactivity: "Sin datos",
};

/** Nombre en español y unidad de cada medición (la clave interna nunca se muestra). */
const PARAMETERS: Record<string, { label: string; unit: string }> = {
  "soil.conductivity": { label: "Conductividad del suelo", unit: "dS/m" },
  "soil.temperature": { label: "Temperatura del suelo", unit: "°C" },
  "soil.humidity": { label: "Humedad del suelo", unit: "%" },
  "soil.water_potential": { label: "Potencial hídrico", unit: "MPa" },
  "irrigation.active": { label: "Riego activo", unit: "" },
  "irrigation.accumulated_liters": { label: "Litros acumulados", unit: "L" },
  "irrigation.flow_per_minute": { label: "Flujo de agua", unit: "L/min" },
  "environmental.temperature": { label: "Temperatura ambiente", unit: "°C" },
  "environmental.relative_humidity": { label: "Humedad relativa", unit: "%" },
  "environmental.wind_speed": { label: "Viento", unit: "km/h" },
  "environmental.solar_radiation": { label: "Radiación solar", unit: "W/m²" },
  "environmental.eto": { label: "E.T.O.", unit: "mm/día" },
};

export function parameterLabel(parameter: string | null): string | null {
  if (!parameter) return null;
  return PARAMETERS[parameter]?.label ?? null;
}

/** «Humedad del suelo 6,1 %»; `null` si la alerta no trae medición (p. ej. sin datos): nunca se inventa un 0. */
export function describeReading(alert: Pick<AlertItem, "parameter" | "detected_value">): string | null {
  const meta = alert.parameter ? PARAMETERS[alert.parameter] : null;
  if (!meta || alert.detected_value === null) return null;
  const value = alert.detected_value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return `${meta.label} ${value}${meta.unit ? ` ${meta.unit}` : ""}`;
}

/** Valor con su unidad, para el detalle. */
export function formatValue(alert: Pick<AlertItem, "parameter" | "detected_value">): string | null {
  const meta = alert.parameter ? PARAMETERS[alert.parameter] : null;
  if (alert.detected_value === null) return null;
  const value = alert.detected_value.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return meta?.unit ? `${value} ${meta.unit}` : value;
}

/** Mediciones agrupadas para los selectores (la clave interna nunca se muestra). */
export const PARAMETER_GROUPS: Array<{ group: string; items: Array<{ value: string; label: string; unit: string }> }> = [
  { group: "Suelo", items: ["soil.humidity", "soil.temperature", "soil.conductivity", "soil.water_potential"].map((value) => ({ value, ...PARAMETERS[value] })) },
  { group: "Riego", items: ["irrigation.flow_per_minute", "irrigation.accumulated_liters", "irrigation.active"].map((value) => ({ value, ...PARAMETERS[value] })) },
  { group: "Ambiente", items: ["environmental.eto", "environmental.temperature", "environmental.relative_humidity", "environmental.wind_speed", "environmental.solar_radiation"].map((value) => ({ value, ...PARAMETERS[value] })) },
];

export function parameterUnit(parameter: string): string {
  return PARAMETERS[parameter]?.unit ?? "";
}
