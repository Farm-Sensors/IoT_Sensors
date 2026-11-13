import { test, expect } from "./fixtures";

test("el cliente consulta sus métricas y cambia de área", async ({ clientPage: page }, testInfo) => {
  // La portada es el resumen «Mis predios»; el área se abre con su propia dirección.
  await page.goto("/cliente");
  await expect(page.getByRole("heading", { level: 1, name: "Mis predios" })).toBeVisible();
  await page.getByRole("link", { name: /DEMO - Nogal Norte/ }).first().click();
  await expect(page).toHaveURL(/\/cliente\/area\/\d+$/);
  // El encabezado del área es su nombre; las migas llevan de vuelta al predio y a Mis predios.
  await expect(page.getByRole("heading", { level: 1, name: "DEMO - Nogal Norte" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Mis predios" })).toBeVisible();

  // Primero termina la carga inicial: así la respuesta que se espera abajo es la de la recarga.
  await expect(page.getByRole("heading", { name: "Humedad del Suelo", exact: true })).toBeVisible();

  // El área tiene su propia dirección: recargarla repite la consulta de la última lectura.
  const areaId = new URL(page.url()).pathname.split("/").pop();
  const latest = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/readings/latest" &&
      url.searchParams.get("irrigation_area_id") === areaId && response.ok();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Humedad del Suelo", exact: true })).toBeVisible();
  const reading = await (await latest).json();
  await expect(page.getByRole("status", { name: "Cargando lecturas" })).toHaveCount(0);

  const metrics = [
    { title: "Humedad del Suelo", unit: "%", decimals: 1, value: reading.soil?.humidity },
    { title: "Flujo de Agua", unit: "L/min", decimals: 1, value: reading.irrigation?.flow_per_minute },
    { title: "E.T.O.", unit: "mm/día", decimals: 2, value: reading.environmental?.eto },
  ];
  let checkedMissing = false;
  for (const { title, unit, decimals, value } of metrics) {
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    // La tarjeta es el contenedor directo del título; la tarjeta prioritaria se muestra aunque falte el dato.
    const card = heading.locator("..");
    if (value === null) {
      // Un campo ausente se ve «Sin datos», nunca 0.
      await expect(card.getByText("Sin datos", { exact: true })).toBeVisible();
      checkedMissing = true;
    } else {
      // Misma precisión por magnitud que la app (utils/metricFormat.ts).
      const shown = value.toFixed(decimals).replace(/^-0(\.0+)?$/, (m) => m.slice(1));
      await expect(card.getByText(new RegExp(`^${shown.replace(/[.-]/g, "\\$&")} ${unit.replace(".", "\\.")}$`))).toBeVisible();
    }
  }
  const secondaryMetrics = [
    { label: "Conductividad", unit: "dS/m", value: reading.soil?.conductivity },
    { label: "Temperatura", unit: "°C", value: reading.soil?.temperature },
    { label: "Potencial hídrico", unit: "MPa", value: reading.soil?.water_potential },
    { label: "Temperatura del aire", unit: "°C", value: reading.environmental?.temperature },
    { label: "Humedad relativa", unit: "%", value: reading.environmental?.relative_humidity },
    { label: "Viento", unit: "km/h", value: reading.environmental?.wind_speed },
    { label: "Radiación solar", unit: "W/m²", value: reading.environmental?.solar_radiation },
  ];
  for (const { label, unit, value } of secondaryMetrics) {
    const fieldLabel = page.getByText(label, { exact: true });
    if (value !== null || !(await fieldLabel.isVisible())) continue;
    const field = page.locator("div").filter({ has: fieldLabel })
      .filter({ hasText: "Sin datos" }).last();
    await expect(field.getByText("Sin datos", { exact: true }).first()).toBeVisible();
    checkedMissing = true;
  }
  if (reading.irrigation?.accumulated_liters === null) {
    await expect(page.getByText("Acumulado: Sin datos", { exact: true })).toBeVisible();
    checkedMissing = true;
  }
  if (!checkedMissing) {
    testInfo.annotations.push({ type: "Sin datos", description:
      "Comprobación null omitida: no hay campos numéricos null renderizados en este dashboard del seed." });
  }
  await expect(page.getByText(/^Último dato /).first()).toBeVisible();
  await expect(page.locator("time").first()).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}T/);

  // Las pestañas del área llevan al Historial (con la descarga) y a los Detalles.
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await expect(page).toHaveURL(/\/cliente\/area\/\d+\/historial$/);
  await expect(page.getByRole("heading", { level: 2, name: "Gráfica", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Detalles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ciclo de cultivo" })).toBeVisible();
});
