import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as GatewaysModule from "../../services/gateways";
import { GatewayDetail } from "./GatewayDetail";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getGateway: vi.fn(),
  getGatewayStatus: vi.fn(),
  publishConfiguration: vi.fn(),
  getGeoNodes: vi.fn(),
  revokeGateway: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../services/gateways", async (importOriginal) => {
  const actual: typeof GatewaysModule = await importOriginal();
  return {
    ...actual,
    getGateway: mocks.getGateway,
    getGatewayStatus: mocks.getGatewayStatus,
    publishConfiguration: mocks.publishConfiguration,
    revokeGateway: mocks.revokeGateway,
  };
});

vi.mock("../../services/nodes", () => ({
  getGeoNodes: mocks.getGeoNodes,
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
        property_name: "Rancho Prueba",
        client_name: "Rancho Prueba SA",
        property_deleted: false,
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
        { irrigation_area_id: 16, irrigation_area_name: "Área Nogal", name: "Nodo Nogal", serial_number: "mesh-DEMO01", is_active: true },
        { irrigation_area_id: 17, irrigation_area_name: "Área Alfalfa", name: "Nodo Alfalfa", serial_number: "mesh-DEMO02", is_active: true },
      ],
    });
  });

  it("shows the installation steps with their progress", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Equipo #10" })).toBeInTheDocument();
    expect(screen.getByText(/Rancho Prueba · Rancho Prueba SA/)).toBeInTheDocument();

    const steps = screen.getByRole("list");
    expect(within(steps).getByText("1. Enlace creado")).toBeInTheDocument();
    expect(within(steps).getByText("Configuración lista (versión 1)")).toBeInTheDocument();
    expect(within(steps).getByText("2. Credencial vinculada")).toBeInTheDocument();
    expect(within(steps).getByText("3. Nodos enlazados")).toBeInTheDocument();
    expect(within(steps).getByText("1 de 2 área(s) confirmadas")).toBeInTheDocument();
    // La configuración ya está lista: no se ofrece publicarla de nuevo.
    expect(screen.queryByRole("button", { name: /configuración/i })).not.toBeInTheDocument();

    // Connectivity badge comes from the live status, not from the management state.
    expect(screen.getByText("Equipo conectado")).toBeInTheDocument();
  });

  it("offers to finish the configuration of a link created without it", async () => {
    mocks.getGateway.mockResolvedValue({
      data: {
        id: 10,
        property_id: 11,
        status: "pending_activation",
        configuration_version: 0,
        bindings_revision: 0,
        activated_at: null,
        revoked_at: null,
        property_name: "Rancho Prueba",
        client_name: "Rancho Prueba SA",
        property_deleted: false,
        slots: [{ id: 10, irrigation_area_id: 16, logical_node_id: 16 }],
      },
    });
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Dejar lista la configuración" }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("Falta dejar lista la configuración")).toBeInTheDocument();
  });

  it("lists every slot with its area, node, binding and identity", async () => {
    renderPage();

    const confirmedRow = await screen.findByRole("row", { name: /Área Nogal/ });
    expect(within(confirmedRow).getByText("Nodo Nogal")).toBeInTheDocument();
    expect(within(confirmedRow).getByText("Confirmado")).toBeInTheDocument();
    expect(within(confirmedRow).getAllByText("mesh-DEMO01").length).toBeGreaterThan(0);

    const unboundRow = screen.getByRole("row", { name: /Área Alfalfa/ });
    expect(within(unboundRow).getByText("Nodo Alfalfa")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Sin enlazar")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Sin lecturas")).toBeInTheDocument();
  });

  it("revokes the link only after confirming and shows it as revoked", async () => {
    const { data: active } = await mocks.getGateway();
    mocks.revokeGateway.mockResolvedValue({ data: undefined });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Revocar enlace" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/dejará de poder enviar datos/)).toBeInTheDocument();
    expect(within(dialog).getByText(/lecturas ya recibidas se conservan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/«Desvincular equipo»/)).toBeInTheDocument();

    // Cancelar no revoca nada.
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.revokeGateway).not.toHaveBeenCalled();

    mocks.getGateway.mockResolvedValue({
      data: { ...active, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revocar enlace" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Revocar enlace" }));

    await waitFor(() => expect(mocks.revokeGateway).toHaveBeenCalledWith(10));
    expect(await screen.findByText("Revocado")).toBeInTheDocument();
    expect(screen.getByText(/Revocado el/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar enlace" })).not.toBeInTheDocument();
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Enlace revocado. Las lecturas ya recibidas se conservan.",
      "success",
    );
  });

  it("does not offer to revoke a link that is already revoked", async () => {
    const { data: active } = await mocks.getGateway();
    mocks.getGateway.mockResolvedValue({
      data: { ...active, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" },
    });
    renderPage();

    expect(await screen.findByText("Revocado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar enlace" })).not.toBeInTheDocument();
  });
});
