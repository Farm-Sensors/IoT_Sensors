import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as GatewaysModule from "../../services/gateways";
import { GatewayManagement } from "./GatewayManagement";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  listGateways: vi.fn(),
  provisionGateway: vi.fn(),
  publishConfiguration: vi.fn(),
  issueActivationReference: vi.fn(),
  getGateway: vi.fn(),
  getGatewayStatus: vi.fn(),
  lookupPairing: vi.fn(),
  approvePairing: vi.fn(),
  denyPairing: vi.fn(),
  getPropertyGatewayStatus: vi.fn(),
  getGeoNodes: vi.fn(),
  revokeGateway: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,demo") },
}));

vi.mock("../../services/gateways", async (importOriginal) => {
  const actual: typeof GatewaysModule = await importOriginal();
  return {
    ...actual,
    listGateways: mocks.listGateways,
    provisionGateway: mocks.provisionGateway,
    publishConfiguration: mocks.publishConfiguration,
    issueActivationReference: mocks.issueActivationReference,
    getGateway: mocks.getGateway,
    getGatewayStatus: mocks.getGatewayStatus,
    lookupPairing: mocks.lookupPairing,
    approvePairing: mocks.approvePairing,
    denyPairing: mocks.denyPairing,
    getPropertyGatewayStatus: mocks.getPropertyGatewayStatus,
    revokeGateway: mocks.revokeGateway,
  };
});

vi.mock("../../services/nodes", () => ({
  getGeoNodes: mocks.getGeoNodes,
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
              { id: 16, property_id: 3, name: "Área Norte", crop_type: { id: 1, name: "Nogal" } },
              { id: 17, property_id: 3, name: "Área Sur", crop_type: { id: 2, name: "Alfalfa" } },
              { id: 18, property_id: 3, name: "Área Este", crop_type: { id: 3, name: "Manzana" } },
              { id: 19, property_id: 3, name: "Área Oeste", crop_type: { id: 4, name: "Maíz" } },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

function CurrentSearch() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderPage(path = "/admin/gateways") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GatewayManagement />
      <CurrentSearch />
    </MemoryRouter>,
  );
}

const createdGateway = {
  id: 20,
  property_id: 3,
  status: "pending_activation",
  configuration_version: 1,
  bindings_revision: 0,
  activated_at: null,
  revoked_at: null,
  property_name: "Rancho Prueba",
  client_name: "Rancho Prueba SA",
  property_deleted: false,
  slots: [
    { id: 30, irrigation_area_id: 16, logical_node_id: 16 },
    { id: 31, irrigation_area_id: 17, logical_node_id: 17 },
  ],
};

const pendingStatus = {
  gateway_id: 20,
  status: "never_seen",
  edge_status: "pending",
  last_heartbeat_at: null,
  config_version: 1,
  slots: [
    { logical_node_id: 16, irrigation_area_id: 16, binding_status: "unbound", latest_reading_at: null, bound_uid: null, bound_serial: null },
    { logical_node_id: 17, irrigation_area_id: 17, binding_status: "unbound", latest_reading_at: null, bound_uid: null, bound_serial: null },
  ],
};

describe("GatewayManagement (asistente de enlace)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGateways.mockResolvedValue({ data: [] });
    mocks.getGeoNodes.mockResolvedValue({
      data: [
        { irrigation_area_id: 16, irrigation_area_name: "Área Norte", name: "Nodo Norte", serial_number: "mesh-N2-01", is_active: true },
        { irrigation_area_id: 17, irrigation_area_name: "Área Sur", name: "Nodo Sur", serial_number: "mesh-N2-02", is_active: true },
        { irrigation_area_id: 18, irrigation_area_name: "Área Este", name: null, serial_number: null, is_active: false },
      ],
    });
    mocks.getGatewayStatus.mockResolvedValue({ data: pendingStatus });
    mocks.getGateway.mockResolvedValue({ data: createdGateway });
    mocks.getPropertyGatewayStatus.mockResolvedValue({ data: pendingStatus });
  });

  it("guides the three steps and creates the link with the checked areas", async () => {
    mocks.provisionGateway.mockResolvedValue({ data: createdGateway });

    renderPage();

    const steps = await screen.findByRole("list", { name: "Pasos del enlace" });
    expect(screen.getByRole("heading", { level: 1, name: "Equipos" })).toBeInTheDocument();
    expect(screen.queryByText(/parcela|ranura/i)).not.toBeInTheDocument();
    expect(within(steps).getByText("1. Elige el rancho y sus áreas de riego")).toBeInTheDocument();
    expect(within(steps).getByText("2. Vincula el equipo")).toBeInTheDocument();
    expect(within(steps).getByText("3. Enlaza los nodos")).toBeInTheDocument();
    expect(within(steps).queryByText(/Publica la configuración/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Elige el rancho y sus áreas de riego" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    // Un área sin nodo se puede elegir: el nodo se crea al crear el enlace.
    const withoutNode = screen.getByLabelText("Área Oeste");
    expect(withoutNode).toBeEnabled();
    expect(screen.getByText("Sin nodo todavía: se crea uno al crear el enlace")).toBeInTheDocument();
    fireEvent.click(withoutNode);
    // Un nodo deshabilitado no se reemplaza solo.
    expect(screen.getByLabelText("Área Este")).toBeDisabled();
    expect(screen.queryByText(/la API rechazará/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    await waitFor(() => expect(mocks.provisionGateway).toHaveBeenCalledWith(3, [16, 19]));
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Enlace creado con 2 área(s). La configuración quedó lista.",
      "success",
    );
    expect(await screen.findByText("Configuración lista (versión 1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /configuración/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Código del equipo")).toBeInTheDocument();
    expect(screen.getByText(/Vincular equipo/)).toBeInTheDocument();
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it("explains a rejected link in plain words", async () => {
    mocks.provisionGateway.mockRejectedValue({
      response: { data: { detail: "Irrigation area 16 has a disabled node; enable it first" } },
    });

    renderPage();
    fireEvent.change(await screen.findByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    expect(
      await screen.findByText(
        "Una de las áreas tiene su nodo deshabilitado. Actívalo en Nodos o quita esa área.",
      ),
    ).toBeInTheDocument();
  });

  it("finishes the configuration of a link created before it was automatic", async () => {
    const legacy = { ...createdGateway, id: 13, configuration_version: 0 };
    mocks.listGateways.mockResolvedValue({ data: [legacy] });
    mocks.getGateway.mockResolvedValue({ data: { ...legacy, configuration_version: 1 } });
    mocks.publishConfiguration.mockResolvedValue({ data: { configuration_version: 1 } });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Dejar lista la configuración" }));

    await waitFor(() => expect(mocks.publishConfiguration).toHaveBeenCalledWith(13));
    expect(await screen.findByText("Configuración lista (versión 1)")).toBeInTheDocument();
  });

  it("lists existing links with ranch and client names plus plain state", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [
        { ...createdGateway, id: 11, status: "active", configuration_version: 1, slots: [{ id: 40, irrigation_area_id: 16, logical_node_id: 16 }] },
        { ...createdGateway, id: 15, status: "active", configuration_version: 2, slots: [{ id: 41, irrigation_area_id: 17, logical_node_id: 17 }] },
      ],
    });
    mocks.getGatewayStatus.mockImplementation((id: number) =>
      Promise.resolve({
        data: {
          ...pendingStatus,
          gateway_id: id,
          status: "recently_seen",
          edge_status: "connected",
          slots: [
            {
              logical_node_id: 16,
              irrigation_area_id: 16,
              binding_status: id === 11 ? "confirmed" : "unbound",
              latest_reading_at: "2026-10-09T06:26:47Z",
              bound_uid: id === 11 ? "mesh-DEMO01" : null,
              bound_serial: id === 11 ? "mesh-DEMO01" : null,
            },
          ],
        },
      }),
    );

    renderPage();

    expect(await screen.findAllByText("Rancho Prueba · Rancho Prueba SA")).toHaveLength(2);
    expect(screen.getByText(/Vinculado y reportando/)).toBeInTheDocument();
    expect(screen.getByText(/1 de 1 reportando/)).toBeInTheDocument();
    // Un enlace vinculado pero sin nodos enlazados no puede decir "reportando".
    expect(screen.getByText(/Vinculado, faltan nodos por enlazar/)).toBeInTheDocument();
    expect(screen.getByText(/0 de 1 reportando/)).toBeInTheDocument();
  });

  it("lists revoked links last, with the ranch name and without reporting claims", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [
        {
          ...createdGateway,
          id: 20,
          property_id: 19,
          status: "revoked",
          property_name: "E2E tramas reales",
          client_name: "Test",
          property_deleted: true,
        },
        { ...createdGateway, id: 21, status: "active" },
      ],
    });
    mocks.getGatewayStatus.mockImplementation((id: number) =>
      Promise.resolve({
        data: {
          ...pendingStatus,
          gateway_id: id,
          slots: pendingStatus.slots.map((slot) => ({ ...slot, binding_status: "confirmed" })),
        },
      }),
    );

    renderPage();

    const revokedSummary = await screen.findByText("Enlaces revocados (1)");
    const revokedCard = screen.getByText("E2E tramas reales · Test (predio eliminado)").closest("div");
    expect(revokedSummary.closest("details")).toContainElement(revokedCard);
    expect(screen.getByText("Enlace revocado")).toBeInTheDocument();
    expect(screen.queryByText(/Predio 19/)).not.toBeInTheDocument();
    // Solo el enlace vigente dice cuántas áreas reportan.
    expect(screen.getAllByText(/de 2 reportando/)).toHaveLength(1);
  });

  it("returns to step 1 from an in-progress link", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [{ ...createdGateway, id: 13, status: "pending_activation" }],
    });
    mocks.getGatewayStatus.mockResolvedValue({ data: pendingStatus });

    renderPage();

    const startOver = await screen.findByRole("button", { name: /crear otro enlace/i });
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("?gateway=13"));
    fireEvent.click(startOver);

    expect(
      await screen.findByRole("heading", { name: "1. Elige el rancho y sus áreas de riego" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search")).toBeEmptyDOMElement());
  });

  it("reopens the link named in the URL after a reload, even if it is complete", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [
        { ...createdGateway, id: 11, status: "active" },
        { ...createdGateway, id: 13, status: "pending_activation" },
      ],
    });
    mocks.getGatewayStatus.mockResolvedValue({
      data: {
        ...pendingStatus,
        slots: pendingStatus.slots.map((slot) => ({ ...slot, binding_status: "confirmed" })),
      },
    });

    renderPage("/admin/gateways?gateway=11");

    expect(await screen.findByRole("button", { name: /crear otro enlace/i })).toBeInTheDocument();
    expect(screen.getByText(/Equipo vinculado\. Si necesitas vincular otro/)).toBeInTheDocument();
    expect(screen.getByTestId("search")).toHaveTextContent("?gateway=11");
  });

  it("puts a newly created link in the URL", async () => {
    mocks.provisionGateway.mockResolvedValue({ data: createdGateway });

    renderPage();
    fireEvent.change(await screen.findByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("?gateway=20"));
  });

  it("revokes the link being viewed and lets the ranch be linked again", async () => {
    const active = { ...createdGateway, id: 13, status: "active" };
    const revoked = { ...active, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" };
    mocks.listGateways.mockResolvedValue({ data: [active] });
    mocks.getGateway.mockResolvedValue({ data: revoked });
    mocks.revokeGateway.mockResolvedValue({ data: undefined });

    renderPage("/admin/gateways?gateway=13");

    fireEvent.click(await screen.findByRole("button", { name: "Revocar enlace" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/«Desvincular equipo»/)).toBeInTheDocument();
    expect(mocks.revokeGateway).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revocar enlace" }));

    await waitFor(() => expect(mocks.revokeGateway).toHaveBeenCalledWith(13));
    // Vuelve al paso 1 y el enlace pasa a la lista de revocados.
    expect(
      await screen.findByRole("heading", { name: "1. Elige el rancho y sus áreas de riego" }),
    ).toBeInTheDocument();
    const revokedSummary = screen.getByText("Enlaces revocados (1)");
    expect(within(revokedSummary.closest("details")!).getByText("Enlace revocado")).toBeInTheDocument();
    expect(screen.getByText("No hay enlaces vigentes.")).toBeInTheDocument();

    // El rancho ya no aparece ocupado: se puede crear su enlace otra vez (reutiliza el #13).
    const ranchOption = screen.getByRole("option", { name: "Rancho Prueba · Rancho Prueba SA" });
    expect(ranchOption).toBeEnabled();
    const relinked = { ...createdGateway, id: 13, configuration_version: 2 };
    mocks.provisionGateway.mockResolvedValue({ data: relinked });
    mocks.getGateway.mockResolvedValue({ data: relinked });
    fireEvent.change(screen.getByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    await waitFor(() => expect(mocks.provisionGateway).toHaveBeenCalledWith(3, [16]));
    expect(await screen.findByText("Configuración lista (versión 2)")).toBeInTheDocument();
    // Un solo enlace #13, ahora vigente; ya no está entre los revocados.
    expect(screen.getAllByText(/Enlace #13/)).toHaveLength(1);
    expect(screen.queryByText(/Enlaces revocados/)).not.toBeInTheDocument();
  });

  it("does not offer to revoke a link that is already revoked", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [{ ...createdGateway, id: 20, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" }],
    });

    renderPage("/admin/gateways?gateway=20");

    expect(await screen.findByText("Enlaces revocados (1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar enlace" })).not.toBeInTheDocument();
  });

  it("keeps the API details tucked away", async () => {
    renderPage();
    expect(await screen.findByText("POST /api/v1/gateways")).toBeInTheDocument();
    expect(screen.getByText("Detalles técnicos (API)")).toBeInTheDocument();
  });
});
