import { AlertTriangle, Ban, CheckCircle2, Hourglass, type LucideIcon } from "lucide-react";
import { StatusBadge, type StatusTone } from "./StatusBadge";

const LABELS: Record<string, string> = {
  pending_activation: "Equipo pendiente de activación",
  active: "Equipo activo",
  revoked: "Equipo revocado",
  pending: "Equipo pendiente",
  connected: "Equipo conectado",
  delayed: "Equipo retrasado",
  disconnected: "Equipo desconectado",
  inactive: "Equipo pendiente",
  never_seen: "Equipo pendiente",
  recently_seen: "Equipo conectado",
  stale: "Equipo retrasado",
};

const TONES: Record<string, { tone: StatusTone; icon: LucideIcon }> = {
  active: { tone: "active", icon: CheckCircle2 },
  connected: { tone: "active", icon: CheckCircle2 },
  recently_seen: { tone: "active", icon: CheckCircle2 },
  delayed: { tone: "warning", icon: AlertTriangle },
  stale: { tone: "warning", icon: AlertTriangle },
  disconnected: { tone: "danger", icon: AlertTriangle },
  revoked: { tone: "neutral", icon: Ban },
};
const PENDING = { tone: "info" as StatusTone, icon: Hourglass };

interface GatewayStatusBadgeProps {
  status?: string | null;
  edgeStatus?: string | null;
}

export function GatewayStatusBadge({ status, edgeStatus }: GatewayStatusBadgeProps) {
  const key = (edgeStatus || status || "").toLowerCase();
  const label = LABELS[key] ?? "Equipo sin estado";
  const { tone, icon } = TONES[key] ?? PENDING;
  return (
    <span data-testid="gateway-status-badge">
      <StatusBadge tone={tone} icon={icon}>{label}</StatusBadge>
    </span>
  );
}
