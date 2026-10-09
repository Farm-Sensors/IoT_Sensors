import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayDetail } from "./GatewayDetail";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getGateway: vi.fn(),
  getGatewayStatus: vi.fn(),
  publishConfiguration: vi.fn(),
  getGeoNodes: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../services/gateways", () => ({
  getGateway: mocks.getGateway,
  getGatewayStatus: mocks.getGatewayStatus,
  publishConfiguration: mocks.publishConfiguration,
}));

vi.mock("../../services/nodes", () => ({
  getGeoNodes: mocks.getGeoNodes,
}));

vi.mock("../../services/api", () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path === "/properties/11") {
        return Promise.resolve({ data: { id: 11, client_id: 3, name: "Rancho Prueba" } });
      }
      if (path === "/clients/3") {
        return Promise.resolve({ data: { id: 3, company_name: "Rancho Prueba SA" } });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/gateways/10"]}>
      <Routes>
        <Route path="/admin/gateways/:gatewayId" element={<GatewayDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GatewayDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGateway.mockResolvedValue({
      data: {
        id: 10,
        property_id: 11,
        status: "active",
        configuration_version: 1,
        bindings_revision: 8,
        activated_at: "2026-10-08T23:41:30Z",
        revoked_at: null,
        slots: [
          { id: 10, irrigation_area_id: 16, logical_node_id: 16 },
          { id: 11, irrigation_area_id: 17, logical_node_id: 17 },
        ],
      },
    });
    mocks.getGatewayStatus.mockResolvedValue({
      data: {
        gateway_id: 10,
        status: "recently_seen",
        edge_status: "connected",
        last_heartbeat_at: "2026-10-09T00:06:57Z",
        config_version: 1,
        slots: [
          {
            logical_node_id: 16,
            irrigation_area_id: 16,
            binding_status: "confirmed",
            latest_reading_at: "2026-10-09T00:09:00Z",
            bound_uid: "mesh-DEMO01",
            bound_serial: "mesh-DEMO01",
          },
          {
            logical_node_id: 17,
            irrigation_area_id: 17,
            binding_status: "unbound",
            latest_reading_at: null,
            bound_uid: null,
            bound_serial: null,
          },
        ],
      },
    });
    mocks.getGeoNodes.mockResolvedValue({
      data: [
        { irrigation_area_id: 16, irrigation_area_name: "Parcela Nogal", name: "Nodo Nogal", serial_number: "mesh-DEMO01", is_active: true },
        { irrigation_area_id: 17, irrigation_area_name: "Parcela Alfalfa", name: "Nodo Alfalfa", serial_number: "mesh-DEMO02", is_active: true },
      ],
    });
  });

  it("shows the installation steps with their progress", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Gateway #10" })).toBeInTheDocument();
    expect(screen.getByText(/Rancho Prueba · Rancho Prueba SA/)).toBeInTheDocument();

    const steps = screen.getByRole("list");
    expect(within(steps).getByText("1. Predio provisionado")).toBeInTheDocument();
    expect(within(steps).getByText("2. Configuración publicada")).toBeInTheDocument();
    expect(within(steps).getByText("Versión 1")).toBeInTheDocument();
    expect(within(steps).getByText("3. Credencial vinculada")).toBeInTheDocument();
    expect(within(steps).getByText("4. Nodos enlazados")).toBeInTheDocument();
    expect(within(steps).getByText("1 de 2 ranura(s) confirmadas")).toBeInTheDocument();

    // Connectivity badge comes from the live status, not from the management state.
    expect(screen.getByText("Gateway conectado")).toBeInTheDocument();
  });

  it("lists every slot with its area, node, binding and identity", async () => {
    renderPage();

    const confirmedRow = await screen.findByRole("row", { name: /Parcela Nogal/ });
    expect(within(confirmedRow).getByText("Nodo Nogal")).toBeInTheDocument();
    expect(within(confirmedRow).getByText("Confirmado")).toBeInTheDocument();
    expect(within(confirmedRow).getAllByText("mesh-DEMO01").length).toBeGreaterThan(0);

    const unboundRow = screen.getByRole("row", { name: /Parcela Alfalfa/ });
    expect(within(unboundRow).getByText("Nodo Alfalfa")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Sin enlazar")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Sin lecturas")).toBeInTheDocument();
  });
});
