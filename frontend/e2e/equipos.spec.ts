import { test, expect, e2eName } from "./fixtures";

// Solo escritorio. Flujo del asistente de GatewayManagement.tsx y revocación en GatewayDetail.tsx.
test.describe("Equipos", () => {
  test.skip(({ isMobile }) => isMobile, "solo escritorio");

  const companies: string[] = [];

  test.afterEach(async ({ api }) => {
    for (const company of companies.splice(0)) await api.cleanupClient(company);
  });

  test("vincula un equipo, asigna nodos y revoca el enlace", async ({ adminPage: page, api }) => {
    const company = e2eName("Empresa");
    const propertyName = e2eName("Predio");
    const areaName = e2eName("Área");
    companies.push(company);
    const client = await api.createClient(company);
    const property = await api.createProperty(client.id, propertyName);
    await api.createArea(property.id, areaName);

    // Paso 1: rancho y áreas
    await page.goto("/admin/gateways");
    await page.getByRole("button", { name: "Nuevo equipo" }).click();
    await page.getByRole("combobox", { name: "Rancho" }).selectOption({ label: `${propertyName} · ${company}` });
    await page.getByLabel(areaName).check();
    await page.getByRole("button", { name: "Crear y continuar" }).click();

    // Paso 2: vincular equipo (es el paso abierto)
    await expect(page.getByRole("heading", { level: 3, name: "Vincular equipo" })).toBeVisible();
    await page.getByText("¿El equipo no muestra código?").click();
    await page.getByRole("button", { name: "Generar referencia" }).click();
    const reference = page.getByText(/^ar_/);
    await expect(reference).toBeVisible();
    await expect(page.getByAltText("QR de la referencia")).toBeVisible();
    const value = (await reference.textContent())!.trim();
    expect(value).toMatch(/^ar_/);

    // El equipo canjea la referencia
    await api.activateDevice(value);
    const gatewayId = await api.gatewayIdOf(property.id);

    // Paso 3: asignar nodos
    await page.goto(`/admin/gateways?gateway=${gatewayId}`);
    await expect(page.getByRole("heading", { level: 3, name: "Asignar nodos" })).toBeVisible();

    // En la lista, la tarjeta del rancho está «Asignando nodos»
    await page.getByRole("button", { name: "Volver a la lista" }).click();
    const card = page.getByRole("listitem").filter({ hasText: propertyName });
    await expect(card.getByText("Asignando nodos")).toBeVisible();

    // Detalle: revocar el enlace
    await page.goto(`/admin/gateways/${gatewayId}`);
    await page.getByRole("button", { name: "Revocar enlace" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Revocar enlace" }).click();
    await expect(page.getByText("Revocado", { exact: true })).toBeVisible();
  });
});
