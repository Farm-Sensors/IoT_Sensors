import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

/** Cuántas áreas de un cliente o predio están al día, no se comunican o les falta configurar algo. */
export interface Health { total: number; ok: number; stale: number; setup: number }

export const EMPTY_HEALTH: Health = { total: 0, ok: 0, stale: 0, setup: 0 };

/** Texto de salud: lo más grave primero («2 sin comunicación»), luego lo que falta configurar. */
export function healthLabel(h: Health): { text: string; tone: "ok" | "bad" | "setup" | "none" } {
  if (h.total === 0) return { text: "Sin áreas", tone: "none" };
  if (h.stale > 0) return { text: `${h.stale} sin comunicación`, tone: "bad" };
  if (h.setup > 0) return { text: `${h.setup} por configurar`, tone: "setup" };
  return { text: "Todo al día", tone: "ok" };
}

/** Indicador de salud con ícono y texto (nunca solo color). */
export function HealthBadge({ health }: { health?: Health }) {
  const { text, tone } = healthLabel(health ?? EMPTY_HEALTH);
  const color = tone === "bad" ? "var(--status-danger-text)" : tone === "ok" ? "var(--status-success-solid)" : "var(--text-muted)";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold" style={{ color }}>
      {tone === "ok" ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : tone === "none" ? null : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
      {text}
    </span>
  );
}

/** Ubicación legible: unas coordenadas en crudo no se muestran como si fueran un lugar. */
export function placeLabel(location: string | null | undefined): string {
  const value = location?.trim();
  if (!value) return "Sin ubicación registrada";
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(value) ? "Ubicado por coordenadas" : value;
}

/** Botones de acción del panel (alto táctil de 44 px, mismo estilo en todos los niveles). */
export const panelButton = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] px-4 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
export const panelButtonPrimary = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";
export const panelButtonDanger = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--status-danger)]/40 bg-[var(--card)] px-4 text-sm font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Cabecera única de cada nivel: qué es, cómo está y qué se puede hacer. */
export function PanelHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{title}</h2>
        {meta && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Fila navegable de una lista (cliente, predio o área): toda la fila lleva al detalle. */
export const rowLink = "flex max-sm:flex-wrap min-h-[64px] items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]";
export const listBox = "divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]";
