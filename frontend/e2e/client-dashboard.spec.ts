import { test, expect } from "./fixtures";

test("el cliente consulta sus métricas y cambia de área", async ({ clientPage: page }, testInfo) => {
  await page.goto("/cliente");
  await expect(page.getByRole("heading", { level: 1, name: /^Hola, / })).toBeVisible();

  // Sin nombre accesible: identificar cada select por su opción con nombre,
  // sin depender del orden, las clases o los IDs del seed.
  const property = page.getByRole("combobox").filter({
    has: page.getByRole("option", { name: "DEMO - Rancho Norte", exact: true }),
  });
  await property.selectOption({ label: "DEMO - Rancho Norte" });
  const area = page.getByRole("combobox").filter({
    has: page.getByRole("option", { name: "DEMO - Nogal Norte", exact: true }),
  });
  const areaId = await area.getByRole("option", { name: "DEMO - Nogal Norte", exact: true }).getAttribute("value");
  // Pasar por otra área garantiza una nueva consulta sin recargar ni perder
  // el cuerpo de la respuesta durante una navegación.
  await area.selectOption({ label: "DEMO - Alfalfa Este" });
  await expect(page.getByRole("heading", { name: "Humedad del Suelo", exact: true })).toBeVisible();
  const latest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/readings/latest" &&
      url.searchParams.get("irrigation_area_id") === areaId && response.ok();
  });
  await area.selectOption({ label: "DEMO - Nogal Norte" });
  const reading = await (await latest).json();
  await expect(page.getByRole("status", { name: "Cargando lecturas" })).toHaveCount(0);

  const metrics = [
    { title: "Humedad del Suelo", unit: "%", value: reading.soil?.humidity },
    { title: "Flujo de Agua", unit: "L/min", value: reading.irrigation?.flow_per_minute },
    { title: "E.T.O.", unit: "mm/día", value: reading.environmental?.eto },
  ];
  let checkedMissing = false;
  for (const { title, unit, value } of metrics) {
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    // El contenedor más cercano que incluye título y unidad es la tarjeta.
    const card = page.locator("div").filter({ has: heading })
      .filter({ has: page.getByText(unit, { exact: true }) }).last();
    await expect(card.getByText(unit, { exact: true })).toBeVisible();
    if (value === null) {
      await expect(card.getByText("Sin datos", { exact: true })).toBeVisible();
      checkedMissing = true;
    }
  }
  const secondaryMetrics = [
    { label: "Conductividad", unit: "dS/m", value: reading.soil?.conductivity },
    { label: "Temperatura", unit: "°C", value: reading.soil?.temperature },
    { label: "Potencial hídrico", unit: "MPa", value: reading.soil?.water_potential },
    { label: "Temperatura aire", unit: "°C", value: reading.environmental?.temperature },
    { label: "Humedad relativa", unit: "%", value: reading.environmental?.relative_humidity },
    { label: "Viento", unit: "km/h", value: reading.environmental?.wind_speed },
    { label: "Radiación solar", unit: "W/m²", value: reading.environmental?.solar_radiation },
  ];
  for (const { label, unit, value } of secondaryMetrics) {
    const fieldLabel = page.getByText(label, { exact: true });
    if (value !== null || !(await fieldLabel.isVisible())) continue;
    const field = page.locator("div").filter({ has: fieldLabel })
      .filter({ hasText: `Sin datos ${unit}` }).last();
    await expect(field.getByText(`Sin datos ${unit}`, { exact: true })).toBeVisible();
    checkedMissing = true;
  }
  if (reading.irrigation?.accumulated_liters === null) {
    await expect(page.getByText("Acumulado: Sin datos L", { exact: true })).toBeVisible();
    checkedMissing = true;
  }
  if (!checkedMissing) {
    testInfo.annotations.push({ type: "Sin datos", description:
      "Comprobación null omitida: no hay campos numéricos null renderizados en este dashboard del seed." });
  }
  await expect(page.getByText(/Último dato:/).first()).toBeVisible();
  await expect(page.locator("time").first()).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}T/);

  await area.selectOption({ label: "DEMO - Alfalfa Este" });
  await expect(area.getByRole("option", { name: "DEMO - Alfalfa Este", exact: true })).toHaveJSProperty("selected", true);
  // El contexto visible en otra pantalla confirma que el cambio se conserva.
  await page.getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("Área: DEMO - Alfalfa Este", { exact: true })).toBeVisible();
});
