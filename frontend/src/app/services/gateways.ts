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

export interface PairingDevice {
  hostname: string | null;
  model: string | null;
  agent_version: string | null;
}

export interface PairingSession {
  session_id: string;
  user_code: string;
  status: string;
  requested_at: string;
  expires_at: string;
  device: PairingDevice;
  source_network?: string | null;
}

export interface PairingApprovalRequest {
  user_code: string;
  gateway_id: number;
  confirm: true;
  replace_credential?: boolean;
}

export interface PairingApproval {
  session_id: string;
  status: string;
  gateway_id: number;
  property_id: number;
}

export interface PairingDenial {
  session_id: string;
  status: string;
}

export function lookupPairing(userCode: string) {
  return api.post<PairingSession>("/gateways/pairing-sessions/lookup", {
    user_code: userCode,
  });
}

export function approvePairing(sessionId: string, payload: PairingApprovalRequest) {
  return api.post<PairingApproval>(
    `/gateways/pairing-sessions/${sessionId}/approve`,
    payload,
  );
}

export function denyPairing(sessionId: string, userCode: string) {
  return api.post<PairingDenial>(`/gateways/pairing-sessions/${sessionId}/deny`, {
    user_code: userCode,
  });
}
