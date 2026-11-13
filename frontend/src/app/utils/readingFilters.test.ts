import { describe, expect, it } from "vitest";
import { browserTimeZone, dateParam, quickRangeDates, readingQuery } from "./readingFilters";
import { aggregateReadingsForChart } from "./readingChart";
import type { ReadingResponse } from "../types/api";

describe("calendar date filters", () => {
  it.each([
    ["Hoy", "2026-01-02"], ["Últimos 7 días", "2025-12-27"],
    ["Últimos 30 días", "2025-12-04"], ["Este mes", "2026-01-01"], ["Este año", "2026-01-01"],
  ] as const)("resolves %s with exact inclusive calendar dates", (preset, start) => {
    const range = quickRangeDates(preset, new Date(2026, 0, 2, 23, 59));
    expect(readingQuery(12, range.start, range.end, 3).toString()).toBe(`irrigation_area_id=12&start_date=${start}&end_date=2026-01-02&tz=${encodeURIComponent(browserTimeZone())}&crop_cycle_id=3`);
  });
  it("preserves a selected date late in the local day and includes leap day", () => {
    expect(dateParam(new Date(2024, 1, 29, 23, 59))).toBe("2024-02-29");
    const range = quickRangeDates("Últimos 7 días", new Date(2024, 2, 1));
    expect(dateParam(range.start)).toBe("2024-02-24");
    expect(readingQuery(1, range.start, range.end).has("crop_cycle_id")).toBe(false);
  });
});

it("averages only present values per metric, including zero, across UTC day boundaries", () => {
  const reading = (timestamp: string, humidity: number | null, eto: number | null): ReadingResponse => ({
    id: 1, node_id: 1, timestamp,
    soil: { humidity, conductivity: null, temperature: null, water_potential: null },
    environmental: { eto, temperature: null, relative_humidity: null, wind_speed: null, solar_radiation: null },
    irrigation: null,
  });
  const { points } = aggregateReadingsForChart([
    reading("2026-09-17T00:00:00Z", 0, 2),
    reading("2026-09-17T00:10:00Z", 60, null),
    reading("2026-09-17T00:20:00Z", null, 4),
    reading("2026-09-17T23:59:59Z", null, null),
    reading("2026-09-18T00:00:00Z", 99, 99),
  ], new Date(2026, 8, 17), new Date(2026, 8, 17));
  expect(points).toHaveLength(2);
  expect(points[0]).toMatchObject({ soilHumidity: 30, eto: 3, waterFlow: null, airTemp: null });
  expect(points[1]).toMatchObject({ soilHumidity: null, eto: null });
});
