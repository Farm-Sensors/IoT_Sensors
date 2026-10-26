import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearModulesCache, MODULES_OFF, type Modules } from "../../services/modules";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileTabBar } from "./MobileTabBar";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "7", rol: "admin", nombre: "Ana" }, logout: vi.fn() }),
}));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));

const ALL_ON: Modules = { alerts: true, ai_assistant: true, ai_reports: true, notifications: true };
const PHASE2 = {
  client: ["Alertas", "Asistente IA", "Reportes IA", "Umbrales", "Notificaciones"],
  admin: ["Umbrales", "Alertas", "Asistente IA", "Consumo IA", "Reportes IA"],
} as const;

function serveModules(modules: Modules) {
  mocks.get.mockImplementation((path: string) =>
    path === "/settings/modules" ? Promise.resolve({ data: modules }) : Promise.reject(new Error(path)),
  );
}

beforeEach(() => {
  mocks.get.mockReset();
  clearModulesCache();
});
afterEach(cleanup);

describe.each(["client", "admin"] as const)("%s navigation", (role) => {
  it("hides Phase 2 modules while they are off", async () => {
    serveModules(MODULES_OFF);
    render(<MemoryRouter><DesktopSidebar role={role} /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/settings/modules"));
    expect(screen.getByText("Dashboard")).toBeTruthy();
    for (const label of PHASE2[role]) expect(screen.queryByText(label)).toBeNull();
  });

  it("shows Phase 2 modules once they are on", async () => {
    serveModules(ALL_ON);
    render(<MemoryRouter><DesktopSidebar role={role} /></MemoryRouter>);
    for (const label of PHASE2[role]) expect(await screen.findByText(label)).toBeTruthy();
  });

  it("filters the mobile tab bar the same way and asks the server only once", async () => {
    serveModules({ ...MODULES_OFF, ai_reports: true });
    const { unmount } = render(<MemoryRouter><MobileTabBar role={role} /></MemoryRouter>);
    expect(await screen.findByLabelText("IA")).toBeTruthy();
    expect(screen.queryByLabelText("Alertas")).toBeNull();
    expect(screen.queryByLabelText("Chat IA")).toBeNull();
    unmount();
    render(<MemoryRouter><MobileTabBar role={role} /></MemoryRouter>);
    expect(screen.getByLabelText("IA")).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
});
