import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { NodeDetail } from "./NodeDetail";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { get } }));
vi.mock("react-router", async (original) => ({ ...await original<typeof import("react-router")>(), useParams: () => ({ nodeId: "1" }) }));
vi.mock("../../components/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
afterEach(cleanup);
it.each(["2026-10-29T12:00:00", "2026-10-29T12:00:00Z", null, "invalid"])("handles the backend timestamp %s without crashing", async (timestamp) => {
  get.mockImplementation((path: string) => {
    if (path === "/nodes/1") return Promise.resolve({ data: { id: 1, name: "Nodo Norte", irrigation_area_id: 1, latitude: null, longitude: null } });
    if (path === "/irrigation-areas/1") return Promise.resolve({ data: { id: 1, name: "Nogal" } });
    if (path.startsWith("/readings/latest")) return Promise.resolve({ data: { timestamp, soil: { humidity: 45 } } });
    if (path.startsWith("/readings?")) return Promise.resolve({ data: { data: [] } });
    return Promise.reject(new Error(path));
  });
  const { container } = render(<MemoryRouter><NodeDetail /></MemoryRouter>);
  expect(await screen.findByRole("heading", { level: 1, name: "Nodo Norte" })).toBeVisible();
  if (timestamp && timestamp !== "invalid") {
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-10-29T12:00:00.000Z");
  } else {
    expect(container.querySelector("time")).toBeNull();
  }
});

function serveNode(latest: object) {
  get.mockImplementation((path: string) => {
    if (path === "/nodes/1") return Promise.resolve({ data: { id: 1, name: "Nodo Norte", serial_number: "SN-42", irrigation_area_id: 1, latitude: null, longitude: null, is_active: true } });
    if (path === "/irrigation-areas/1") return Promise.resolve({ data: { id: 1, name: "Nogal" } });
    if (path.startsWith("/readings/latest")) return Promise.resolve({ data: { timestamp: "2026-10-29T12:00:00Z", ...latest } });
    if (path.startsWith("/readings?")) return Promise.resolve({ data: { data: [] } });
    return Promise.reject(new Error(path));
  });
}
function cardOf(title: string) {
  return screen.getByRole("heading", { name: title }).closest("div")!.parentElement!.parentElement as HTMLElement;
}

it("shows a missing field as «Sin datos», never as 0, and keeps a measured 0", async () => {
  serveNode({ soil: { humidity: null }, irrigation: { flow_per_minute: 0 }, environmental: { eto: null } });
  render(<MemoryRouter><NodeDetail /></MemoryRouter>);
  await screen.findByRole("heading", { level: 1, name: "Nodo Norte" });
  expect(within(cardOf("Humedad del Suelo")).getByText("Sin datos")).toBeVisible();
  expect(within(cardOf("E.T.O.")).getByText("Sin datos")).toBeVisible();
  expect(within(cardOf("Flujo de Agua")).getByText("0")).toBeVisible();
  expect(within(cardOf("Flujo de Agua")).queryByText("Sin datos")).toBeNull();
});

it("shows the freshness once and keeps support data behind a closed disclosure", async () => {
  serveNode({ soil: { humidity: 45 }, irrigation: { flow_per_minute: 1 }, environmental: { eto: 2 } });
  render(<MemoryRouter><NodeDetail /></MemoryRouter>);
  await screen.findByRole("heading", { level: 1, name: "Nodo Norte" });
  expect(screen.getAllByText(/Último dato:/)).toHaveLength(1);
  const trigger = screen.getByRole("button", { name: "Datos para soporte" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("SN-42")).toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByText("SN-42")).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Ubicación en la jerarquía" })).toHaveTextContent("Nodos");
});
