import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Api } from "./fixtures";

const baselinePath = fileURLToPath(new URL("./a11y-baseline.json", import.meta.url));
type Baseline = { version: 1; units: Record<string, Record<string, number>> };
const update = process.env.A11Y_UPDATE_BASELINE === "1";

// Identificadores estables de pantalla: los IDs de BD nunca forman parte del baseline.
const clientRoutes = ["/cliente", "/cliente/areas", "/cliente/predio/:predioId", "/cliente/mapa", "/cliente/historico", "/cliente/exportar", "/cliente/perfil"];
const adminRoutes = ["/admin", "/admin/clientes", "/admin/clientes/:clientId/predios", "/admin/clientes/:clientId/dashboard", "/admin/predios/:predioId/areas", "/admin/cultivos", "/admin/ciclos", "/admin/nodos", "/admin/nodos/:nodeId", "/admin/gateways", "/admin/gateways/:gatewayId", "/admin/gateways/pair", "/admin/mapa"];
const forms = [
  { route: "/admin/clientes", button: "Nuevo Cliente", heading: "Nuevo Cliente" },
  { route: "/admin/predios/:predioId/areas", button: "Nueva Área", heading: "Nueva Área de Riego" },
  { route: "/admin/cultivos", button: "Nuevo Cultivo", heading: "Nuevo Tipo de Cultivo" },
  { route: "/admin/ciclos", button: "Nuevo Ciclo", heading: "Nuevo Ciclo de Cultivo" },
  { route: "/admin/nodos", button: "Nuevo Nodo", heading: "Nuevo Nodo IoT" },
  { route: "/admin/gateways/:gatewayId", button: "Revocar enlace", heading: /^¿Revocar el enlace de / },
];
let seed: Promise<Record<string, number>> | undefined;
function seedIds(api: Api) {
  return seed ??= (async () => {
    const properties = await api.get<{ data: { id: number; client_id: number; name: string }[] }>("properties?per_page=200");
    const property = properties.data.find(p => p.name === "DEMO - Rancho Norte");
    expect(property, "predio DEMO del seed").toBeTruthy();
    const areas = await api.get<{ data: { id: number }[] }>(`irrigation-areas?property_id=${property!.id}&per_page=200`);
    expect(areas.data.length, "áreas DEMO").toBeGreaterThan(0);
    const nodes = await api.get<{ data: { id: number; irrigation_area_id: number }[] }>("nodes?per_page=200");
    const node = nodes.data.find(n => n.irrigation_area_id === areas.data[0].id);
    expect(node, "nodo del área DEMO").toBeTruthy();
    return { predioId: property!.id, clientId: property!.client_id, nodeId: node!.id, gatewayId: await api.gatewayIdOf(1) };
  })();
}

type Screen = { route: string; role: string; form?: typeof forms[number] };
const screens: Screen[] = [
  { route: "/", role: "guest" },
  ...clientRoutes.map(route => ({ route, role: "client" })),
  ...adminRoutes.map(route => ({ route, role: "admin" })),
  ...forms.map(form => ({ route: form.route, role: "admin", form })),
];
for (const screen of screens) {
  const form = screen.form;
  const id = `${screen.route}${form ? ` :: ${form.button}` : ""}`;
  test(`accesibilidad ${id}`, async ({ page, clientPage, adminPage, api }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(Boolean(form) && testInfo.project.name !== "desktop", "Estados abiertos solo en escritorio");
    const target = screen.role === "guest" ? page : screen.role === "client" ? clientPage : adminPage;
    const ids: Record<string, number> = screen.role === "guest" ? {} : await seedIds(api);
    const route = screen.route.replace(/:(\w+)/g, (_, name: string) => String(ids[name]));
    await target.goto(route);
    await expect(target.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await target.waitForLoadState("networkidle");
    if (screen.route === "/cliente") {
      await target.getByRole("combobox").filter({ has: target.getByRole("option", { name: "DEMO - Rancho Norte", exact: true }) }).selectOption({ label: "DEMO - Rancho Norte" });
      await target.getByRole("combobox").filter({ has: target.getByRole("option", { name: "DEMO - Nogal Norte", exact: true }) }).selectOption({ label: "DEMO - Nogal Norte" });
      await expect(target.getByRole("heading", { name: "Humedad del Suelo", exact: true })).toBeVisible();
    }
    await target.waitForLoadState("networkidle");
    await expect(target.getByRole("heading", { name: "¡Ups! Algo salió mal", exact: true })).toHaveCount(0);
    if (form) {
      await target.getByRole("button", { name: form.button, exact: true }).click();
      await expect(target.getByRole("heading", { name: form.heading, exact: true })).toBeVisible();
    }
    // El puntero sobre un botón cambia su color (hover) y hace variar el contraste medido.
    await target.mouse.move(0, 0);
    // Deja terminar las animaciones de entrada (opacidad) antes de medir contraste.
    await target.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running"));
    try {
      const results = await new AxeBuilder({ page: target }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const violations = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
      const counts = Object.fromEntries(violations.map(v => [v.id, v.nodes.length]));
      const unit = `${testInfo.project.name} ${id}`;
      console.log(`A11Y ${unit}: ${JSON.stringify(counts)}`);
      await testInfo.attach("axe-summary", { body: JSON.stringify({ unit, counts, violations }, null, 2), contentType: "application/json" });
      let baseline: Baseline;
      try { baseline = JSON.parse(readFileSync(baselinePath, "utf8")); }
      catch (error) { if (!update || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error; baseline = { version: 1, units: {} }; }
      expect(baseline.version).toBe(1);
      if (update) {
        baseline.units[unit] = counts;
        baseline.units = Object.fromEntries(Object.entries(baseline.units).sort(([a], [b]) => a.localeCompare(b)));
        writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
        return;
      }
      const previous = baseline.units[unit];
      expect(previous, `Falta baseline para ${unit}`).toBeDefined();
      const regressions = violations.filter(v => v.nodes.length > (previous[v.id] ?? 0));
      for (const violation of regressions) console.error(`${unit}: ${violation.id} ${violation.helpUrl}\n${violation.nodes.map(n => JSON.stringify(n.target)).join("\n")}`);
      for (const [rule, count] of Object.entries(previous)) {
        if ((counts[rule] ?? 0) < count) console.log(`Baseline puede bajar: ${id} ${testInfo.project.name} ${rule}`);
      }
      expect(regressions.map(v => v.id), `Regresiones de accesibilidad en ${unit}`).toEqual([]);
    } finally {
      if (form?.button === "Revocar enlace") await target.getByRole("button", { name: "Cancelar", exact: true }).click();
    }
  });
}
