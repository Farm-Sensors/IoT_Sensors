import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ClientMapPage } from "./ClientMapPage";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  nodes: [
    { id: 1, irrigation_area_id: 5, irrigation_area_name: "Nogal Norte", property_id: 1, property_name: "Rancho", crop_type_name: "Nogal", latitude: 28.6, longitude: -106.1, freshness_status: "fresh" },
    { id: 2, irrigation_area_id: 6, irrigation_area_name: "Chile", property_id: 1, property_name: "Rancho", crop_type_name: "Chile", latitude: 28.7, longitude: -106.2, freshness_status: "stale" },
    { id: 3, irrigation_area_id: 7, irrigation_area_name: "Maíz", property_id: 1, property_name: "Rancho", crop_type_name: "Maíz", latitude: null, longitude: null, freshness_status: "no_data" },
  ],
  geo: { error: null as string | null, loading: false },
  markers: [] as { el: HTMLElement }[],
}));

vi.mock("maplibre-gl", () => {
  class Map { addControl() {} flyTo() {} fitBounds() {} resize() {} remove() {} getZoom() { return 10; } }
  class Marker {
    el: HTMLElement;
    constructor(opts: { element: HTMLElement }) { this.el = opts.element; mocks.markers.push(this); }
    setLngLat() { return this; } addTo() { return this; } remove() { const i = mocks.markers.indexOf(this); if (i >= 0) mocks.markers.splice(i, 1); }
  }
  class LngLatBounds { extend() { return this; } }
  class NavigationControl {}
  return { default: { Map, Marker, LngLatBounds, NavigationControl } };
});
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("../../components/maps/useGeoNodesData", () => ({
  useGeoNodesData: () => ({ nodes: mocks.nodes, loading: mocks.geo.loading, error: mocks.geo.error, refresh: mocks.refresh }),
}));
// Referencias estables, como las del hook real: un arreglo nuevo en cada render haría un ciclo infinito.
const overview = vi.hoisted(() => ({
  rows: [
    { area: { id: 5, name: "Nogal Norte", property_id: 1 }, state: "al_dia", humidity: 61.2, lastUpdate: new Date(), series: [] },
    { area: { id: 6, name: "Chile", property_id: 1 }, state: "sin_comunicacion", humidity: 40, lastUpdate: new Date(Date.now() - 3 * 3600_000), series: [] },
  ],
  loading: false, error: null, reload: () => {},
}));
vi.mock("./overview/useAreaOverview", () => ({ useAreaOverview: () => overview }));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
const selection = vi.hoisted(() => ({
  properties: [{ id: 1, name: "Rancho" }, { id: 2, name: "Otro" }],
  areas: [{ id: 5, name: "Nogal Norte", property_id: 1 }, { id: 6, name: "Chile", property_id: 1 }, { id: 7, name: "Maíz", property_id: 1 }],
}));
vi.mock("../../context/SelectionContext", () => ({ useSelection: () => selection }));

beforeAll(() => { (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} }; });
afterEach(() => { cleanup(); mocks.markers.length = 0; mocks.geo.error = null; mocks.refresh.mockReset(); });

const renderPage = () => render(<MemoryRouter><ClientMapPage /></MemoryRouter>);

const pinTexts = () => mocks.markers.map((m) => m.el.textContent);

describe("ClientMapPage", () => {
  it("starts with one pin per predio and no area pins", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Mapa" })).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("1 predio · 1 de 2 áreas al día · 1 sin comunicación");
    expect(pinTexts()).toHaveLength(1);
    expect(pinTexts()[0]).toContain("Rancho");
    expect(pinTexts()[0]).toContain("3 áreas");
    expect(screen.getByText("Toca un predio para ver sus áreas.")).toBeTruthy();
    const legend = screen.getByRole("list", { name: "Leyenda" });
    for (const label of ["Al día", "Sin comunicación", "Sin datos"]) expect(legend).toHaveTextContent(label);
    expect(screen.queryByText(/Actualizar capa|MapLibre/)).toBeNull();
  });

  it("shows the area pins only after a predio is chosen, and says what is missing", () => {
    renderPage();
    fireEvent.click(mocks.markers[0].el);
    expect(screen.getByRole("button", { name: "Rancho" })).toHaveAttribute("aria-pressed", "true");
    expect(pinTexts()).toHaveLength(2);
    expect(pinTexts().join(" ")).toContain("Nogal Norte");
    expect(pinTexts().join(" ")).toContain("61 % humedad");
    expect(screen.getByText(/1 área no aparece porque no tiene ubicación: Maíz/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Detalle de Rancho/ })).toHaveAttribute("href", "/cliente/predio/1");
    fireEvent.click(screen.getByRole("button", { name: "Todos los predios" }));
    expect(pinTexts()).toHaveLength(1);
  });

  it("opens a card with a way into the area when an area pin is tapped", () => {
    renderPage();
    fireEvent.click(mocks.markers[0].el);
    expect(screen.queryByRole("region", { name: "Detalle de Nogal Norte" })).toBeNull();
    fireEvent.click(mocks.markers[0].el);
    const card = screen.getByRole("region", { name: "Detalle de Nogal Norte" });
    expect(card).toHaveTextContent("61.2");
    expect(within(card).getByRole("link", { name: /Abrir área/ })).toHaveAttribute("href", "/cliente/area/5");
    fireEvent.click(within(card).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("region", { name: "Detalle de Nogal Norte" })).toBeNull();
  });

  it("retries on error", () => {
    mocks.geo.error = "No se pudo cargar el mapa. Intenta nuevamente.";
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
