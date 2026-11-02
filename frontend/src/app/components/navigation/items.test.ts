import { describe, expect, it } from "vitest";
import { MODULES_OFF } from "../../services/modules";
import { isNavItemActive, isSectionTabActive, navItemsFor, sectionTabsFor } from "./items";

describe("navegación v2", () => {
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

  it("con los módulos de Fase 2 encendidos el menú se agrupa en 5 y 6 destinos", () => {
    const on = { alerts: true, ai_assistant: true, ai_reports: true, notifications: true };
    expect(navItemsFor("client", on).map((i) => i.label)).toEqual(["Mis predios", "Mapa", "Alertas", "Asistente", "Cuenta"]);
    expect(navItemsFor("admin", on).map((i) => i.label)).toEqual(["Hoy", "Clientes", "Red", "Alertas", "Asistente", "Ajustes"]);
  });

  it("cada sección de Fase 2 solo muestra las pestañas de sus módulos encendidos", () => {
    const on = { alerts: true, ai_assistant: true, ai_reports: true, notifications: true };
    expect(sectionTabsFor("/cliente/alertas", on)?.map((t) => t.label)).toEqual(["Mis alertas", "Umbrales", "Correo y WhatsApp"]);
    expect(sectionTabsFor("/cliente/umbrales", { ...on, notifications: false })?.map((t) => t.label)).toEqual(["Mis alertas", "Umbrales"]);
    expect(sectionTabsFor("/admin/consumo-ia", on)?.map((t) => t.label)).toEqual(["Preguntar", "Reportes automáticos", "Consumo"]);
    expect(sectionTabsFor("/admin/alertas/12", on)?.map((t) => t.label)).toEqual(["Todas las alertas", "Umbrales"]);
    // Una sola pestaña visible: no hay barra.
    expect(sectionTabsFor("/cliente/reportes-ia", { ...on, ai_assistant: false })).toBeNull();
    expect(sectionTabsFor("/cliente/notificaciones", { ...MODULES_OFF, notifications: true })).toBeNull();
  });

  it("el destino de la sección apunta a su primera pestaña visible y se marca en todas sus rutas", () => {
    const only = { ...MODULES_OFF, ai_reports: true };
    const assistant = navItemsFor("client", only).find((i) => i.label === "Asistente")!;
    expect(assistant.path).toBe("/cliente/reportes-ia");
    const on = { alerts: true, ai_assistant: true, ai_reports: true, notifications: true };
    const alerts = navItemsFor("admin", on).find((i) => i.label === "Alertas")!;
    for (const path of ["/admin/alertas", "/admin/alertas/3", "/admin/umbrales"]) expect(isNavItemActive(alerts, path)).toBe(true);
    expect(isNavItemActive(alerts, "/admin/reportes-ia")).toBe(false);
  });
});
