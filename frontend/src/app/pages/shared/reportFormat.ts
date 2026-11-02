import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Clock, Loader2, type LucideIcon } from "lucide-react";
import type { AIReportItem, AIReportStatus } from "../../services/aiReports";
import { parseBackendTimestamp } from "../../utils/datetime";

/** Estado del reporte con nombre, icono y colores con contraste (nunca solo color). */
export const REPORT_STATUS: Record<AIReportStatus, { label: string; icon: LucideIcon; text: string; bg: string; spin?: boolean; note?: string }> = {
  pending: { label: "Pendiente", icon: Clock, text: "text-[var(--status-info-text)]", bg: "bg-[var(--status-info-bg)]", note: "El reporte está en cola. Vuelve a consultar en unos minutos." },
  processing: { label: "Generándose", icon: Loader2, spin: true, text: "text-[var(--status-warning-text)]", bg: "bg-[var(--status-warning-bg)]", note: "El reporte se está generando. Vuelve a consultar en unos minutos." },
  completed: { label: "Listo", icon: CheckCircle2, text: "text-[var(--status-active-text)]", bg: "bg-[var(--status-active-bg)]" },
  failed: { label: "No se pudo generar", icon: AlertTriangle, text: "text-[var(--status-danger-text)]", bg: "bg-[var(--status-danger-bg)]" },
};

/** «25 oct – 1 nov 2026» (o «25 oct 2026» si es un solo día). */
export function describePeriod(startIso: string, endIso: string): string {
  const start = parseBackendTimestamp(startIso);
  const end = parseBackendTimestamp(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  if (sameDay) return format(start, "d MMM yyyy", { locale: es });
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, sameYear ? "d MMM" : "d MMM yyyy", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
}

export function formatDateTime(iso: string | null): string | null {
  const parsed = parseBackendTimestamp(iso);
  return parsed ? format(parsed, "dd/MM/yyyy HH:mm") : null;
}

/** Texto corto del reporte para la lista; nunca se inventa contenido. */
export function summaryText(item: Pick<AIReportItem, "summary" | "status" | "error_detail">): string {
  if (item.summary?.trim()) return item.summary;
  if (item.status === "failed") return item.error_detail?.trim() || "No se pudo generar este reporte.";
  if (item.status === "pending" || item.status === "processing") return "Aún se está generando.";
  return "Este reporte no trae resumen.";
}
