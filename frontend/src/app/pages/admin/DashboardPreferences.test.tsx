import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DashboardPreferencesModule from "../../services/dashboardPreferences";
import { DashboardPreferences } from "./DashboardPreferences";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  getClientDashboardPreferences: vi.fn(),
  updateClientDashboardPreferences: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../services/dashboardPreferences", async (importOriginal) => {
  const actual = await importOriginal<typeof DashboardPreferencesModule>();
  return {
    ...actual,
    getClientDashboardPreferences: mocks.getClientDashboardPreferences,
    updateClientDashboardPreferences: mocks.updateClientDashboardPreferences,
  };
});

vi.mock("../../services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { id: 3, company_name: "Rancho Prueba" } }),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/clientes/3/dashboard"]}>
      <Routes>
        <Route path="/admin/clientes/:clientId/dashboard" element={<DashboardPreferences />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardPreferences (pantalla admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClientDashboardPreferences.mockResolvedValue({ client_id: 3, cards: null });
    mocks.updateClientDashboardPreferences.mockResolvedValue({ client_id: 3, cards: [] });
  });

  it("precarga el nombre del cliente y las tarjetas ya guardadas", async () => {
    mocks.getClientDashboardPreferences.mockResolvedValue({
      client_id: 3,
      cards: ["priority.humidity", "soil.chart"],
    });
    renderPage();

    expect(await screen.findByLabelText("Humedad del Suelo")).toBeChecked();
    expect(screen.getByLabelText("Gráfica de humedad (últimas 12 lecturas)")).toBeChecked();
    expect(screen.getByLabelText("Flujo de Agua")).not.toBeChecked();
    expect(screen.getAllByText("Rancho Prueba").length).toBeGreaterThan(0);
    expect(screen.getByText(/Configurado: el dashboard muestra exactamente las tarjetas marcadas/)).toBeTruthy();
    expect(mocks.getClientDashboardPreferences).toHaveBeenCalledWith(3);
  });

  it("guarda la selección con el PUT correcto", async () => {
    mocks.getClientDashboardPreferences.mockResolvedValue({
      client_id: 3,
      cards: ["priority.humidity"],
    });
    mocks.updateClientDashboardPreferences.mockResolvedValue({
      client_id: 3,
      cards: ["priority.humidity", "environmental.details"],
    });
    renderPage();

    const environmental = await screen.findByLabelText("Ambiental");
    expect(environmental).not.toBeChecked();
    fireEvent.click(environmental);
    fireEvent.click(screen.getByText("Guardar preferencias"));

    await waitFor(() =>
      expect(mocks.updateClientDashboardPreferences).toHaveBeenCalledWith(3, [
        "priority.humidity",
        "environmental.details",
      ]),
    );
    expect(mocks.showToast).toHaveBeenCalledWith("Preferencias del dashboard guardadas", "success");
  });

  it("avisa que sin configurar se muestran solo las tarjetas con datos", async () => {
    mocks.getClientDashboardPreferences.mockResolvedValue({ client_id: 3, cards: null });
    renderPage();

    expect(await screen.findByText(/Sin configurar: el dashboard muestra automáticamente solo las tarjetas que tengan datos/)).toBeTruthy();
    expect(screen.getByLabelText("Humedad del Suelo")).not.toBeChecked();
    expect(screen.getByLabelText("Fuentes externas")).not.toBeChecked();
    expect(screen.getByText("Volver a automático")).toBeDisabled();
  });

  it("vuelve al modo automático enviando cards null y limpiando la selección", async () => {
    mocks.getClientDashboardPreferences.mockResolvedValue({
      client_id: 3,
      cards: ["priority.humidity"],
    });
    mocks.updateClientDashboardPreferences.mockResolvedValue({ client_id: 3, cards: null });
    renderPage();

    expect(await screen.findByLabelText("Humedad del Suelo")).toBeChecked();
    fireEvent.click(screen.getByText("Volver a automático"));

    await waitFor(() => expect(mocks.updateClientDashboardPreferences).toHaveBeenCalledWith(3, null));
    expect(await screen.findByText(/Sin configurar: el dashboard muestra automáticamente/)).toBeTruthy();
    expect(screen.getByLabelText("Humedad del Suelo")).not.toBeChecked();
    expect(screen.getByText("Volver a automático")).toBeDisabled();
    expect(mocks.showToast).toHaveBeenCalledWith("Dashboard vuelto al modo automático", "success");
  });
});
