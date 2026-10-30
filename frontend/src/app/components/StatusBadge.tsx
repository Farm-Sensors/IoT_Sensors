import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

export type StatusTone = "active" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<StatusTone, { bg: string; icon: string }> = {
  active: { bg: "bg-[var(--status-active-bg)]", icon: "text-[var(--status-active)]" },
  warning: { bg: "bg-[var(--status-warning-bg)]", icon: "text-[var(--status-warning)]" },
  danger: { bg: "bg-[var(--status-danger-bg)]", icon: "text-[var(--status-danger)]" },
  info: { bg: "bg-[var(--status-info-bg)]", icon: "text-[var(--status-info)]" },
  neutral: { bg: "bg-[var(--card-sand)]", icon: "text-[var(--text-muted)]" },
};

interface StatusBadgeProps {
  tone: StatusTone;
  icon: LucideIcon;
  children: ReactNode;
}

/** Estado con icono + texto + color: nunca se comunica solo con color. */
export function StatusBadge({ tone, icon: Icon, children }: StatusBadgeProps) {
  const { bg, icon } = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-main)] ${bg}`}
    >
      <Icon aria-hidden="true" className={`h-3.5 w-3.5 flex-shrink-0 ${icon}`} />
      {children}
    </span>
  );
}
