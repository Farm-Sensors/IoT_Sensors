import { describe, expect, it } from "vitest";
import { isNavItemActive, isSectionTabActive, moduleForPath, navItemsFor, sectionTabsFor } from "./items";

describe("navegación v2", () => {
  it("el menú siempre agrupa en 6 destinos (admin) y 5 (productor), con los módulos de Fase 2 apagados o no", () => {
    expect(navItemsFor("admin").map((i) => i.label)).toEqual(["Inicio", "Clientes", "Red", "Alertas", "Asistente", "Ajustes"]);
    expect(navItemsFor("client").map((i) => i.label)).toEqual(["Mis predios", "Mapa", "Alertas", "Asistente", "Cuenta"]);
  });

  it("las rutas antiguas siguen marcando su destino nuevo", () => {
    const admin = navItemsFor("admin");
    const current = (path: string) => admin.filter((i) => isNavItemActive(i, path)).map((i) => i.label);
    expect(current("/admin")).toEqual(["Inicio"]);
    expect(current("/admin/predios/3/areas")).toEqual(["Clientes"]);
    expect(current("/admin/ciclos")).toEqual(["Clientes"]);
    expect(current("/admin/areas/4")).toEqual(["Clientes"]);
    expect(current("/admin/nodos/5")).toEqual(["Red"]);
    expect(current("/admin/gateways/pair")).toEqual(["Red"]);
    expect(current("/admin/auditoria")).toEqual(["Ajustes"]);
    const client = navItemsFor("client");
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

  it("cada sección de Fase 2 muestra todas sus pestañas", () => {
    expect(sectionTabsFor("/cliente/alertas")?.map((t) => t.label)).toEqual(["Mis alertas", "Umbrales", "Correo y WhatsApp"]);
    expect(sectionTabsFor("/cliente/reportes-ia")?.map((t) => t.label)).toEqual(["Preguntar", "Reportes automáticos"]);
    expect(sectionTabsFor("/admin/consumo-ia")?.map((t) => t.label)).toEqual(["Preguntar", "Reportes automáticos", "Consumo"]);
    expect(sectionTabsFor("/admin/alertas/12")?.map((t) => t.label)).toEqual(["Todas las alertas", "Umbrales"]);
  });

  it("cada ruta de Fase 2 sabe de qué módulo depende", () => {
    expect(moduleForPath("/admin/umbrales")).toBe("alerts");
    expect(moduleForPath("/admin/alertas/3")).toBe("alerts");
    expect(moduleForPath("/cliente/notificaciones")).toBe("notifications");
    expect(moduleForPath("/admin/reportes-ia/9")).toBe("ai_reports");
    expect(moduleForPath("/admin/consumo-ia")).toBe("ai_assistant");
    expect(moduleForPath("/admin/clientes")).toBeNull();
  });

  it("el destino de la sección apunta a su primera pestaña y se marca en todas sus rutas", () => {
    expect(navItemsFor("client").find((i) => i.label === "Asistente")!.path).toBe("/cliente/asistente-ia");
    const alerts = navItemsFor("admin").find((i) => i.label === "Alertas")!;
    for (const path of ["/admin/alertas", "/admin/alertas/3", "/admin/umbrales"]) expect(isNavItemActive(alerts, path)).toBe(true);
    expect(isNavItemActive(alerts, "/admin/reportes-ia")).toBe(false);
  });
});
