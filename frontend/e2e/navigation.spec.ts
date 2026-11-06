import { test, expect } from "./fixtures";

interface Entry {
  /** Nombre accesible del enlace en escritorio (`label`) y en móvil (`mobileLabel ?? label`). */
  desktop: string;
  mobile: string;
  path: string;
  h1: string | RegExp;
}

// Fuente: components/navigation/items.ts (destinos sin módulo) y el h1 de cada página.
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

// Secciones de Fase 2: se muestran aunque sus módulos estén apagados (flags OFF en local); cada pestaña
// abre su página con el aviso de «desactivada» y sin error.
interface Phase2Tab { section: string; tab: string; path: string }
const CLIENT_PHASE2: Phase2Tab[] = [
  { section: "Alertas", tab: "Mis alertas", path: "/cliente/alertas" },
  { section: "Alertas", tab: "Umbrales", path: "/cliente/umbrales" },
  { section: "Alertas", tab: "Correo y WhatsApp", path: "/cliente/notificaciones" },
  { section: "Asistente", tab: "Preguntar", path: "/cliente/asistente-ia" },
  { section: "Asistente", tab: "Reportes automáticos", path: "/cliente/reportes-ia" },
];
const ADMIN_PHASE2: Phase2Tab[] = [
  { section: "Alertas", tab: "Todas las alertas", path: "/admin/alertas" },
  { section: "Alertas", tab: "Umbrales", path: "/admin/umbrales" },
  { section: "Asistente", tab: "Preguntar", path: "/admin/asistente-ia" },
  { section: "Asistente", tab: "Reportes automáticos", path: "/admin/reportes-ia" },
  { section: "Asistente", tab: "Consumo", path: "/admin/consumo-ia" },
];

const ROLES = [
  { role: "admin", home: "/admin", homeLabel: "Inicio", entries: ADMIN_ENTRIES, phase2: ADMIN_PHASE2 },
  { role: "cliente", home: "/cliente", homeLabel: "Mis predios", entries: CLIENT_ENTRIES, phase2: CLIENT_PHASE2 },
] as const;

for (const { role, home, homeLabel, entries, phase2 } of ROLES) {
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

    test("muestra las secciones de Fase 2 con los módulos apagados y avisa en cada página", async ({ adminPage, clientPage }, testInfo) => {
      const page = role === "admin" ? adminPage : clientPage;
      const mobile = testInfo.project.name === "mobile";
      const menu = mobile ? page : page.getByRole("navigation");
      await page.goto(home);
      await expect(menu.getByRole("link", { name: homeLabel, exact: true })).toBeVisible();

      for (const { section, tab, path } of phase2) {
        await menu.getByRole("link", { name: section, exact: true }).first().click();
        await page.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: new RegExp(`^${tab}`) }).click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: "Esta función está desactivada por ahora." })).toBeVisible();
        await expect(page.getByRole("heading", { name: "¡Ups! Algo salió mal", exact: true })).toHaveCount(0);
        await expect(page.getByRole("alert")).toHaveCount(0);
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

test("el Inicio del admin enlaza a Umbrales", async ({ adminPage: page }) => {
  await page.goto("/admin");
  await page.getByRole("main").getByRole("link", { name: "Umbrales", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/umbrales$/);
});
