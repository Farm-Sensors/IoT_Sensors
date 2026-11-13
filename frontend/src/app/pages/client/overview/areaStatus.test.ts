import { describe, expect, it } from "vitest";
import { areaState, formatAgo, hourlyHumidity, hourlyLiters, locationLabel, summarize } from "./areaStatus";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000);

describe("estado de los datos de un área", () => {
  it("distingue sin nodo, sin datos, al día y sin comunicación con el umbral de 20 min", () => {
    expect(areaState(false, null, NOW)).toBe("sin_nodo");
    expect(areaState(true, null, NOW)).toBe("sin_datos");
    expect(areaState(true, ago(19), NOW)).toBe("al_dia");
    expect(areaState(true, ago(20), NOW)).toBe("sin_comunicacion");
    expect(areaState(true, ago(48 * 60), NOW)).toBe("sin_comunicacion");
  });

  it("formatea el tiempo transcurrido", () => {
    expect(formatAgo(0)).toBe("hace un momento");
    expect(formatAgo(150)).toBe("hace 2 h 30 min");
    expect(formatAgo(2880)).toBe("hace 2 días");
  });
});

describe("resumen de la portada", () => {
  it("solo promedia áreas al día y nunca cuenta un null como 0", () => {
    const s = summarize([
      { state: "al_dia", humidity: 40, flow: 8, eto: 5, irrigating: true },
      { state: "al_dia", humidity: null, flow: 0, eto: null, irrigating: false },
      { state: "sin_comunicacion", humidity: 90, flow: 50, eto: 9, irrigating: true },
      { state: "sin_nodo", humidity: null, flow: null, eto: null, irrigating: null },
    ]);
    expect(s.avgHumidity).toBe(40);
    expect(s.flowNow).toBe(8);
    expect(s.avgEto).toBe(5);
    expect(s.irrigating).toBe(1);
    expect(s.attention).toBe(2);
    expect(summarize([{ state: "sin_datos", humidity: null, flow: null, eto: null, irrigating: null }]).avgHumidity).toBeNull();
  });

  it("agrupa litros por hora: L/min por 10 min entre lecturas", () => {
    const buckets = hourlyLiters([[{ t: ago(30), humidity: null, flow: 6 }, { t: ago(20), humidity: null, flow: 6 }, { t: ago(25 * 60), humidity: null, flow: 6 }]], NOW);
    expect(buckets).toHaveLength(24);
    expect(buckets.reduce((a, b) => a + (b.liters ?? 0), 0)).toBe(120);
  });
});

describe("hourlyHumidity y locationLabel", () => {
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);
  const at = (hoursAgo: number, humidity: number | null) => ({ t: new Date(now - hoursAgo * 3600_000 + 60_000), humidity, flow: null });

  it("promedia por hora, ignora nulos y no inventa horas sin lectura", () => {
    const out = hourlyHumidity([[at(2, 20), at(2, null)], [at(2, 40), at(5, null)]], now);
    expect(out).toHaveLength(1);
    expect(out[0].humidity).toBe(30);
  });

  it("no muestra coordenadas en crudo como ubicación", () => {
    expect(locationLabel("28.6850292,-106.0765387")).toBe("Ubicado por coordenadas");
    expect(locationLabel("Sonora, México")).toBe("Sonora, México");
    expect(locationLabel(null)).toBe("Sin ubicación registrada");
  });
});
