import { api } from "./api";

/**
 * Claves de las tarjetas/bloques configurables del dashboard de cliente.
 * El backend valida exactamente este conjunto de claves.
 */
export const DASHBOARD_CARD_KEYS = [
  "priority.humidity",
  "priority.flow",
  "priority.eto",
  "irrigation.status",
  "soil.details",
  "soil.chart",
  "environmental.details",
  "sources.external",
] as const;

export type DashboardCardKey = (typeof DASHBOARD_CARD_KEYS)[number];

/** Etiqueta en español de cada tarjeta, usada por la pantalla admin. */
export const DASHBOARD_CARD_LABELS: Record<DashboardCardKey, string> = {
  "priority.humidity": "Humedad del Suelo",
  "priority.flow": "Flujo de Agua",
  "priority.eto": "E.T.O.",
  "irrigation.status": "Estado del Riego",
  "soil.details": "Suelo",
  "soil.chart": "Gráfica de humedad (últimas 12 lecturas)",
  "environmental.details": "Ambiental",
  "sources.external": "Fuentes externas",
};

/**
 * Preferencias de dashboard de un cliente.
 * `cards: null` significa "sin configurar" (el dashboard aplica la regla automática).
 */
export interface DashboardPreferences {
  client_id: number;
  cards: DashboardCardKey[] | null;
}

export async function getClientDashboardPreferences(
  clientId: number,
): Promise<DashboardPreferences> {
  const response = await api.get<DashboardPreferences>(
    `/clients/${clientId}/dashboard-preferences`,
  );
  return response.data;
}

export async function updateClientDashboardPreferences(
  clientId: number,
  cards: DashboardCardKey[] | null,
): Promise<DashboardPreferences> {
  const response = await api.put<DashboardPreferences>(
    `/clients/${clientId}/dashboard-preferences`,
    { cards },
  );
  return response.data;
}

export async function getMyDashboardPreferences(): Promise<DashboardPreferences> {
  const response = await api.get<DashboardPreferences>(
    "/clients/me/dashboard-preferences",
  );
  return response.data;
}
