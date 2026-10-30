import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientMapPage } from "./ClientMapPage";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  nodes: [
    { id: 1, name: "Nodo A", latitude: 28.6, longitude: -106.1, freshness_status: "fresh", property_name: "Predio", irrigation_area_name: "Área 1", crop_type_name: "Nogal", is_active: true, last_reading_timestamp: null },
    { id: 2, name: "Nodo B", latitude: 28.7, longitude: -106.2, freshness_status: "stale", property_name: "Predio", irrigation_area_name: "Área 2", crop_type_name: "Chile", is_active: true, last_reading_timestamp: null },
    { id: 3, name: "Nodo C", latitude: null, longitude: null, freshness_status: "no_data", property_name: "Predio", irrigation_area_name: "Área 3", crop_type_name: "Maíz", is_active: false, last_reading_timestamp: null },
  ],
  geo: { error: null as string | null, loading: false },
}));

vi.mock("maplibre-gl", () => ({
  default: {
    Map: class { on() {} off() {} once() {} remove() {} resize() {} flyTo() {} setStyle() {} addControl() {} isStyleLoaded() { return true; } },
    NavigationControl: class {},
  },
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
vi.mock("../../components/maps/mapHelpers", () => ({
  communicationStatusLabel: (status: string) => ({ fresh: "Al día", stale: "Tardío", no_data: "Sin lectura" })[status] ?? status,
  fitMapToNodes: vi.fn(),
  freshnessText: () => "hace 5 min",
  renderNodeLayer: vi.fn(() => () => {}),
}));
vi.mock("../../components/maps/useGeoNodesData", () => ({
  useGeoNodesData: () => ({ nodes: mocks.nodes, loading: mocks.geo.loading, error: mocks.geo.error, refresh: mocks.refresh }),
  useMapSelectedNodeSync: () => {},
}));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("../../context/SelectionContext", () => ({
  useSelection: () => ({
    properties: [{ id: 1, name: "Predio" }],
    areas: [{ id: 5, name: "Área 1", property_id: 1 }],
    selectedProperty: { id: 1, name: "Predio" },
    selectedArea: { id: 5, name: "Área 1", property_id: 1 },
    setSelectedProperty: vi.fn(),
    setSelectedArea: vi.fn(),
  }),
}));

afterEach(() => { cleanup(); mocks.refresh.mockReset(); mocks.geo.error = null; mocks.geo.loading = false; });

describe("ClientMapPage", () => {
  it("states every node status in text with the count, not only by marker color", () => {
    render(<ClientMapPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Mapa de Nodos" })).toBeTruthy();
    const legend = screen.getByRole("list", { name: "Leyenda de estados" });
    expect(legend).toHaveTextContent("Fresco: 1");
    expect(legend).toHaveTextContent("Tardío: 1");
    expect(legend).toHaveTextContent("Sin lectura: 1");
    expect(legend).toHaveTextContent("Sin GPS: 1");
    expect(screen.getByRole("region", { name: "Mapa de nodos" })).toBeTruthy();
  });

  it("lists the nodes on the map as buttons that open their detail", () => {
    render(<ClientMapPage />);
    const nodeA = screen.getByRole("button", { name: /Nodo A/ });
    expect(nodeA).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(nodeA);
    expect(screen.getByRole("button", { name: /Nodo A/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("hace 5 min")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Nodo C/ })).toBeNull();
    expect(screen.getByText("Nodo C")).toBeTruthy();
  });

  it("refreshes the layer from the primary action and offers retry on error", () => {
    mocks.geo.error = "No se pudo cargar la capa geoespacial. Intenta nuevamente.";
    render(<ClientMapPage />);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar capa" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la capa geoespacial.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});
