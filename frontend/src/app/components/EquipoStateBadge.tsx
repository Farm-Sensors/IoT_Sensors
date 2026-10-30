import { AlertTriangle, Ban, CheckCircle2, Link2Off, LoaderCircle, type LucideIcon } from "lucide-react";
import { FRESH_MINUTES_THRESHOLD } from "../pages/client/dashboard/helpers";
import type { Gateway, GatewayStatus, GatewayStatusSlot } from "../services/gateways";
import { parseBackendTimestamp } from "../utils/datetime";
import { StatusBadge, type StatusTone } from "./StatusBadge";

export type EquipoState = "unlinked" | "assigning" | "working" | "stale" | "revoked";

/** Un área "tiene datos" si su nodo está asignado y reportó en los últimos minutos. */
export function slotHasRecentData(slot: GatewayStatusSlot, nowMs = Date.now()): boolean {
  if (slot.binding_status !== "confirmed") return false;
  const last = parseBackendTimestamp(slot.latest_reading_at);
  return Boolean(last) && nowMs - last!.getTime() < FRESH_MINUTES_THRESHOLD * 60_000;
}

export function areasWithData(status: GatewayStatus | null | undefined, nowMs = Date.now()): number {
  return status?.slots.filter((slot) => slotHasRecentData(slot, nowMs)).length ?? 0;
}

export function confirmedAreas(status: GatewayStatus | null | undefined): number {
  return status?.slots.filter((slot) => slot.binding_status === "confirmed").length ?? 0;
}

export function equipoState(
  gateway: Gateway,
  status: GatewayStatus | null | undefined,
  nowMs = Date.now(),
): EquipoState {
  if (gateway.status === "revoked") return "revoked";
  if (gateway.status === "pending_activation" || gateway.configuration_version === 0) {
    return "unlinked";
  }
  if (!status) return "stale";
  if (confirmedAreas(status) < gateway.slots.length) return "assigning";
  return areasWithData(status, nowMs) === gateway.slots.length ? "working" : "stale";
}

const STATES: Record<EquipoState, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  unlinked: { label: "Falta vincular", icon: Link2Off, tone: "warning" },
  assigning: { label: "Asignando nodos", icon: LoaderCircle, tone: "info" },
  working: { label: "Funcionando", icon: CheckCircle2, tone: "active" },
  stale: { label: "Sin datos recientes", icon: AlertTriangle, tone: "danger" },
  revoked: { label: "Revocado", icon: Ban, tone: "neutral" },
};

/** Estado del equipo para el admin: icono + texto + color (nunca solo color). */
export function EquipoStateBadge({ state }: { state: EquipoState }) {
  const { label, icon, tone } = STATES[state];
  return (
    <span data-testid="equipo-state">
      <StatusBadge tone={tone} icon={icon}>{label}</StatusBadge>
    </span>
  );
}
