import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearModulesCache, MODULES_OFF, type Modules } from "../services/modules";
import { AdminLayout } from "./AdminLayout";
import { ClientLayout } from "./ClientLayout";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { sub: "7", rol: "admin", nombre: "Ana" } }) }));
vi.mock("../context/SelectionContext", () => ({ SelectionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../components/navigation/DesktopSidebar", () => ({ DesktopSidebar: () => null }));
vi.mock("../components/navigation/MobileTabBar", () => ({ MobileTabBar: () => null }));
vi.mock("../components/notifications/AlertsPopover", () => ({ AlertsPopover: () => <button>Campana de alertas</button> }));

function serveModules(modules: Modules) {
  mocks.get.mockImplementation((path: string) =>
    path === "/settings/modules" ? Promise.resolve({ data: modules }) : Promise.reject(new Error(path)),
  );
}

beforeAll(() => {
  // jsdom no implementa scrollTo; los layouts lo llaman al cambiar de ruta.
  Element.prototype.scrollTo ??= () => {};
});
beforeEach(() => {
  mocks.get.mockReset();
  clearModulesCache();
});
afterEach(cleanup);

describe.each([["admin", AdminLayout], ["client", ClientLayout]] as const)("%s layout", (_role, Layout) => {
  it("hides the alerts bell while the alerts module is off", async () => {
    serveModules(MODULES_OFF);
    render(<MemoryRouter><Layout /></MemoryRouter>);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/settings/modules"));
    expect(screen.queryByText("Campana de alertas")).toBeNull();
  });

  it("shows the alerts bell once the alerts module is on", async () => {
    serveModules({ ...MODULES_OFF, alerts: true });
    render(<MemoryRouter><Layout /></MemoryRouter>);
    expect(await screen.findByText("Campana de alertas")).toBeTruthy();
  });
});
