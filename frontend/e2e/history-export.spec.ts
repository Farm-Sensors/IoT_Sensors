import { stat } from "node:fs/promises";
import { format, startOfMonth, subMonths, subYears } from "date-fns";
import { es } from "date-fns/locale";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function selectDemoArea(page: Page) {
  // SelectionScopeBar: los labels envolventes no tienen texto accesible.
  await page.getByRole("combobox").filter({
    has: page.getByRole("option", { name: "DEMO - Rancho Norte", exact: true }),
  }).selectOption({ label: "DEMO - Rancho Norte" });
  await page.getByRole("combobox").filter({
    has: page.getByRole("option", { name: "DEMO - Nogal Norte", exact: true }),
  }).selectOption({ label: "DEMO - Nogal Norte" });
  await expect(page.getByText("Área: DEMO - Nogal Norte", { exact: true })).toBeVisible();
}

async function pickDay(page: Page, trigger: string, day: Date, displayedMonth: Date) {
  await page.getByRole("button", { name: trigger, exact: true }).click();
  const popover = page.getByRole("dialog");
  // react-day-picker v8 expone los días como gridcell con el número como nombre.
  let month = startOfMonth(displayedMonth);
  while (month > startOfMonth(day)) {
    await popover.getByRole("button", { name: "Go to previous month", exact: true }).click();
    month = subMonths(month, 1);
    await expect(popover.getByRole("grid", { name: format(month, "LLLL y", { locale: es }), exact: true })).toBeVisible();
  }
  await popover.getByRole("gridcell", { name: String(day.getDate()), exact: true }).click();
  await expect(popover).toHaveCount(0);
  await expect(page.getByRole("button", { name: trigger, exact: true })).toHaveText(format(day, "dd/MM/yyyy"));
}

test("el histórico muestra datos recientes y un rango antiguo vacío", async ({ clientPage: page }) => {
  test.setTimeout(90_000);
  await page.goto("/cliente/historico");
  await expect(page.getByRole("heading", { level: 1, name: "Datos Históricos" })).toBeVisible();
  await selectDemoArea(page);
  await page.getByRole("button", { name: "Últimos 7 días", exact: true }).click();
  const table = page.getByRole("table");
  await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveCount(13);
  await expect(page.getByText("Cargando lecturas…", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Personalizado", exact: true }).click();
  const now = new Date();
  const oldMonth = startOfMonth(subYears(now, 2));
  // Días interiores: sin ambigüedad con los días de meses vecinos que muestra el calendario.
  await pickDay(page, "Fecha inicio", new Date(oldMonth.getFullYear(), oldMonth.getMonth(), 10), now);
  await pickDay(page, "Fecha fin", new Date(oldMonth.getFullYear(), oldMonth.getMonth(), 20), oldMonth);
  await expect(page.getByRole("button", { name: "Personalizado", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(table.getByRole("cell", { name: "No hay registros.", exact: true })).toBeVisible();
  await expect(page.getByText("No hay datos para el rango seleccionado", { exact: true })).toBeVisible();
});

for (const { label, extension } of [
  { label: "Descargar CSV Ligero y rápido", extension: "csv" },
  { label: "Descargar Excel Análisis detallado", extension: "xlsx" },
  { label: "Descargar PDF Imprimible", extension: "pdf" },
]) {
  test(`exporta ${extension} con datos de los últimos siete días`, async ({ clientPage: page }, testInfo) => {
    await page.goto("/cliente/exportar");
    await expect(page.getByRole("heading", { level: 1, name: "Exportar Datos" })).toBeVisible();
    await selectDemoArea(page);
    await page.getByRole("button", { name: "Últimos 7 días", exact: true }).click();
    const pendingDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await pendingDownload;
    expect(download.suggestedFilename().endsWith(`.${extension}`)).toBe(true);
    expect(await download.failure()).toBeNull();
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    expect((await stat(path)).size).toBeGreaterThan(0);
  });
}
