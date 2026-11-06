import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearModulesCache, MODULES_OFF, type Modules } from "../../services/modules";
import { ModuleOffNotice } from "./ModuleOffNotice";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { sub: "7", rol: "admin" } }) }));

const serve = (modules: Modules) => mocks.get.mockResolvedValue({ data: modules });
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ModuleOffNotice />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.get.mockReset();
  clearModulesCache();
});
afterEach(cleanup);

describe("ModuleOffNotice", () => {
  it("avisa en las pantallas de un módulo apagado", async () => {
    serve(MODULES_OFF);
    renderAt("/admin/umbrales");
    expect((await screen.findByRole("status")).textContent).toContain("Esta función está desactivada por ahora.");
  });

  it("no avisa si el módulo está encendido ni fuera de Fase 2", async () => {
    serve({ ...MODULES_OFF, alerts: true });
    renderAt("/admin/umbrales");
    await vi.waitFor(() => expect(mocks.get).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    serve(MODULES_OFF);
    renderAt("/admin/clientes");
    await Promise.resolve();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
