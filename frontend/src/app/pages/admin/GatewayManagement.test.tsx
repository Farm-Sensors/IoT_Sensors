import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
  provisionGateway: vi.fn().mockResolvedValue({
    data: { id: 10, property_id: 3, status: "pending_activation", configuration_version: 0, bindings_revision: 0, activated_at: null, revoked_at: null, slots: [] },
  }),
  issueActivationReference: vi.fn().mockResolvedValue({
    data: { activation_reference: "ar_once", expires_at: "2026-09-25T00:00:00Z" },
  }),
  publishConfiguration: vi.fn(),
}));

vi.mock("../../services/nodes", () => ({
  getGeoNodes: vi.fn().mockResolvedValue({
    data: [
      { irrigation_area_id: 16, name: "Nodo Nogal", serial_number: "mesh-DEMO01", is_active: true },
      { irrigation_area_id: 17, name: "Nodo Alfalfa", serial_number: "mesh-DEMO02", is_active: true },
      { irrigation_area_id: 18, name: null, serial_number: null, is_active: false },
    ],
  }),
}));

vi.mock("../../services/api", () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith("/properties")) {
        return Promise.resolve({ data: { data: [{ id: 3, client_id: 1, name: "Rancho Prueba" }] } });
      }
      if (path.startsWith("/clients")) {
        return Promise.resolve({ data: { data: [{ id: 1, company_name: "Rancho Prueba SA" }] } });
      }
      if (path.startsWith("/irrigation-areas")) {
        return Promise.resolve({
          data: {
            data: [
              { id: 16, property_id: 3, name: "Parcela Nogal", crop_type: { id: 1, name: "Nogal" } },
              { id: 17, property_id: 3, name: "Parcela Alfalfa", crop_type: { id: 2, name: "Alfalfa" } },
              { id: 18, property_id: 3, name: "Parcela Manzana", crop_type: { id: 3, name: "Manzana" } },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

const mockedProvisionGateway = vi.mocked(provisionGateway);

function renderPage() {
  return render(
    <MemoryRouter>
      <GatewayManagement />
    </MemoryRouter>,
  );
}

describe("GatewayManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the v2 gateway communication endpoints without credentials", async () => {
    renderPage();

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
    renderPage();
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

    renderPage();
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

  it("provisions every selected area in a single call", async () => {
    renderPage();
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Predio"), { target: { value: "3" } });

    const nogal = await screen.findByLabelText("Parcela Nogal");
    fireEvent.click(nogal);
    fireEvent.click(screen.getByLabelText("Parcela Alfalfa"));

    // An area without an active node cannot be selected.
    expect(screen.getByLabelText("Parcela Manzana")).toBeDisabled();
    expect(screen.getByText(/Sin nodo activo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /provisionar/i }));

    await waitFor(() => expect(mockedProvisionGateway).toHaveBeenCalledWith(3, [16, 17]));
    expect(showToast).toHaveBeenCalledWith("Gateway provisionado con 2 ranura(s)", "success");
  });

  it("surfaces a 422 from provisioning in a toast and inline", async () => {
    const detail = "el área no tiene un nodo lógico activo";
    mockedProvisionGateway.mockRejectedValueOnce({ response: { data: { detail } } });

    renderPage();
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Predio"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Parcela Nogal"));
    fireEvent.click(screen.getByRole("button", { name: /provisionar/i }));

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(detail, "error");
  });
});
