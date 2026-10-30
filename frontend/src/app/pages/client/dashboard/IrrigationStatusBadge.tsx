import { AlertTriangle, CircleHelp, Droplets, Pause, type LucideIcon } from "lucide-react";
import { StatusBadge, type StatusTone } from "../../../components/StatusBadge";
import type { IrrigationDisplayState } from "./helpers";

const STATES: Record<IrrigationDisplayState, { tone: StatusTone; icon: LucideIcon }> = {
  active: { tone: "active", icon: Droplets },
  inactive: { tone: "neutral", icon: Pause },
  stale: { tone: "warning", icon: AlertTriangle },
  no_data: { tone: "neutral", icon: CircleHelp },
};

/** Estado del riego con icono + texto + color; el texto lo calcula `helpers.ts`. */
export function IrrigationStatusBadge({ state, label }: { state: IrrigationDisplayState; label: string }) {
  const { tone, icon } = STATES[state];
  return <StatusBadge tone={tone} icon={icon}>{label}</StatusBadge>;
}
