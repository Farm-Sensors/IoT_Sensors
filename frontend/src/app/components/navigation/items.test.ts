import { describe, expect, it } from "vitest";
import { MODULES_OFF } from "../../services/modules";
import { isNavItemActive, isSectionTabActive, navItemsFor, sectionTabsFor } from "./items";

describe("navegación v2 (fase 1)", () => {
  it("el admin tiene 4 destinos con los módulos de Fase 2 apagados y el productor 3", () => {
    expect(navItemsFor("admin", MODULES_OFF).map((i) => i.label)).toEqual(["Hoy", "Clientes", "Red", "Ajustes"]);
    expect(navItemsFor("client", MODULES_OFF).map((i) => i.label)).toEqual(["Mis predios", "Mapa", "Cuenta"]);
  });

  it("las rutas antiguas siguen marcando su destino nuevo", () => {
    const admin = navItemsFor("admin", MODULES_OFF);
    const current = (path: string) => admin.filter((i) => isNavItemActive(i, path)).map((i) => i.label);
    expect(current("/admin")).toEqual(["Hoy"]);
    expect(current("/admin/predios/3/areas")).toEqual(["Clientes"]);
    expect(current("/admin/ciclos")).toEqual(["Clientes"]);
    expect(current("/admin/areas/4")).toEqual(["Clientes"]);
    expect(current("/admin/nodos/5")).toEqual(["Red"]);
    expect(current("/admin/gateways/pair")).toEqual(["Red"]);
    expect(current("/admin/auditoria")).toEqual(["Ajustes"]);
    const client = navItemsFor("client", MODULES_OFF);
        for (const path of ["/cliente", "/cliente/area/7", "/cliente/areas", "/cliente/predio/2", "/cliente/area/7/historial", "/cliente/exportar"]) {
      expect(client.filter((i) => isNavItemActive(i, path)).map((i) => i.label)).toEqual(["Mis predios"]);
    }
    expect(client.filter((i) => isNavItemActive(i, "/cliente/mapa")).map((i) => i.label)).toEqual(["Mapa"]);
  });

  it("Ciclos de cultivo ya tiene enlace desde la sección Clientes", () => {
    const tabs = sectionTabsFor("/admin/clientes");
    expect(tabs?.map((t) => t.path)).toContain("/admin/ciclos");
    expect(sectionTabsFor("/admin")).toBeNull();
    expect(isSectionTabActive(tabs![0], "/admin/clientes/1/predios")).toBe(true);
  });
});
