import { test, expect, e2eName } from "./fixtures";

// Solo escritorio: las tablas de administración no son un flujo móvil (design.md).
test.describe("Jerarquía de administración", () => {
  test.skip(({ isMobile }) => isMobile, "solo escritorio");

  const companies: string[] = [];

  test.afterEach(async ({ api }) => {
    for (const company of companies.splice(0)) await api.cleanupClient(company);
  });

  test("crea cliente, predio y área de riego", async ({ adminPage: page }) => {
    const company = e2eName("Empresa");
    const property = e2eName("Predio");
    const area = e2eName("Área");
    companies.push(company);

    // Cliente (ClientManagement.tsx). Sus labels no tienen `htmlFor`: se localiza cada campo
    // por el bloque que contiene el texto del label ("Sin nombre accesible").
    await page.goto("/admin/clientes");
    await page.getByRole("button", { name: "Nuevo Cliente" }).click();
    const form = page.locator("form").filter({ has: page.getByText("Nombre de la Empresa") });
    const field = (label: string) =>
      form.locator("div").filter({ has: page.getByText(label, { exact: true }) }).last().locator("input");
    await field("Nombre de la Empresa").fill(company);
    await field("Nombre de Contacto").fill("E2E Contacto");
    await field("Email").fill(`e2e-${Date.now()}@example.com`);
    await field("Contraseña (Temporal)").fill("e2e-pass-123");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Cliente creado de forma exitosa")).toBeVisible();

    await page.getByPlaceholder("Buscar por nombre, email o teléfono...").fill(company);
    const clientRow = page.getByRole("row").filter({ hasText: company });
    await expect(clientRow).toBeVisible();

    // Predio (PropertyManagement.tsx)
    await clientRow.getByRole("link", { name: "Predios" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Predios" })).toBeVisible();
    await page.getByRole("button", { name: "Nuevo Predio" }).click();
    await page.getByLabel("Nombre del Predio").fill(property);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Predio creado").first()).toBeVisible();
    await expect(page.getByText(property).first()).toBeVisible();

    // Área de riego (IrrigationAreaManagement.tsx)
    await page.getByRole("link", { name: "Áreas de Riego" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Áreas de Riego" })).toBeVisible();
    await page.getByRole("button", { name: "Nueva Área" }).click();
    await page.getByLabel("Nombre del Área").fill(area);
    await page.getByLabel("Tipo de Cultivo").selectOption({ label: "Nogal" });
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText(area).first()).toBeVisible();
  });
});
