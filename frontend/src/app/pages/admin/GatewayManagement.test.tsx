import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayManagement } from "./GatewayManagement";

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,demo") },
}));

vi.mock("../../services/gateways", () => ({
  listGateways: vi.fn().mockResolvedValue({
    data: [{ id: 7, property_id: 3, status: "pending_activation", configuration_version: 0, bindings_revision: 0, activated_at: null, revoked_at: null, slots: [] }],
  }),
  provisionGateway: vi.fn(),
  issueActivationReference: vi.fn().mockResolvedValue({
    data: { activation_reference: "ar_once", expires_at: "2026-09-25T00:00:00Z" },
  }),
  publishConfiguration: vi.fn(),
}));

describe("GatewayManagement", () => {
  it("shows the v2 gateway communication endpoints without credentials", async () => {
    render(<GatewayManagement />);

    expect(await screen.findByRole("heading", { name: "IoT_Sensors ↔ Agro.io" })).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/gateways/{gateway_id}/configuration")).toBeInTheDocument();
    expect(screen.getByText("GET /api/v1/gateways/me/configuration")).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/gateways/me/heartbeat")).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/readings")).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/ndvi-snapshots")).toBeInTheDocument();
    expect(screen.getByText(/X-API-Key del gateway, X-Logical-Node-Id y X-Event-ID/i)).toBeInTheDocument();
    expect(screen.getByText(/la clave nunca se muestra aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/nunca forma parte de la telemetría/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Documentación API/Swagger" })).toHaveAttribute("href", "/api/v1/docs");
  });

  it("shows gateway status and can reveal a one-time reference without keeping api keys", async () => {
    render(<GatewayManagement />);
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();
    expect(screen.getByTestId("gateway-status-badge")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /activación/i }));
    expect(await screen.findByTestId("one-time-secret")).toHaveTextContent("ar_once");
    expect(screen.queryByText(/api_key/i)).toBeNull();
  });
});
