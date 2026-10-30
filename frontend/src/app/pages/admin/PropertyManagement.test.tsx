import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PropertyManagement } from "./PropertyManagement";

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../services/api", () => ({ api: { get: mocks.get, delete: mocks.del } }));

function renderPage() {
  mocks.get.mockImplementation((path: string) => {
    if (path.startsWith("/clients/")) {
      return Promise.resolve({ data: { id: 1, company_name: "Agrícola Norte" } });
    }
    return Promise.resolve({ data: { data: [{ id: 7, client_id: 1, name: "Rancho Sur", location: "Sonora" }], total: 1 } });
  });
  mocks.del.mockReset().mockResolvedValue({});
  return render(
    <MemoryRouter initialEntries={["/admin/clientes/1/predios"]}>
      <Routes>
        <Route path="/admin/clientes/:clientId/predios" element={<PropertyManagement />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PropertyManagement", () => {
  it("gives every field of the new-property form an accessible name", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /nuevo predio/i }));

    expect(screen.getByRole("dialog", { name: "Nuevo Predio" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del Predio")).toBeRequired();
    expect(screen.getByLabelText("Ubicación (Opcional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("shows where the admin is by name and keeps a single h1", async () => {
    renderPage();
    await screen.findAllByText("Rancho Sur");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const trail = screen.getByRole("navigation", { name: "Ubicación en la jerarquía" });
    expect(trail).toHaveTextContent("Clientes");
    expect(trail).toHaveTextContent("Agrícola Norte");
    expect(trail).toHaveTextContent("Predios");
  });

  it("asks to confirm naming the property and deletes nothing until confirmed", async () => {
    renderPage();
    const [borrar] = await screen.findAllByRole("button", { name: /^Borrar/ });
    fireEvent.click(borrar);

    const dialog = screen.getByRole("dialog", { name: "¿Eliminar el predio Rancho Sur?" });
    expect(dialog).toHaveAccessibleDescription("Esta acción no se puede deshacer.");
    expect(mocks.del).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.del).not.toHaveBeenCalled();

    fireEvent.click((await screen.findAllByRole("button", { name: /^Borrar/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith("/properties/7"));
  });
});
