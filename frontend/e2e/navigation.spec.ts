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
  { desktop: "Dashboard", mobile: "Inicio", path: "/cliente", h1: /^Hola, / },
  { desktop: "Predios", mobile: "Predios", path: "/cliente/areas", h1: "Predios y Áreas de Riego" },
  { desktop: "Mapa", mobile: "Mapa", path: "/cliente/mapa", h1: "Mapa de Nodos" },
  { desktop: "Histórico", mobile: "Histórico", path: "/cliente/historico", h1: "Datos Históricos" },
  { desktop: "Exportar", mobile: "Exportar", path: "/cliente/exportar", h1: "Exportar Datos" },
  { desktop: "Perfil", mobile: "Perfil", path: "/cliente/perfil", h1: "Mi Perfil" },
];

const ADMIN_ENTRIES: Entry[] = [
  { desktop: "Dashboard", mobile: "Inicio", path: "/admin", h1: "Panel de Administración" },
  { desktop: "Clientes", mobile: "Clientes", path: "/admin/clientes", h1: "Gestión de Clientes" },
  { desktop: "Mapa", mobile: "Mapa", path: "/admin/mapa", h1: "Mapa Global de Nodos" },
  { desktop: "Nodos", mobile: "Nodos", path: "/admin/nodos", h1: "Gestión de Nodos" },
  { desktop: "Equipos", mobile: "Equipos", path: "/admin/gateways", h1: "Equipos" },
  { desktop: "Catálogo", mobile: "Catálogo", path: "/admin/cultivos", h1: "Catálogo de Cultivos" },
  { desktop: "Auditoría", mobile: "Auditoría", path: "/admin/auditoria", h1: "Bitácora de Auditoría" },
];

// Ítems con `module` (Fase 2): con los flags apagados en local no deben aparecer.
const CLIENT_HIDDEN = ["Alertas", "Asistente IA", "Chat IA", "Reportes IA", "IA", "Umbrales", "Notificaciones", "Notifs"];
const ADMIN_HIDDEN = ["Umbrales", "Alertas", "Asistente IA", "Chat IA", "Consumo IA", "Uso IA", "Reportes IA", "IA"];

const ROLES = [
  { role: "admin", home: "/admin", entries: ADMIN_ENTRIES, hidden: ADMIN_HIDDEN },
  { role: "cliente", home: "/cliente", entries: CLIENT_ENTRIES, hidden: CLIENT_HIDDEN },
] as const;

for (const { role, home, entries, hidden } of ROLES) {
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
      await expect(menu.getByRole("link", { name: mobile ? "Inicio" : "Dashboard", exact: true })).toBeVisible();

      for (const name of hidden) {
        await expect(menu.getByRole("link", { name, exact: true })).toHaveCount(0);
      }
    });
  });
}
