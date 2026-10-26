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

interface GatewayStatusBadgeProps {
  status?: string | null;
  edgeStatus?: string | null;
}

export function GatewayStatusBadge({ status, edgeStatus }: GatewayStatusBadgeProps) {
  const key = (edgeStatus || status || "").toLowerCase();
  const label = LABELS[key] ?? "Equipo sin estado";
  return (
    <span
      className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
      data-testid="gateway-status-badge"
    >
      {label}
    </span>
  );
}
