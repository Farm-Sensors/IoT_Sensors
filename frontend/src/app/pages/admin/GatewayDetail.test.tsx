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

  it("leads with the ranch, a plain state and one primary action; IDs stay in a closed disclosure", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Rancho Prueba · Rancho Prueba SA" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("equipo-state")).toHaveTextContent("Asignando nodos");
    expect(screen.getByText("0 de 2 áreas con datos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver avance" })).toHaveAttribute(
      "href",
      "/admin/gateways?gateway=10",
    );
    // La configuración ya está lista: no se ofrece publicarla de nuevo.
    expect(screen.queryByRole("button", { name: /configuración/i })).not.toBeInTheDocument();

    const support = screen.getByText("Datos para soporte").closest("details")!;
    expect(support).not.toHaveAttribute("open");
    expect(within(support).getByText("#10")).toBeInTheDocument();
    expect(within(support).getByText(/Versión 1/)).toBeInTheDocument();
    // Connectivity badge comes from the live status, not from the management state.
    expect(within(support).getByText("Equipo conectado")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Equipo #/ })).not.toBeInTheDocument();
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
    expect(screen.getByTestId("equipo-state")).toHaveTextContent("Falta vincular");
    expect(screen.queryByRole("link", { name: "Vincular equipo" })).not.toBeInTheDocument();
  });

  it("lists every area with its node, plain state and last reading", async () => {
    renderPage();

    const confirmedRow = await screen.findByRole("row", { name: /Área Nogal/ });
    expect(within(confirmedRow).getByText("Nodo Nogal")).toBeInTheDocument();
    expect(within(confirmedRow).getByText("Nodo asignado")).toBeInTheDocument();
    expect(within(confirmedRow).queryByText("mesh-DEMO01")).not.toBeInTheDocument();

    const unboundRow = screen.getByRole("row", { name: /Área Alfalfa/ });
    expect(within(unboundRow).getByText("Nodo Alfalfa")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Esperando nodo")).toBeInTheDocument();
    expect(within(unboundRow).getByText("Sin lecturas")).toBeInTheDocument();

    // La identidad física queda para soporte.
    const support = screen.getByText("Datos para soporte").closest("details")!;
    expect(within(support).getByText(/Área Nogal: mesh-DEMO01/)).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByTestId("equipo-state")).toHaveTextContent("Revocado"));
    await waitFor(() => expect(screen.getByText(/Revocado el/)).toBeInTheDocument());
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

    expect(await screen.findByTestId("equipo-state")).toHaveTextContent("Revocado");
    expect(screen.queryByRole("button", { name: "Revocar enlace" })).not.toBeInTheDocument();
  });
});
