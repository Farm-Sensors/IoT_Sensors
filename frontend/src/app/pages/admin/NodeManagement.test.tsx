import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodeManagement } from "./NodeManagement";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  getGeoNodes: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../services/api", () => ({
  api: { get: mocks.get, post: mocks.post },
}));

vi.mock("../../services/nodes", () => ({
  getGeoNodes: mocks.getGeoNodes,
}));

describe("NodeManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((path: string) => {
      if (path.startsWith("/nodes")) {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 5,
                irrigation_area_id: 2,
                serial_number: null,
                name: "Nodo Norte",
                latitude: null,
                longitude: null,
                is_active: true,
              },
            ],
          },
        });
      }
      if (path.startsWith("/irrigation-areas")) {
        return Promise.resolve({
          data: {
            data: [
              { id: 1, property_id: 10, name: "Parcela Norte" },
              { id: 2, property_id: 11, name: "Parcela Norte" },
            ],
          },
        });
      }
      if (path.startsWith("/properties")) {
        return Promise.resolve({
          data: {
            data: [
              { id: 10, name: "Rancho Uno" },
              { id: 11, name: "Rancho Dos" },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    mocks.getGeoNodes.mockResolvedValue({
      data: [{ id: 5, irrigation_area_id: 2, last_reading_timestamp: null }],
    });
    mocks.post.mockResolvedValue({ data: { id: 6 } });
  });

  it("names each area with its ranch and explains the optional fields", async () => {
    render(<NodeManagement />);

    expect(await screen.findByText("Parcela Norte · Rancho Dos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /nuevo nodo/i }));

    const area = screen.getByLabelText("Área de Riego (Obligatorio)");
    expect(area).toHaveDisplayValue("Seleccione un área");
    expect(screen.getByRole("option", { name: "Parcela Norte · Rancho Uno" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Parcela Norte · Rancho Dos" })).toBeInTheDocument();

    expect(screen.getByLabelText("Nombre del Nodo")).toBeInTheDocument();
    expect(screen.getByLabelText("Número de Serie")).toHaveAccessibleDescription(
      "Opcional. Identificador interno; el nodo físico se vincula desde la pantalla del equipo.",
    );
    expect(screen.getByLabelText("Latitud GPS (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Longitud GPS (opcional)")).toBeInTheDocument();
  });

  it("tells enabled apart from reporting and confirms creation in plain words", async () => {
    render(<NodeManagement />);

    const row = await screen.findByRole("row", { name: /Nodo Norte/ });
    expect(screen.getByRole("columnheader", { name: "Habilitado" })).toBeInTheDocument();
    expect(within(row).getByText("Sí")).toBeInTheDocument();
    expect(within(row).getByText("Sin datos aún")).toBeInTheDocument();
    expect(screen.queryByText("Activo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /nuevo nodo/i }));
    fireEvent.change(screen.getByLabelText("Área de Riego (Obligatorio)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Nodo" }));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith("Nodo creado.", "success"));
  });
});
