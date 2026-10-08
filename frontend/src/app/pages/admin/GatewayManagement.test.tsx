import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayManagement } from "./GatewayManagement";
import { provisionGateway } from "../../services/gateways";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast }),
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

const mockedProvisionGateway = vi.mocked(provisionGateway);

describe("GatewayManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(screen.getByText(/nodo lógico activo/i)).toBeInTheDocument();
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

  it("shows the activation reference as visible text with its expiry and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<GatewayManagement />);
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /activación/i }));

    const reference = await screen.findByTestId("one-time-secret");
    expect(reference).toBeVisible();
    expect(reference).toHaveTextContent("ar_once");
    expect(screen.getByText(/Caduca el/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copiar referencia/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ar_once"));
    expect(showToast).toHaveBeenCalledWith("Referencia copiada", "success");
  });

  it("surfaces a 422 from provisioning in a toast and inline", async () => {
    const detail = "el área no tiene un nodo lógico activo";
    mockedProvisionGateway.mockRejectedValueOnce({ response: { data: { detail } } });

    render(<GatewayManagement />);
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("ID de predio"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("ID de área"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /provisionar/i }));

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(detail, "error");
  });
});
