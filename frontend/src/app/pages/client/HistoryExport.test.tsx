import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { HistoricalData } from "./HistoricalData";
import { ExportData } from "./ExportData";
import { dateParam, quickRangeDates } from "../../utils/readingFilters";

const mocks = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), toast: vi.fn(), selection: { selectedArea: { id: 12, name: "Nogal" } as { id: number; name: string } | null } }));
vi.mock("../../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../../utils/export", () => ({ downloadBlobExport: mocks.download }));
vi.mock("../../context/SelectionContext", () => ({ useSelection: () => mocks.selection }));
vi.mock("../../components/selection/SelectionScopeBar", () => ({ SelectionScopeBar: () => null }));
vi.mock("../../components/Toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../../components/PageTransition", () => ({ PageTransition: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../../hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../../components/ui/calendar", () => ({ Calendar: ({ onSelect }: { onSelect: (day: Date) => void }) => <input aria-label="Día del calendario" type="date" onChange={(event) => onSelect(new Date(`${event.target.value}T00:00:00`))} /> }));
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return { ResponsiveContainer: Container, LineChart: Container, CartesianGrid: Empty, Legend: Empty, Line: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty };
});
const reading = {
  id: 1, node_id: 1, timestamp: new Date().toISOString(),
  soil: { humidity: 0, temperature: null, conductivity: 1.2, water_potential: -0.8 },
  irrigation: { active: false, accumulated_liters: 100, flow_per_minute: 0 },
  environmental: { temperature: 27.3, relative_humidity: 40, wind_speed: 3, solar_radiation: 600, eto: null },
};
function respond(path: string) {
  const url = new URL(path, "http://local");
  const params = url.searchParams;
  if (url.pathname === "/crop-cycles") return Promise.resolve({ data: { data: [{ id: 7, irrigation_area_id: Number(params.get("irrigation_area_id")), start_date: "2026-01-01", end_date: null }], total: 1 } });
  if (url.pathname === "/readings/availability") return Promise.resolve({ data: { min_date: "2026-01-01", max_date: dateParam(new Date()), available_dates: [] } });
  if (url.pathname === "/readings") return Promise.resolve({ data: { data: [{ ...reading, id: Number(params.get("page")), soil: { ...reading.soil, conductivity: params.get("page") === "2" ? 9.9 : 1.2 } }], total: params.get("per_page") === "200" ? 1 : 21, page: Number(params.get("page")), per_page: Number(params.get("per_page")) } });
  return Promise.reject(new Error(`Unexpected ${path}`));
}
function tableCalls() { return mocks.get.mock.calls.filter(([path]) => path.startsWith("/readings?") && new URL(path, "http://local").searchParams.get("per_page") === "20"); }
function chartCalls() { return mocks.get.mock.calls.filter(([path]) => path.startsWith("/readings?") && path.includes("per_page=200")); }
beforeEach(() => {
  mocks.get.mockReset().mockImplementation(respond);
  mocks.download.mockReset().mockResolvedValue(undefined);
  mocks.toast.mockReset();
  mocks.selection.selectedArea = { id: 12, name: "Nogal" };
});
afterEach(cleanup);

it("renders all sensor units, zero, null and false; paginates without refetching the chart", async () => {
  render(<HistoricalData />);
  expect(screen.getByText("Cargando lecturas…")).toBeTruthy();
  expect(await screen.findByText("Apagado")).toBeTruthy();
  const table = screen.getByRole("table");
  expect(within(table).getAllByText("0.0")).toHaveLength(2);
  expect(within(table).getAllByText("Sin datos")).toHaveLength(2);
  expect(within(table).getAllByRole("columnheader")).toHaveLength(13);
  expect(within(table).getByText("E.T.O. (mm/día)")).toBeTruthy();
  await waitFor(() => expect(chartCalls().length).toBe(1));
  const count = chartCalls().length;
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(await screen.findByText("9.9")).toBeTruthy();
  expect(tableCalls().at(-1)?.[0]).toContain("page=2&per_page=20");
  expect(chartCalls()).toHaveLength(count);
  fireEvent.click(screen.getByRole("button", { name: "Este año" }));
  await waitFor(() => expect(tableCalls().at(-1)?.[0]).toContain(`start_date=${new Date().getFullYear()}-01-01`));
  expect(tableCalls().at(-1)?.[0]).toContain("page=1&per_page=20");
});

it("uses the selected cycle in list and export and clears it on area change", async () => {
  const { rerender } = render(<HistoricalData />);
  const cycle = await screen.findByRole("option", { name: /2026-01-01/ });
  expect(cycle).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Ciclo de cultivo"), { target: { value: "7" } });
  await waitFor(() => expect(tableCalls().at(-1)?.[0]).toContain("crop_cycle_id=7"));
  fireEvent.click(screen.getByRole("button", { name: "CSV" }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalled());
  const exported = new URL(mocks.download.mock.calls[0][0], "http://local").searchParams;
  const listed = new URL(tableCalls().at(-1)![0], "http://local").searchParams;
  for (const key of ["irrigation_area_id", "crop_cycle_id", "start_date", "end_date"]) expect(exported.get(key)).toBe(listed.get(key));
  expect(exported.has("page")).toBe(false);
  mocks.selection.selectedArea = { id: 13, name: "Alfalfa" };
  rerender(<HistoricalData />);
  await waitFor(() => expect(tableCalls().at(-1)?.[0]).toContain("irrigation_area_id=13"));
  expect(tableCalls().at(-1)?.[0]).not.toContain("crop_cycle_id");
  expect(screen.getByLabelText("Ciclo de cultivo")).toHaveValue("");
});

it("discards late page responses after a range change", async () => {
  let resolvePage!: (value: unknown) => void;
  mocks.get.mockImplementation((path: string) => path.includes("page=2&per_page=20") ? new Promise((resolve) => { resolvePage = resolve; }) : respond(path));
  render(<HistoricalData />);
  await screen.findByText("Apagado");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.queryByText("Apagado")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Este mes" }));
  await screen.findByText("Apagado");
  await act(async () => resolvePage({ data: { data: [{ ...reading, soil: { ...reading.soil, conductivity: 999 } }], total: 21, per_page: 20 } }));
  expect(screen.queryByText("999.0")).toBeNull();
});

it("distinguishes list failure from empty results and can retry", async () => {
  mocks.get.mockImplementation((path: string) => new URL(path, "http://local").searchParams.get("per_page") === "20" ? Promise.reject(new Error("failed")) : respond(path));
  render(<HistoricalData />);
  expect(await screen.findByText("No se pudo cargar el histórico.")).toBeTruthy();
  expect(screen.queryByText("No hay registros.")).toBeNull();
  mocks.get.mockImplementation((path: string) => path.startsWith("/readings?") ? Promise.resolve({ data: { data: [], total: 0, per_page: 20, page: 1 } }) : respond(path));
  fireEvent.click(screen.getByRole("button", { name: "Reintentar histórico" }));
  expect(await screen.findByText("No hay registros.")).toBeTruthy();
  expect(screen.queryByText(/Página 1 de 0/)).toBeNull();
});

it("labels a partial chart and keeps the table visible on chart failure", async () => {
  mocks.get.mockImplementation((path: string) => path.startsWith("/readings?") && path.includes("per_page=200")
    ? Promise.resolve({ data: { data: Array.from({ length: 200 }, (_, id) => ({ ...reading, id })), total: 2000, page: 1, per_page: 200 } }) : respond(path));
  const { unmount } = render(<HistoricalData />);
  expect(await screen.findByText(/Gráfica parcial:/)).toBeTruthy();
  unmount();
  mocks.get.mockImplementation((path: string) => path.includes("per_page=200") && path.startsWith("/readings?") ? Promise.reject(new Error("failed")) : respond(path));
  render(<HistoricalData />);
  expect(await screen.findByText("No se pudo cargar la gráfica.")).toBeTruthy();
  expect(await screen.findByText("Apagado")).toBeTruthy();
});

describe.each([HistoricalData, ExportData])("export screen", (Screen) => {
  it.each([["CSV", "csv"], ["Excel", "xlsx"], ["PDF", "pdf"]])("downloads %s with dates and area via existing endpoint", async (label, extension) => {
    render(<Screen />);
    await screen.findByRole("option", { name: /2026-01-01/ });
    fireEvent.change(screen.getByLabelText("Ciclo de cultivo"), { target: { value: "7" } });
    const isExportPage = Screen === ExportData;
    fireEvent.click(screen.getByRole("button", { name: isExportPage ? new RegExp(`Descargar ${label}`) : label }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    const [endpoint, name] = mocks.download.mock.calls[0];
    const params = new URL(endpoint, "http://local").searchParams;
    expect(endpoint).toMatch(/^\/readings\/export\?/);
    expect(params.get("format")).toBe(extension);
    expect(params.get("irrigation_area_id")).toBe("12");
    expect(params.get("crop_cycle_id")).toBe("7");
    expect(params.get("start_date")).toBe(dateParam(quickRangeDates("Últimos 7 días").start));
    expect(params.get("end_date")).toBe(dateParam(new Date()));
    expect(name).toMatch(new RegExp(`\\.${extension}$`));
  });
  it("surfaces download errors", async () => {
    mocks.download.mockRejectedValue(new Error("failed"));
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: Screen === ExportData ? /Descargar CSV/ : "CSV" }));
    expect(await screen.findByText("No se pudo exportar. Intenta nuevamente.")).toBeTruthy();
  });
  it("supports an exact custom range without availability clamping", async () => {
    render(<Screen />);
    await screen.findByRole("option", { name: /2026-01-01/ });
    fireEvent.click(screen.getByRole("button", { name: "Fecha inicio" }));
    fireEvent.change(screen.getByLabelText("Día del calendario"), { target: { value: "2025-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Fecha fin" }));
    fireEvent.change(screen.getByLabelText("Día del calendario"), { target: { value: "2026-01-02" } });
    fireEvent.click(screen.getByRole("button", { name: Screen === ExportData ? /Descargar CSV/ : "CSV" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    expect(mocks.download.mock.calls[0][0]).toContain("start_date=2025-12-15&end_date=2026-01-02");
    expect(screen.getByRole("button", { name: "Personalizado" })).toHaveAttribute("aria-pressed", "true");
  });
});

it("does not request readings or allow downloads without an area", () => {
  mocks.selection.selectedArea = null;
  render(<HistoricalData />);
  expect(mocks.get).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "CSV" })).toBeDisabled();
});

describe("filters and export summary", () => {
  it("shows the active filters next to the results and keeps presets pressed state", async () => {
    render(<HistoricalData />);
    const summary = await screen.findByTestId("active-filters");
    expect(summary).toHaveTextContent("Rango: Últimos 7 días");
    expect(summary).toHaveTextContent(/Fechas: \d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}/);
    expect(summary).toHaveTextContent("Ciclo de cultivo: Todos los ciclos");
    expect(screen.getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Este mes" }));
    expect(screen.getByTestId("active-filters")).toHaveTextContent("Rango: Este mes");
    expect(screen.getByRole("button", { name: "Últimos 7 días" })).toHaveAttribute("aria-pressed", "false");
  });

  it("names the cycle in the summary once it is chosen", async () => {
    render(<HistoricalData />);
    await screen.findByRole("option", { name: /2026-01-01/ });
    fireEvent.change(screen.getByLabelText("Ciclo de cultivo"), { target: { value: "7" } });
    expect(await screen.findByText(/Ciclo de cultivo: 2026-01-01 — Sin fecha de fin/)).toBeTruthy();
  });

  it("summarizes the export before downloading and offers three separate actions", async () => {
    render(<ExportData />);
    expect(screen.getByTestId("export-summary")).toHaveTextContent(/Se exportará Nogal, del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4}, todos los ciclos\./);
    for (const label of ["CSV", "Excel", "PDF"]) expect(screen.getByRole("button", { name: new RegExp(`Descargar ${label}`) })).toBeEnabled();
    await screen.findByRole("option", { name: /2026-01-01/ });
    fireEvent.change(screen.getByLabelText("Ciclo de cultivo"), { target: { value: "7" } });
    expect(screen.getByTestId("export-summary")).toHaveTextContent("solo el ciclo de cultivo elegido");
    expect(screen.queryByRole("button", { name: "Exportar Datos" })).toBeNull();
  });

  it("downloads only the format that was pressed and disables the others meanwhile", async () => {
    let finish!: () => void;
    mocks.download.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ExportData />);
    fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Generando Excel/ })).toBeDisabled());
    expect(screen.getByRole("button", { name: /Descargar CSV/ })).toBeDisabled();
    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(new URL(mocks.download.mock.calls[0][0], "http://local").searchParams.get("format")).toBe("xlsx");
    await act(async () => finish());
    await waitFor(() => expect(screen.getByRole("button", { name: /Descargar CSV/ })).toBeEnabled());
  });

  it("disables every export action without an area", () => {
    mocks.selection.selectedArea = null;
    render(<ExportData />);
    for (const label of ["CSV", "Excel", "PDF"]) expect(screen.getByRole("button", { name: new RegExp(`Descargar ${label}`) })).toBeDisabled();
    expect(screen.getByTestId("export-summary")).toHaveTextContent("Selecciona un área de riego para exportar.");
  });

  it("toggles chart series with aria-pressed", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    mocks.get.mockImplementation((path: string) => path.startsWith("/readings?") && path.includes("per_page=200")
      ? Promise.resolve({ data: { data: [{ ...reading, timestamp: yesterday }], total: 1, page: 1, per_page: 200 } }) : respond(path));
    render(<HistoricalData />);
    const toggle = await screen.findByRole("button", { name: "Humedad suelo" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
