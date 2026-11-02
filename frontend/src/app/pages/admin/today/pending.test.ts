import { describe, expect, it } from "vitest";
import type { GeoNode } from "../../../services/nodes";
import { buildPending, summarizeAreas } from "./pending";

const node = (area: number, over: Partial<GeoNode>): GeoNode => ({
  id: area, irrigation_area_id: area, irrigation_area_name: "", property_id: 1, property_name: "", client_id: 1, client_company_name: "",
  crop_type_id: 1, crop_type_name: "", serial_number: null, name: null, latitude: null, longitude: null, is_active: true,
  last_reading_timestamp: null, minutes_since_last_reading: null, freshness_status: "fresh", ...over,
});

describe("buildPending", () => {
  const base = {
    clients: [{ id: 1, company_name: "Cliente" }],
    properties: [{ id: 1, client_id: 1, name: "Predio" }],
    areas: [1, 2, 3, 4].map((id) => ({ id, property_id: 1, name: `Área ${id}` })),
    today: "2026-11-01",
    formatAgo: (m: number) => `hace ${m} min`,
  };

  it("clasifica por estado de datos, ciclo y equipo, y ordena por gravedad", () => {
    const items = buildPending({
      ...base,
      nodes: [node(1, { freshness_status: "stale", minutes_since_last_reading: 90 }), node(2, { freshness_status: "no_data" }), node(3, { minutes_since_last_reading: 5 })],
      cycles: [{ irrigation_area_id: 1, end_date: null }, { irrigation_area_id: 2, end_date: "2026-10-01" }, { irrigation_area_id: 3, end_date: "2026-11-01" }],
      gateways: [
        { id: 7, status: "provisioned", property_name: "Predio", client_name: "Cliente", property_deleted: false },
        { id: 8, status: "active", property_name: "Predio", client_name: "Cliente", property_deleted: false },
        { id: 9, status: "revoked", property_name: "Predio", client_name: "Cliente", property_deleted: false },
      ],
    });
    // Las áreas 2 y 4 (mismo predio) sin ciclo son UN pendiente agrupado.
    expect(items.map((i) => `${i.kind}:${i.key}`)).toEqual([
      "sin_comunicacion:com-1", "sin_datos:datos-2", "sin_nodo:nodo-4", "sin_ciclo:ciclo-p1", "equipo_por_vincular:equipo-7",
    ]);
    expect(items[3]).toMatchObject({ title: "Predio", detail: "2 áreas sin ciclo de cultivo activo.", action: "Crear ciclos", to: "/admin/predios/1/areas" });
    expect(items[0].detail).toBe("Último dato hace 90 min.");
    expect(items[2].to).toBe("/admin/areas/4?tab=nodo");
  });

  it("no inventa pendientes cuando todo está al día", () => {
    const items = buildPending({
      ...base,
      areas: [base.areas[0]],
      nodes: [node(1, { minutes_since_last_reading: 3 })],
      cycles: [{ irrigation_area_id: 1, end_date: null }],
      gateways: [],
    });
    expect(items).toEqual([]);
  });

  it("resume cuántas áreas están en cada estado y cuántas no tienen ciclo", () => {
    const summary = summarizeAreas({
      areas: base.areas, today: base.today,
      nodes: [node(1, { freshness_status: "stale", minutes_since_last_reading: 90 }), node(2, { freshness_status: "no_data" }), node(3, { minutes_since_last_reading: 5 })],
      cycles: [{ irrigation_area_id: 1, end_date: null }, { irrigation_area_id: 3, end_date: null }],
    });
    expect(summary).toEqual({ total: 4, al_dia: 1, sin_comunicacion: 1, sin_datos: 1, sin_nodo: 1, sin_ciclo: 2 });
  });

  it("pone primero a quien lleva más tiempo sin datos e indica cliente, lugar y desde cuándo", () => {
    const input = {
      ...base,
      nodes: [node(1, { freshness_status: "stale", minutes_since_last_reading: 90 }), node(2, { freshness_status: "stale", minutes_since_last_reading: 3000 })],
      cycles: [{ irrigation_area_id: 1, end_date: null }, { irrigation_area_id: 2, end_date: null }],
      gateways: [], areas: base.areas.slice(0, 2),
    };
    const [first, second] = buildPending(input);
    expect([first.key, second.key]).toEqual(["com-2", "com-1"]);
    expect(first).toMatchObject({ client: "Cliente", place: "Predio · Área 2", since: "hace 3000 min" });
  });
});
