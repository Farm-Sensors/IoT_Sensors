import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,demo") },
}));

vi.mock("../../services/gateways", () => ({
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
}));

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
              { id: 16, property_id: 3, name: "Parcela Norte", crop_type: { id: 1, name: "Nogal" } },
              { id: 17, property_id: 3, name: "Parcela Sur", crop_type: { id: 2, name: "Alfalfa" } },
              { id: 18, property_id: 3, name: "Parcela Este", crop_type: { id: 3, name: "Manzana" } },
              { id: 19, property_id: 3, name: "Parcela Oeste", crop_type: { id: 4, name: "Maíz" } },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <GatewayManagement />
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
        { irrigation_area_id: 16, irrigation_area_name: "Parcela Norte", name: "Nodo Norte", serial_number: "mesh-N2-01", is_active: true },
        { irrigation_area_id: 17, irrigation_area_name: "Parcela Sur", name: "Nodo Sur", serial_number: "mesh-N2-02", is_active: true },
        { irrigation_area_id: 18, irrigation_area_name: "Parcela Este", name: null, serial_number: null, is_active: false },
      ],
    });
    mocks.getGatewayStatus.mockResolvedValue({ data: pendingStatus });
    mocks.getGateway.mockResolvedValue({ data: createdGateway });
    mocks.getPropertyGatewayStatus.mockResolvedValue({ data: pendingStatus });
  });

  it("guides the three steps and creates the link with the checked parcels", async () => {
    mocks.provisionGateway.mockResolvedValue({ data: createdGateway });

    renderPage();

    const steps = await screen.findByRole("list", { name: "Pasos del enlace" });
    expect(within(steps).getByText("1. Elige el rancho y sus parcelas")).toBeInTheDocument();
    expect(within(steps).getByText("2. Vincula la Raspberry")).toBeInTheDocument();
    expect(within(steps).getByText("3. Enlaza los nodos")).toBeInTheDocument();
    expect(within(steps).queryByText(/Publica la configuración/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. Elige el rancho y sus parcelas" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Parcela Norte"));
    // Una parcela sin nodo se puede elegir: el nodo se crea al crear el enlace.
    const withoutNode = screen.getByLabelText("Parcela Oeste");
    expect(withoutNode).toBeEnabled();
    expect(screen.getByText("Sin nodo todavía: se crea uno al crear el enlace")).toBeInTheDocument();
    fireEvent.click(withoutNode);
    // Un nodo deshabilitado no se reemplaza solo.
    expect(screen.getByLabelText("Parcela Este")).toBeDisabled();
    expect(screen.queryByText(/la API rechazará/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    await waitFor(() => expect(mocks.provisionGateway).toHaveBeenCalledWith(3, [16, 19]));
    expect(mocks.showToast).toHaveBeenCalledWith(
      "Enlace creado con 2 parcela(s). La configuración quedó lista.",
      "success",
    );
    expect(await screen.findByText("Configuración lista (versión 1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /configuración/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Código del dispositivo")).toBeInTheDocument();
    expect(screen.getByText(/Vincular dispositivo/)).toBeInTheDocument();
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it("explains a rejected link in plain words", async () => {
    mocks.provisionGateway.mockRejectedValue({
      response: { data: { detail: "Irrigation area 16 has a disabled node; enable it first" } },
    });

    renderPage();
    fireEvent.change(await screen.findByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Parcela Norte"));
    fireEvent.click(screen.getByRole("button", { name: /crear enlace/i }));

    expect(
      await screen.findByText(
        "Una de las parcelas tiene su nodo deshabilitado. Actívalo en Nodos o quita esa parcela.",
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
    expect(screen.getByText(/Vinculada y reportando/)).toBeInTheDocument();
    expect(screen.getByText(/1 de 1 reportando/)).toBeInTheDocument();
    // Un enlace vinculado pero sin nodos enlazados no puede decir "reportando".
    expect(screen.getByText(/Vinculada, faltan nodos por enlazar/)).toBeInTheDocument();
    expect(screen.getByText(/0 de 1 reportando/)).toBeInTheDocument();
  });

  it("returns to step 1 from an in-progress link", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [{ ...createdGateway, id: 13, status: "pending_activation" }],
    });
    mocks.getGatewayStatus.mockResolvedValue({ data: pendingStatus });

    renderPage();

    const startOver = await screen.findByRole("button", { name: /crear otro enlace/i });
    fireEvent.click(startOver);

    expect(
      await screen.findByRole("heading", { name: "1. Elige el rancho y sus parcelas" }),
    ).toBeInTheDocument();
  });

  it("keeps the API details tucked away", async () => {
    renderPage();
    expect(await screen.findByText("POST /api/v1/gateways")).toBeInTheDocument();
    expect(screen.getByText("Detalles técnicos (API)")).toBeInTheDocument();
  });
});
