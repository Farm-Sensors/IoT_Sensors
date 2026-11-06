import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearModulesCache, MODULES_OFF, type Modules } from "../../services/modules";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { SectionTabs } from "./SectionTabs";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "7", rol: "admin", nombre: "Ana" }, logout: vi.fn() }),
}));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));

const PHASE2 = { client: ["Alertas", "Asistente"], admin: ["Alertas", "Asistente"] } as const;

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
  it("shows the Phase 2 sections even while their modules are off, without asking the server", () => {
    serveModules(MODULES_OFF);
    render(<MemoryRouter><DesktopSidebar role={role} /></MemoryRouter>);
    expect(screen.getByText(role === "client" ? "Mis predios" : "Inicio")).toBeTruthy();
    for (const label of PHASE2[role]) expect(screen.getByText(label)).toBeTruthy();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("the mobile tab bar also lists them, pointing at each section's first tab", () => {
    render(<MemoryRouter><MobileTabBar role={role} /></MemoryRouter>);
    const base = role === "client" ? "cliente" : "admin";
    expect(screen.getByLabelText("Alertas")).toHaveAttribute("href", `/${base}/alertas`);
    expect(screen.getByLabelText("Asistente")).toHaveAttribute("href", `/${base}/asistente-ia`);
  });
});

describe("section tabs", () => {
  it("label the tabs of modules that are off with «Desactivado»", async () => {
    serveModules({ ...MODULES_OFF, alerts: true });
    render(
      <MemoryRouter initialEntries={["/cliente/alertas"]}>
        <SectionTabs />
      </MemoryRouter>,
    );
    const channels = screen.getByRole("link", { name: /Correo y WhatsApp/ });
    await waitFor(() => expect(channels.textContent).toContain("Desactivado"));
    expect(screen.getByRole("link", { name: /Umbrales/ }).textContent).not.toContain("Desactivado");
  });
});

describe("current page marker", () => {
  it("marks the current entry with aria-current and a non-color indicator, on desktop and mobile", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin/clientes"]}>
        <DesktopSidebar role="admin" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeTruthy();
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("Clientes");
    // Indicador que no depende del color: el destino actual va en negrita.
    expect(current[0].className).toContain("font-semibold");
    unmount();

    render(
      <MemoryRouter initialEntries={["/admin/clientes"]}>
        <MobileTabBar role="admin" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeTruthy();
    expect(screen.getByLabelText("Clientes")).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Red")).not.toHaveAttribute("aria-current");
  });
});
