import { api } from "./api";

export interface GatewaySlot {
  id?: number;
  irrigation_area_id: number;
  logical_node_id?: number;
  hardware_profile_id?: number | null;
}

export interface Gateway {
  id: number;
  property_id: number;
  status: string;
  configuration_version: number;
  bindings_revision: number;
  activated_at: string | null;
  revoked_at: string | null;
  slots: GatewaySlot[];
}

export interface GatewayStatus {
  gateway_id: number;
  status: string;
  edge_status: string;
  last_heartbeat_at: string | null;
  config_version: number;
  slots: Array<{
    logical_node_id: number;
    irrigation_area_id: number;
    binding_status: string;
    latest_reading_at?: string | null;
  }>;
}

export function listGateways() {
  return api.get<Gateway[]>("/gateways");
}

export function provisionGateway(propertyId: number, irrigationAreaId: number) {
  return api.post<Gateway>("/gateways", {
    property_id: propertyId,
    slots: [{ irrigation_area_id: irrigationAreaId }],
  });
}

export function issueActivationReference(gatewayId: number) {
  return api.post<{ activation_reference: string; expires_at: string }>(
    `/gateways/${gatewayId}/activation-references`,
  );
}

export function publishConfiguration(gatewayId: number) {
  return api.post(`/gateways/${gatewayId}/configuration`);
}

export function getPropertyGatewayStatus(propertyId: number) {
  return api.get<GatewayStatus>(`/properties/${propertyId}/gateway/status`);
}
