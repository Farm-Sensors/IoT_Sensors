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

const slot = (areaId: number, binding: string, latest: string | null) => ({
  logical_node_id: areaId,
  irrigation_area_id: areaId,
  binding_status: binding,
  latest_reading_at: latest,
  bound_uid: binding === "confirmed" ? `mesh-${areaId}` : null,
  bound_serial: null,
});

const pendingStatus = {
  gateway_id: 20,
  status: "never_seen",
  edge_status: "pending",
  last_heartbeat_at: null,
  config_version: 1,
  slots: [slot(16, "unbound", null), slot(17, "unbound", null)],
};

const session = {
  session_id: "ses_1",
  user_code: "BCDF-GHJK",
  status: "pending",
  requested_at: "2026-10-27T18:00:00Z",
  expires_at: "2099-01-01T00:00:00Z",
  device: { hostname: "agroio-lab", model: "Raspberry Pi 5", agent_version: "2.0.0" },
  source_network: "10.32.90.0/24",
};

function statusWith(slots: ReturnType<typeof slot>[]) {
  return { ...pendingStatus, status: "recently_seen", edge_status: "connected", slots };
}

function currentStep() {
  const steps = screen.getAllByTestId("current-step");
  expect(steps).toHaveLength(1);
  return steps[0];
}

describe("GatewayManagement (lista de equipos y asistente)", () => {
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

  it("lands on the list with one state badge and one action per equipo, no technical block", async () => {
    const recent = new Date().toISOString();
    const old = "2026-01-01T00:00:00Z";
    const named = (id: number, name: string, extra: object = {}) => ({
      ...createdGateway,
      id,
      property_id: id,
      property_name: name,
      client_name: "Cliente",
      ...extra,
    });
    mocks.listGateways.mockResolvedValue({
      data: [
        named(1, "Rancho Uno"),
        named(2, "Rancho Dos", { status: "active" }),
        named(3, "Rancho Tres", { status: "active" }),
        named(4, "Rancho Cuatro", { status: "active" }),
        named(5, "Rancho Viejo", { status: "revoked", property_deleted: true }),
      ],
    });
    const byId: Record<number, ReturnType<typeof slot>[]> = {
      1: [slot(16, "unbound", null), slot(17, "unbound", null)],
      2: [slot(16, "confirmed", recent), slot(17, "unbound", null)],
      3: [slot(16, "confirmed", recent), slot(17, "confirmed", recent)],
      4: [slot(16, "confirmed", recent), slot(17, "confirmed", old)],
      5: [slot(16, "confirmed", old), slot(17, "confirmed", old)],
    };
    mocks.getGatewayStatus.mockImplementation((id: number) =>
      Promise.resolve({ data: { ...statusWith(byId[id]), gateway_id: id } }),
    );

    renderPage();

    const list = await screen.findByRole("list", { name: "Equipos" });
    expect(screen.getByRole("heading", { level: 1, name: "Equipos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo equipo/ })).toBeInTheDocument();
    const card = (name: string) =>
      within(list).getByRole("heading", { name: `${name} · Cliente` }).closest("li")!;

    expect(within(card("Rancho Uno")).getByTestId("equipo-state")).toHaveTextContent("Falta vincular");
    expect(within(card("Rancho Uno")).getByText("0 de 2 áreas con datos")).toBeInTheDocument();
    expect(within(card("Rancho Uno")).getByRole("button", { name: /^Vincular equipo/ })).toBeInTheDocument();

    expect(within(card("Rancho Dos")).getByTestId("equipo-state")).toHaveTextContent("Asignando nodos");
    expect(within(card("Rancho Dos")).getByText("1 de 2 áreas con datos")).toBeInTheDocument();
    expect(within(card("Rancho Dos")).getByRole("button", { name: /^Ver avance/ })).toBeInTheDocument();

    expect(within(card("Rancho Tres")).getByTestId("equipo-state")).toHaveTextContent("Funcionando");
    expect(within(card("Rancho Tres")).getByText("2 de 2 áreas con datos")).toBeInTheDocument();
    expect(within(card("Rancho Tres")).getByRole("link", { name: /^Ver detalle/ })).toHaveAttribute(
      "href",
      "/admin/gateways/3",
    );

    expect(within(card("Rancho Cuatro")).getByTestId("equipo-state")).toHaveTextContent(
      "Sin datos recientes",
    );
    // Una sola acción por tarjeta.
    for (const name of ["Rancho Uno", "Rancho Dos", "Rancho Tres", "Rancho Cuatro"]) {
      expect(within(card(name)).queryAllByRole("button").length + within(card(name)).queryAllByRole("link").length).toBe(1);
    }

    // Revocados al final, plegados y sin conteo de áreas.
    const revoked = screen.getByText("Revocados (1)").closest("details")!;
    expect(revoked).not.toHaveAttribute("open");
    expect(within(revoked).getByText("Rancho Viejo · Cliente (predio eliminado)")).toBeInTheDocument();
    expect(within(revoked).queryByText(/áreas con datos/)).not.toBeInTheDocument();

    // Nada técnico a la vista.
    expect(screen.queryByText(/Detalles técnicos|POST \/api|Enlace #|versión|gateway|parcela|ranura/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("current-step")).not.toBeInTheDocument();
  });

  it("shows an empty state with a single Nuevo equipo action", async () => {
    renderPage();

    expect(await screen.findByText("Todavía no hay equipos")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Nuevo equipo/ })).toHaveLength(1);
  });

  it("creates the equipo from step 1 and advances to step 2 with only that step open", async () => {
    mocks.listGateways.mockResolvedValue({ data: [{ ...createdGateway, id: 9, property_id: 8, status: "active" }] });
    mocks.provisionGateway.mockResolvedValue({ data: createdGateway });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo equipo/ }));

    expect(screen.getByRole("heading", { level: 2, name: "Nuevo equipo" })).toBeInTheDocument();
    expect(within(currentStep()).getByRole("heading", { name: "Rancho y áreas" })).toHaveFocus();
    expect(screen.getByTestId("search")).toHaveTextContent("?nuevo=1");

    fireEvent.change(screen.getByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    // Un área sin nodo se puede elegir: el nodo se crea al guardar.
    expect(screen.getByLabelText("Área Oeste")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Área Oeste"));
    // Un nodo deshabilitado no se reemplaza solo.
    expect(screen.getByLabelText("Área Este")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Crear y continuar" }));

    await waitFor(() => expect(mocks.provisionGateway).toHaveBeenCalledWith(3, [16, 19]));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("?gateway=20"));
    const step = currentStep();
    expect(within(step).getByRole("heading", { name: "Vincular equipo" })).toBeInTheDocument();
    expect(
      within(step).getByText("En la pantalla del equipo toca «Vincular equipo» y escribe aquí el código."),
    ).toBeInTheDocument();
    expect(within(step).getByLabelText("Código del equipo")).toBeInTheDocument();
    // El paso 1 queda en una línea con su resumen.
    expect(screen.getByText("Rancho Prueba · Rancho Prueba SA · 2 áreas")).toBeInTheDocument();
    expect(screen.queryByText(/versión|Enlace #/)).not.toBeInTheDocument();
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it("explains a rejected step 1 in plain words", async () => {
    mocks.provisionGateway.mockRejectedValue({
      response: { data: { detail: "Irrigation area 16 has a disabled node; enable it first" } },
    });

    renderPage("/admin/gateways?nuevo=1");
    fireEvent.change(await screen.findByLabelText("Rancho"), { target: { value: "3" } });
    fireEvent.click(await screen.findByLabelText("Área Norte"));
    fireEvent.click(screen.getByRole("button", { name: "Crear y continuar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Una de las áreas tiene su nodo deshabilitado. Actívalo en Nodos o quita esa área.",
    );
  });

  it("finishes the configuration of a link created before it was automatic", async () => {
    const legacy = { ...createdGateway, id: 13, configuration_version: 0 };
    mocks.listGateways.mockResolvedValue({ data: [legacy] });
    mocks.getGateway.mockResolvedValue({ data: legacy });
    mocks.publishConfiguration.mockResolvedValue({ data: { configuration_version: 1 } });

    renderPage("/admin/gateways?gateway=13");
    fireEvent.click(await screen.findByRole("button", { name: "Dejar lista la configuración" }));

    await waitFor(() => expect(mocks.publishConfiguration).toHaveBeenCalledWith(13));
  });

  it("shows the success state and auto-advances to step 3 after approving the code", async () => {
    mocks.listGateways.mockResolvedValue({ data: [createdGateway] });
    mocks.lookupPairing.mockResolvedValue({ data: session });
    mocks.approvePairing.mockResolvedValue({
      data: { session_id: "ses_1", status: "approved", gateway_id: 20, property_id: 3 },
    });

    renderPage("/admin/gateways?gateway=20");

    const step = await screen.findByTestId("current-step");
    expect(within(step).getByRole("heading", { name: "Vincular equipo" })).toBeInTheDocument();
    fireEvent.change(within(step).getByLabelText("Código del equipo"), { target: { value: "bcdfghjk" } });
    fireEvent.click(within(step).getByRole("button", { name: "Buscar código" }));
    fireEvent.click(await within(step).findByLabelText(/confirmo que este código aparece/i));
    // El rancho ya está elegido: no se vuelve a preguntar.
    expect(within(step).queryByLabelText("Rancho")).not.toBeInTheDocument();

    mocks.getGateway.mockResolvedValue({ data: { ...createdGateway, status: "active" } });
    fireEvent.click(within(step).getByRole("button", { name: "Aprobar código" }));

    await waitFor(() =>
      expect(mocks.approvePairing).toHaveBeenCalledWith("ses_1", {
        user_code: "BCDF-GHJK",
        gateway_id: 20,
        confirm: true,
        replace_credential: false,
      }),
    );
    const next = await screen.findByRole("heading", { name: "Asignar nodos" });
    await waitFor(() => expect(next).toHaveFocus());
    const third = currentStep();
    expect(within(third).getByRole("status")).toHaveTextContent("Equipo vinculado");
    expect(within(third).getByText("0 de 2 áreas con datos")).toBeInTheDocument();
    expect(await within(third).findAllByText("Esperando nodo")).toHaveLength(2);
    expect(screen.queryByLabelText("Código del equipo")).not.toBeInTheDocument();
  });

  it("follows each area in step 3 and ends in a Listo state when all report", async () => {
    const recent = new Date().toISOString();
    const active = { ...createdGateway, status: "active" };
    mocks.listGateways.mockResolvedValue({ data: [active] });
    mocks.getGateway.mockResolvedValue({ data: active });
    mocks.getGatewayStatus.mockResolvedValue({
      data: statusWith([slot(16, "confirmed", recent), slot(17, "unbound", null)]),
    });

    const view = renderPage("/admin/gateways?gateway=20");

    const areas = await screen.findByRole("list", { name: "Áreas" });
    expect(within(areas).getByText("Área Norte").closest("li")).toHaveTextContent("Recibiendo datos");
    expect(within(areas).getByText("Área Sur").closest("li")).toHaveTextContent("Esperando nodo");
    expect(screen.getByText("1 de 2 áreas con datos")).toBeInTheDocument();
    view.unmount();

    mocks.getGatewayStatus.mockResolvedValue({
      data: statusWith([slot(16, "confirmed", recent), slot(17, "confirmed", recent)]),
    });
    renderPage("/admin/gateways?gateway=20");

    expect(await screen.findByRole("heading", { name: "Listo" })).toBeInTheDocument();
    expect(screen.queryByTestId("current-step")).not.toBeInTheDocument();
    expect(screen.getByText("Todas las áreas reciben datos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute("href", "/admin/gateways/20");
  });

  it("keeps the activation reference behind «¿El equipo no muestra código?»", async () => {
    mocks.listGateways.mockResolvedValue({ data: [createdGateway] });
    mocks.issueActivationReference.mockResolvedValue({
      data: { activation_reference: "ref-123", expires_at: "2099-01-01T00:00:00Z" },
    });

    renderPage("/admin/gateways?gateway=20");

    const disclosure = (await screen.findByText("¿El equipo no muestra código?")).closest("details")!;
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(within(disclosure).getByRole("button", { name: "Generar referencia" }));

    await waitFor(() => expect(mocks.issueActivationReference).toHaveBeenCalledWith(20));
    expect(await screen.findByTestId("one-time-secret")).toHaveTextContent("ref-123");
  });

  it("returns to the list with «Volver a la lista»", async () => {
    mocks.listGateways.mockResolvedValue({ data: [createdGateway] });

    renderPage("/admin/gateways?gateway=20");

    fireEvent.click(await screen.findByRole("button", { name: "Volver a la lista" }));
    expect(await screen.findByRole("list", { name: "Equipos" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search")).toBeEmptyDOMElement());
    expect(screen.getByRole("heading", { level: 1, name: "Equipos" })).toHaveFocus();
  });

  it("revokes from the wizard and lets the ranch be linked again", async () => {
    const active = { ...createdGateway, id: 13, status: "active" };
    const revoked = { ...active, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" };
    mocks.listGateways.mockResolvedValue({ data: [active] });
    mocks.getGateway.mockResolvedValue({ data: active });
    mocks.revokeGateway.mockResolvedValue({ data: undefined });

    renderPage("/admin/gateways?gateway=13");

    fireEvent.click(await screen.findByRole("button", { name: "Revocar enlace" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/«Desvincular equipo»/)).toBeInTheDocument();
    mocks.getGateway.mockResolvedValue({ data: revoked });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revocar enlace" }));

    await waitFor(() => expect(mocks.revokeGateway).toHaveBeenCalledWith(13));
    expect(await screen.findByText("Revocados (1)")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay equipos")).toBeInTheDocument();

    // El rancho ya no aparece ocupado.
    fireEvent.click(screen.getByRole("button", { name: /Nuevo equipo/ }));
    expect(await screen.findByRole("option", { name: "Rancho Prueba · Rancho Prueba SA" })).toBeEnabled();
  });

  it("shows the list for a revoked equipo in the URL, without offering to revoke it", async () => {
    mocks.listGateways.mockResolvedValue({
      data: [{ ...createdGateway, id: 20, status: "revoked", revoked_at: "2026-10-27T18:00:00Z" }],
    });

    renderPage("/admin/gateways?gateway=20");

    expect(await screen.findByText("Revocados (1)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revocar enlace" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search")).toBeEmptyDOMElement());
  });
});
