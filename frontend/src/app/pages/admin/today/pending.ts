import type { GeoNode } from "../../../services/nodes";

export type PendingKind = "sin_comunicacion" | "equipo_sin_conexion" | "sin_datos" | "sin_nodo" | "sin_ciclo" | "equipo_por_vincular";

export interface PendingItem {
  key: string;
  kind: PendingKind;
  title: string;
  context: string;
  detail: string;
  to: string;
  /** Lo que ocurre al tocar el renglón: «Crear ciclos», «Ver área»… */
  action: string;
  /** Predio al que pertenece. */
  propertyId?: number;
  /** Solo en los problemas de datos: el cliente afectado, dónde está y desde cuándo. */
  client?: string;
  place?: string;
  since?: string;
  /** Minutos sin datos, para ordenar del más antiguo al más reciente. */
  minutes?: number;
  /** Cuántas áreas abarca el renglón (un predio con 4 áreas sin ciclo cuenta 4). */
  count?: number;
}

export const PENDING_LABEL: Record<PendingKind, string> = {
  sin_comunicacion: "Sin comunicación",
  equipo_sin_conexion: "Equipo sin conexión",
  sin_datos: "Sin lecturas todavía",
  sin_nodo: "Sin nodo",
  sin_ciclo: "Sin ciclo de cultivo",
  equipo_por_vincular: "Equipo por vincular",
};

export const PENDING_ORDER: PendingKind[] = ["sin_comunicacion", "equipo_sin_conexion", "sin_datos", "sin_nodo", "sin_ciclo", "equipo_por_vincular"];

interface AreaLite { id: number; property_id: number; name: string }
interface PropertyLite { id: number; client_id: number; name: string }
interface ClientLite { id: number; company_name: string }
interface CycleLite { irrigation_area_id: number; end_date: string | null }
interface GatewayLite {
  id: number; property_id?: number; status: string; property_name: string; client_name: string; property_deleted: boolean;
  /** Estado de conexión del equipo activo (`/gateways/{id}/status`): never_seen, recently_seen, stale, disconnected. */
  connection?: string | null;
  last_heartbeat_minutes?: number | null;
}

export interface PendingInput {
  areas: AreaLite[];
  properties: PropertyLite[];
  clients: ClientLite[];
  nodes: GeoNode[];
  cycles: CycleLite[];
  gateways: GatewayLite[];
  /** `yyyy-MM-dd` de hoy: un ciclo está activo si no tiene fin o su fin es hoy o futuro. */
  today: string;
  formatAgo: (minutes: number) => string;
}

/**
 * Pendientes del admin derivados de datos que ya existen (sin endpoints nuevos).
 * Son problemas de datos y de configuración, nunca consejos de riego.
 */
export function buildPending(input: PendingInput): PendingItem[] {
  const { areas, properties, clients, nodes, cycles, gateways, today, formatAgo } = input;
  const nodeByArea = new Map(nodes.map((n) => [n.irrigation_area_id, n]));
  const activeCycle = new Set(cycles.filter((c) => c.end_date === null || c.end_date >= today).map((c) => c.irrigation_area_id));
  const items: PendingItem[] = [];
  const clientOf = (propertyId: number) => clients.find((c) => c.id === properties.find((p) => p.id === propertyId)?.client_id)?.company_name ?? "";
  const propertyOf = (propertyId: number) => properties.find((p) => p.id === propertyId)?.name ?? "";

  for (const area of areas) {
    const node = nodeByArea.get(area.id);
    const base = { propertyId: area.property_id, title: area.name, context: [clientOf(area.property_id), propertyOf(area.property_id)].filter(Boolean).join(" · "), to: `/admin/areas/${area.id}?tab=nodo` };
    const who = { client: clientOf(area.property_id), place: [propertyOf(area.property_id), area.name].filter(Boolean).join(" · ") };
    if (!node) {
      items.push({ ...base, key: `nodo-${area.id}`, kind: "sin_nodo", detail: "Aún no tiene un nodo registrado.", action: "Registrar nodo" });
    } else if (node.freshness_status === "no_data" || node.minutes_since_last_reading === null) {
      items.push({ ...base, ...who, key: `datos-${area.id}`, kind: "sin_datos", detail: "El nodo no ha enviado ninguna lectura.", since: "sin lecturas", minutes: Number.MAX_SAFE_INTEGER, action: "Ver nodo" });
    } else if (node.freshness_status === "stale") {
      items.push({ ...base, ...who, key: `com-${area.id}`, kind: "sin_comunicacion", detail: `Último dato ${formatAgo(node.minutes_since_last_reading)}.`, since: formatAgo(node.minutes_since_last_reading), minutes: node.minutes_since_last_reading, action: "Ver área" });
    }
  }

  // Las áreas sin ciclo se agrupan por predio: cuatro áreas del mismo predio son un solo pendiente.
  const withoutCycle = areas.filter((a) => !activeCycle.has(a.id));
  for (const propertyId of Array.from(new Set(withoutCycle.map((a) => a.property_id)))) {
    const list = withoutCycle.filter((a) => a.property_id === propertyId);
    const single = list.length === 1;
    items.push({
      key: `ciclo-p${propertyId}`,
      propertyId,
      kind: "sin_ciclo",
      title: single ? list[0].name : propertyOf(propertyId),
      context: single ? [clientOf(propertyId), propertyOf(propertyId)].filter(Boolean).join(" · ") : clientOf(propertyId),
      detail: single ? "No tiene un ciclo de cultivo activo." : `${list.length} áreas sin ciclo de cultivo activo.`,
      to: single ? `/admin/areas/${list[0].id}?tab=ciclos` : `/admin/predios/${propertyId}/areas`,
      action: single ? "Crear ciclo" : "Crear ciclos",
      count: list.length,
    });
  }

  for (const gateway of gateways) {
    if (gateway.status === "active") {
      // Un equipo vinculado que dejó de reportarse (o nunca lo hizo) es un problema aunque sus áreas tengan datos viejos.
      if (gateway.connection === "stale" || gateway.connection === "disconnected" || gateway.connection === "never_seen") {
        const never = gateway.connection === "never_seen" || gateway.last_heartbeat_minutes == null;
        items.push({
          key: `conexion-${gateway.id}`,
          propertyId: gateway.property_id,
          kind: "equipo_sin_conexion",
          title: gateway.property_name,
          context: gateway.client_name,
          client: gateway.client_name,
          place: `Equipo del predio ${gateway.property_name}`,
          detail: never ? "El equipo está vinculado pero nunca se ha reportado." : `El equipo no se reporta desde ${formatAgo(gateway.last_heartbeat_minutes!)}.`,
          since: never ? "nunca se ha reportado" : formatAgo(gateway.last_heartbeat_minutes!),
          minutes: never ? Number.MAX_SAFE_INTEGER : gateway.last_heartbeat_minutes!,
          to: `/admin/gateways/${gateway.id}`,
          action: "Ver equipo",
        });
      }
      continue;
    }
    if (gateway.status === "revoked") continue;
    items.push({
      key: `equipo-${gateway.id}`,
      propertyId: gateway.property_id,
      kind: "equipo_por_vincular",
      title: `${gateway.property_name}${gateway.property_deleted ? " (predio eliminado)" : ""}`,
      context: gateway.client_name,
      detail: "El equipo está preparado pero aún no se vincula.",
      to: `/admin/gateways/${gateway.id}`,
      action: "Vincular",
    });
  }

  // Primero lo que afecta al cliente; dentro de cada tipo, lo que lleva más tiempo sin datos.
  return items.sort((a, b) => PENDING_ORDER.indexOf(a.kind) - PENDING_ORDER.indexOf(b.kind) || (b.minutes ?? 0) - (a.minutes ?? 0));
}

export interface AreaSummary { total: number; al_dia: number; sin_comunicacion: number; sin_datos: number; sin_nodo: number; sin_ciclo: number }

/** Cuántas áreas hay en cada estado de datos y cuántas no tienen un ciclo de cultivo activo. */
export function summarizeAreas(input: Pick<PendingInput, "areas" | "nodes" | "cycles" | "today">): AreaSummary {
  const nodeByArea = new Map(input.nodes.map((n) => [n.irrigation_area_id, n]));
  const activeCycle = new Set(input.cycles.filter((c) => c.end_date === null || c.end_date >= input.today).map((c) => c.irrigation_area_id));
  const out: AreaSummary = { total: input.areas.length, al_dia: 0, sin_comunicacion: 0, sin_datos: 0, sin_nodo: 0, sin_ciclo: 0 };
  for (const area of input.areas) {
    const node = nodeByArea.get(area.id);
    if (!node) out.sin_nodo += 1;
    else if (node.freshness_status === "no_data" || node.minutes_since_last_reading === null) out.sin_datos += 1;
    else if (node.freshness_status === "stale") out.sin_comunicacion += 1;
    else out.al_dia += 1;
    if (!activeCycle.has(area.id)) out.sin_ciclo += 1;
  }
  return out;
}
