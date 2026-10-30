import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CropCycleManagement } from "./CropCycleManagement";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { get } }));
afterEach(cleanup);
beforeEach(() => { get.mockReset(); });
it("loads the canonical areas endpoint and opens the create form", async () => {
  get.mockImplementation((path: string) => {
    if (path === "/irrigation-areas") return Promise.resolve({ data: { data: [{ id: 1, name: "Nogal" }] } });
    if (path === "/crop-cycles") return Promise.resolve({ data: { data: [] } });
    return Promise.reject(new Error(`Unexpected endpoint: ${path}`));
  });
  render(<CropCycleManagement />);
  fireEvent.click(await screen.findByRole("button", { name: "Nuevo Ciclo" }));
  expect(screen.getByRole("heading", { name: "Nuevo Ciclo de Cultivo" })).toBeVisible();
  expect(screen.getByRole("option", { name: "Nogal" })).toBeTruthy();
  expect(get).not.toHaveBeenCalledWith("/irrigation-areas/all");
});
it("renders a validation error as text instead of crashing React", async () => {
  get.mockRejectedValue({ response: { status: 422, data: { detail: [{ type: "int_parsing", loc: ["path", "id"], msg: "Invalid area", input: "all" }] } } });
  render(<CropCycleManagement />);
  expect(await screen.findByText(/Invalid area/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Gestión de Ciclos de Cultivo" })).toBeVisible();
});
