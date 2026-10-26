import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IrrigationAreaManagement } from "./IrrigationAreaManagement";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  getGeoNodes: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../services/api", () => ({
  api: { get: mocks.get },
}));

vi.mock("../../services/nodes", () => ({
  getGeoNodes: mocks.getGeoNodes,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/predios/20/areas"]}>
      <Routes>
        <Route path="/admin/predios/:predioId/areas" element={<IrrigationAreaManagement />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("IrrigationAreaManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((path: string) => {
      if (path === "/properties/20") {
        return Promise.resolve({ data: { id: 20, client_id: 3, name: "Rancho Prueba" } });
      }
      if (path === "/clients/3") {
        return Promise.resolve({ data: { id: 3, company_name: "Test" } });
      }
      if (path.startsWith("/irrigation-areas")) {
        return Promise.resolve({
          data: {
            data: [
              { id: 47, property_id: 20, crop_type_id: 1, name: "Área Norte", area_size: 2.5 },
              { id: 48, property_id: 20, crop_type_id: 1, name: "Área Sur", area_size: null },
              { id: 49, property_id: 20, crop_type_id: 1, name: "Área Este", area_size: null },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [{ id: 1, name: "Nogal" }] } });
    });
    mocks.getGeoNodes.mockResolvedValue({
      data: [
        { id: 45, irrigation_area_id: 47, name: "Torre Norte", serial_number: null, is_active: true },
        { id: 46, irrigation_area_id: 49, name: null, serial_number: "RPL02", is_active: false },
      ],
    });
  });

  it("shows whether each area already has its node", async () => {
    renderPage();

    const north = await screen.findByRole("row", { name: /Área Norte/ });
    expect(within(north).getByText("Torre Norte")).toBeInTheDocument();
    const south = screen.getByRole("row", { name: /Área Sur/ });
    expect(within(south).getByText("Se crea al enlazar")).toBeInTheDocument();
    const east = screen.getByRole("row", { name: /Área Este/ });
    expect(within(east).getByText("RPL02 (deshabilitado)")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nodo" })).toBeInTheDocument();
  });

  it("gives every field of the new-area form an accessible name", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /nueva área/i }));

    expect(screen.getByLabelText("Nombre del Área")).toBeRequired();
    expect(screen.getByLabelText("Tipo de Cultivo")).toBeRequired();
    expect(screen.getByLabelText("Tamaño (Hectáreas) - Opcional")).toBeInTheDocument();
  });
});
