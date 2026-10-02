const LABELS: Record<string, string> = {
  pending_activation: "Gateway pendiente de activación",
  active: "Gateway activo",
  revoked: "Gateway revocado",
  pending: "Gateway pendiente",
  connected: "Gateway conectado",
  delayed: "Gateway retrasado",
  disconnected: "Gateway desconectado",
  inactive: "Gateway pendiente",
  never_seen: "Gateway pendiente",
  recently_seen: "Gateway conectado",
  stale: "Gateway retrasado",
};

interface GatewayStatusBadgeProps {
  status?: string | null;
  edgeStatus?: string | null;
}

export function GatewayStatusBadge({ status, edgeStatus }: GatewayStatusBadgeProps) {
  const key = (edgeStatus || status || "").toLowerCase();
  const label = LABELS[key] ?? "Gateway sin estado";
  return (
    <span
      className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
      data-testid="gateway-status-badge"
    >
      {label}
    </span>
  );
}
