import { api } from "./api";
import type { PaginatedResponse, ReadingResponse } from "../types/api";

export async function fetchReadingPage(query: string, page: number, perPage: number, signal: AbortSignal) {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  return (await api.get<PaginatedResponse<ReadingResponse>>(`/readings?${params}`, { signal })).data;
}

// Bound requests for large seasons. The UI explicitly identifies incomplete charts;
// table pagination and server-side export still cover the full selected range.
export async function fetchChartReadings(query: string, signal: AbortSignal) {
  const readings: ReadingResponse[] = [];
  let total = 0;
  for (let page = 1; page <= 8; page += 1) {
    if (signal.aborted) throw new Error("Cancelled");
    const result = await fetchReadingPage(query, page, 200, signal);
    readings.push(...result.data);
    total = result.total;
    if (readings.length >= total || result.data.length === 0) break;
  }
  return { readings, total };
}

/** `true` si el área ha enviado al menos una lectura (`/readings/latest` devuelve `null` si nunca reportó). */
export async function areaHasReadings(irrigationAreaId: number, signal: AbortSignal): Promise<boolean> {
  const { data } = await api.get(`/readings/latest?irrigation_area_id=${irrigationAreaId}`, { signal });
  return data != null;
}
