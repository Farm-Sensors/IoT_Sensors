import { test, expect } from "./fixtures";

interface Entry {
  /** Nombre accesible del enlace en escritorio (`label`) y en móvil (`mobileLabel ?? label`). */
  desktop: string;
  mobile: string;
  path: string;
  h1: string | RegExp;
}

// Fuente: components/navigation/items.ts (ítems sin `module`) y el h1 de cada página.
const CLIENT_ENTRIES: Entry[] = [
  { desktop: "Mis predios", mobile: "Mis predios", path: "/cliente", h1: "Mis predios" },
  { desktop: "Mapa", mobile: "Mapa", path: "/cliente/mapa", h1: "Mapa" },
  { desktop: "Cuenta", mobile: "Cuenta", path: "/cliente/perfil", h1: "Cuenta" },
];

const ADMIN_ENTRIES: Entry[] = [
  { desktop: "Inicio", mobile: "Inicio", path: "/admin", h1: "Inicio" },
  { desktop: "Clientes", mobile: "Clientes", path: "/admin/clientes", h1: "Clientes" },
  { desktop: "Red", mobile: "Red", path: "/admin/gateways", h1: "Equipos" },
  { desktop: "Ajustes", mobile: "Ajustes", path: "/admin/cultivos", h1: "Catálogo de Cultivos" },
];

// Ítems con `module` (Fase 2): con los flags apagados en local no deben aparecer.
const CLIENT_HIDDEN = ["Alertas", "Asistente IA", "Chat IA", "Reportes IA", "IA", "Umbrales", "Notificaciones", "Notifs"];
const ADMIN_HIDDEN = ["Umbrales", "Alertas", "Asistente IA", "Chat IA", "Consumo IA", "Uso IA", "Reportes IA", "IA"];

const ROLES = [
  { role: "admin", home: "/admin", homeLabel: "Inicio", entries: ADMIN_ENTRIES, hidden: ADMIN_HIDDEN },
  { role: "cliente", home: "/cliente", homeLabel: "Mis predios", entries: CLIENT_ENTRIES, hidden: CLIENT_HIDDEN },
] as const;

for (const { role, home, homeLabel, entries, hidden } of ROLES) {
  test.describe(`Navegación del ${role}`, () => {
    test("cada entrada del menú abre su página", async ({ adminPage, clientPage }, testInfo) => {
      const page = role === "admin" ? adminPage : clientPage;
      const mobile = testInfo.project.name === "mobile";
      // En escritorio los enlaces viven en la barra lateral (<nav>); en móvil, en la barra de tabs.
      const menu = mobile ? page : page.getByRole("navigation");
      await page.goto(home);

      for (const entry of entries) {
        await menu.getByRole("link", { name: mobile ? entry.mobile : entry.desktop, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${entry.path}$`));
        await expect(page.getByRole("heading", { level: 1, name: entry.h1 })).toBeVisible();
      }
    });

    test("no muestra las entradas de módulos apagados", async ({ adminPage, clientPage }, testInfo) => {
      const page = role === "admin" ? adminPage : clientPage;
      const mobile = testInfo.project.name === "mobile";
      const menu = mobile ? page : page.getByRole("navigation");
      await page.goto(home);
      await expect(menu.getByRole("link", { name: homeLabel, exact: true })).toBeVisible();

      for (const name of hidden) {
        await expect(menu.getByRole("link", { name, exact: true })).toHaveCount(0);
      }
    });
  });
}

test.describe("Pestañas de sección del admin", () => {
  test("llevan a las pantallas hermanas, incluido Ciclos que antes no tenía enlace", async ({ adminPage: page }) => {
    await page.goto("/admin/clientes");
    const tabs = page.getByRole("navigation", { name: "Secciones" });
    await tabs.getByRole("link", { name: "Ciclos de cultivo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ciclos de cultivo" })).toBeVisible();
    await page.goto("/admin/gateways");
    await tabs.getByRole("link", { name: "Nodos" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nodos" })).toBeVisible();
    await tabs.getByRole("link", { name: "Mapa" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mapa" })).toBeVisible();
    await page.goto("/admin/cultivos");
    await tabs.getByRole("link", { name: "Registro de eventos" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Registro de eventos" })).toBeVisible();
  });
});
