import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ClientDashboard } from "../ClientDashboard";
import { DesktopDashboard } from "./DesktopDashboard";
import { MobileDashboard } from "./MobileDashboard";
import { ExternalDataCards } from "./ExternalDataCards";
import { FreshnessIndicator } from "../../../components/FreshnessIndicator";
import { defaultSemaphore, getConnectionState } from "./helpers";
import { toChartReadings, toCurrentReadings } from "./readings";
import type { ReadingResponse } from "../../../types/api";
import weatherFresh from "../../../../../../docs/integration/frontend-evidence/weather-current-fresh-200.json";
import weatherStale from "../../../../../../docs/integration/frontend-evidence/weather-current-stale-200.json";
import ndvi from "../../../../../../docs/integration/frontend-evidence/ndvi-latest-200.json";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  selection: {
    properties: [{ id: 1, name: "Predio" }],
    areas: [{ id: 12, name: "Área 12", property_id: 1 }, { id: 13, name: "Área 13", property_id: 1 }],
    selectedProperty: { id: 1, name: "Predio" },
    selectedArea: { id: 12, name: "Área 12", property_id: 1 },
    setSelectedProperty: vi.fn(), setSelectedArea: vi.fn(),
  },
}));
vi.mock("../../../services/api", () => ({ api: { get: mocks.get } }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { nombre: "Fabián" } }) }));
vi.mock("../../../context/SelectionContext", () => ({ useSelection: () => mocks.selection }));
vi.mock("../../../hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../../../hooks/usePageVisibility", () => ({ usePageVisibility: () => true }));
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Chart = ({ children }: { children?: ReactNode }) => <svg>{children}</svg>;
  const Empty = () => null;
  return { ResponsiveContainer: Container, AreaChart: Chart, Area: Empty, XAxis: Empty, YAxis: Empty, CartesianGrid: Empty, Tooltip: Empty };
});

const reading: ReadingResponse = {
  id: 1, node_id: 1, timestamp: "2026-09-16T12:00:00Z",
  soil: { humidity: 0, temperature: null, conductivity: 2.5, water_potential: -0.8 },
  irrigation: { active: null, accumulated_liters: 0, flow_per_minute: 0 },
  environmental: { temperature: 28.1, relative_humidity: 55, wind_speed: 12.5, solar_radiation: 650, eto: 0 },
};
function respond(path: string) {
  if (path === "/readings/latest") return Promise.resolve({ data: reading });
  if (path === "/readings") return Promise.resolve({ data: { data: [reading], total: 1, page: 1, per_page: 12 } });
  if (path === "/readings/priority-status") return Promise.resolve({ data: { items: [] } });
  if (path === "/weather/current") return Promise.resolve({ data: weatherFresh });
  if (path === "/ndvi-snapshots/latest") return Promise.resolve({ data: ndvi });
  if (typeof path === "string" && path.includes("/gateway/status")) {
    return Promise.resolve({
      data: {
        gateway_id: 1,
        status: "recently_seen",
        edge_status: "connected",
        last_heartbeat_at: null,
        config_version: 1,
        slots: [],
      },
    });
  }
  return Promise.reject(new Error(`Unexpected request ${path}`));
}
beforeEach(() => {
  mocks.get.mockReset().mockImplementation(respond);
  mocks.selection.selectedArea = mocks.selection.areas[0];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("preserves missing values and measured zeros in chart data without mutating responses", () => {
  const missing = { ...reading, id: 2, timestamp: "2026-09-16T12:10:00Z", soil: null, irrigation: null };
  const input = [missing, reading];
  expect(toChartReadings(input).map(({ soilHumidity, waterFlow }) => [soilHumidity, waterFlow])).toEqual([[0, 0], [null, null]]);
  expect(input[0]).toBe(missing);
});

describe.each([DesktopDashboard, MobileDashboard])("telemetry layout", (Layout) => {
  it("renders priority metrics, all units and unknown irrigation independently of false", () => {
    const props = { historicalData: [], currentReadings: toCurrentReadings(reading), prioritySemaphore: defaultSemaphore, connectionState: "online" as const };
    const { rerender } = render(<Layout {...props} />);
    for (const title of ["Humedad del Suelo", "Flujo de Agua", "E.T.O."]) expect(screen.getByText(title)).toBeTruthy();
    for (const unit of ["%", "L/min", "mm/día", "dS/m", "MPa"]) expect(screen.getAllByText(unit).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Sin datos")).toBeTruthy();
    expect(screen.getByText("SIN DATOS")).toBeTruthy();
    expect(screen.queryByText("+0.3 vs ayer")).toBeNull();
    rerender(<Layout {...props} currentReadings={toCurrentReadings({ ...reading, irrigation: { ...reading.irrigation!, active: false } })} />);
    expect(screen.getByText("INACTIVO")).toBeTruthy();
    rerender(<Layout {...props} currentReadings={toCurrentReadings({ ...reading, soil: null, irrigation: null, environmental: null })} />);
    expect(screen.getAllByText(/^Sin datos(?: |$)/).length).toBeGreaterThanOrEqual(10);
  });
});

it("changes freshness at 20 minutes and displays the exact timestamp", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:19:30Z"));
  const lastUpdate = new Date(reading.timestamp);
  const { container } = render(<FreshnessIndicator lastUpdate={lastUpdate} />);
  expect(screen.getByText(/Datos actuales/)).toBeTruthy();
  expect(container.querySelector("time")?.dateTime).toBe(lastUpdate.toISOString());
  expect(getConnectionState(lastUpdate)).toBe("online");
  act(() => vi.advanceTimersByTime(30000));
  expect(screen.getByText(/Sin reporte reciente/)).toBeTruthy();
  expect(getConnectionState(lastUpdate)).toBe("warning");
});

it.each([weatherFresh, weatherStale])("renders frozen weather and satellite provenance", async (weather) => {
  mocks.get.mockImplementation((path: string) => path === "/weather/current" ? Promise.resolve({ data: weather }) : respond(path));
  render(<ExternalDataCards areaId={12} />);
  expect(screen.getAllByRole("status")).toHaveLength(2);
  expect(await screen.findByText("27.4 °C")).toBeTruthy();
  expect(screen.getByText("5.3 mm")).toBeTruthy();
  expect(await screen.findByText("0.63")).toBeTruthy();
  expect(screen.getByText(/Microsoft Planetary Computer/)).toBeTruthy();
  expect(screen.getByText(/Muestreo puntual/)).toBeTruthy();
  expect(screen.getByText(weather.cache_state === "fresh" ? /Datos actuales/ : /Datos en caché sin actualizar/)).toBeTruthy();
  expect(mocks.get).toHaveBeenCalledWith("/weather/current", { params: { irrigation_area_id: 12 } });
  expect(mocks.get).toHaveBeenCalledWith("/ndvi-snapshots/latest", { params: { irrigation_area_id: 12 } });
});

it("keeps sensors and NDVI visible when weather is unavailable, and retries the failed card", async () => {
  mocks.get.mockImplementation((path: string) => path === "/weather/current" ? Promise.reject(new Error("disabled")) : respond(path));
  render(<ClientDashboard />);
  expect(await screen.findByText("Humedad del Suelo")).toBeTruthy();
  expect(await screen.findByText("0.63")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("No se pudo cargar clima");
  mocks.get.mockImplementation(respond);
  fireEvent.click(screen.getByText("Reintentar"));
  expect(await screen.findByText("27.4 °C")).toBeTruthy();
});

it("shows an empty response separately from a request failure", async () => {
  mocks.get.mockImplementation((path: string) => path === "/readings/latest" ? Promise.resolve({ data: null }) : respond(path));
  const { unmount } = render(<ClientDashboard />);
  expect(await screen.findByText("Sin lecturas")).toBeTruthy();
  expect(screen.queryByText("Humedad del Suelo")).toBeNull();
  unmount();
  mocks.get.mockImplementation((path: string) => path === "/readings/latest" ? Promise.reject(new Error("failed")) : respond(path));
  render(<ClientDashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar la última lectura");
  expect(screen.queryByText("Sin lecturas")).toBeNull();
});

it("discards late responses for a previously selected area", async () => {
  let resolveOld!: (value: { data: ReadingResponse }) => void;
  mocks.get.mockImplementation((path: string, options: { params: { irrigation_area_id: number } }) => {
    if (path === "/readings/latest" && options.params.irrigation_area_id === 12) return new Promise((resolve) => { resolveOld = resolve; });
    if (path === "/readings/latest") return Promise.resolve({ data: { ...reading, soil: { ...reading.soil, humidity: 77 } } });
    return respond(path);
  });
  const { rerender } = render(<ClientDashboard />);
  expect(screen.queryByText("Humedad del Suelo")).toBeNull();
  mocks.selection.selectedArea = mocks.selection.areas[1];
  rerender(<ClientDashboard />);
  expect(await screen.findByText("77")).toBeTruthy();
  await act(async () => resolveOld({ data: { ...reading, soil: { ...reading.soil!, humidity: 99 } } }));
  expect(screen.queryByText("99")).toBeNull();
  expect(screen.getByText("77")).toBeTruthy();
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/readings/latest", { params: { irrigation_area_id: 13 } }));
});


it("does not label missing telemetry as optimal when priority status defaults to optimal", async () => {
  mocks.get.mockImplementation((path: string) => {
    if (path === "/readings/latest") return Promise.resolve({ data: { ...reading, soil: null, irrigation: null, environmental: null } });
    if (path === "/readings/priority-status") return Promise.resolve({ data: { items: [
      { parameter: "soil.humidity", level: "optimal" },
      { parameter: "irrigation.flow_per_minute", level: "optimal" },
      { parameter: "environmental.eto", level: "optimal" },
    ] } });
    return respond(path);
  });
  render(<ClientDashboard />);
  await screen.findByText("Humedad del Suelo");
  expect(screen.queryByText("Óptimo")).toBeNull();
  expect(screen.getAllByText("Sin datos de umbral")).toHaveLength(3);
});
