import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PropertyManagement } from "./PropertyManagement";

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../services/api", () => ({
  api: {
    get: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith("/clients/")) {
        return Promise.resolve({ data: { id: 1, company_name: "Agrícola Norte" } });
      }
      return Promise.resolve({ data: { data: [], total: 0 } });
    }),
  },
}));

describe("PropertyManagement", () => {
  it("gives every field of the new-property form an accessible name", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/clientes/1/predios"]}>
        <Routes>
          <Route path="/admin/clientes/:clientId/predios" element={<PropertyManagement />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /nuevo predio/i }));

    expect(screen.getByLabelText("Nombre del Predio")).toBeRequired();
    expect(screen.getByLabelText("Ubicación (Opcional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
