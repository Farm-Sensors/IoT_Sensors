import { cleanup, render, screen } from "@testing-library/react";
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
