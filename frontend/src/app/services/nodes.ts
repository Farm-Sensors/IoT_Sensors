import { api } from "./api";

export interface GeoNode {
  id: number;
  irrigation_area_id: number;
  irrigation_area_name: string;
  property_id: number;
  property_name: string;
  client_id: number;
  client_company_name: string;
  crop_type_id: number;
  crop_type_name: string;
  serial_number: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  last_reading_timestamp: string | null;
  minutes_since_last_reading: number | null;
  freshness_status: "fresh" | "stale" | "no_data";
}

interface GeoNodesResponse {
  page: number;
  per_page: number;
  total: number;
  data: GeoNode[];
}

export interface GeoNodesFilters {
  page?: number;
  per_page?: number;
  client_id?: number;
  property_id?: number;
  irrigation_area_id?: number;
  include_without_coordinates?: boolean;
}

export async function getGeoNodes(filters: GeoNodesFilters = {}): Promise<GeoNodesResponse> {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.per_page !== undefined) params.set("per_page", String(filters.per_page));
  if (filters.client_id !== undefined) params.set("client_id", String(filters.client_id));
  if (filters.property_id !== undefined) params.set("property_id", String(filters.property_id));
  if (filters.irrigation_area_id !== undefined) {
    params.set("irrigation_area_id", String(filters.irrigation_area_id));
  }
  if (filters.include_without_coordinates !== undefined) {
    params.set("include_without_coordinates", String(filters.include_without_coordinates));
  }

  const query = params.toString();
  const endpoint = query ? `/nodes/geo?${query}` : "/nodes/geo";
  const { data } = await api.get<GeoNodesResponse>(endpoint);
  return data;
}
