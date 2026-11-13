import type { ReadingResponse } from "../../../types/api";
import { formatElapsed, parseBackendTimestamp } from "../../../utils/datetime";
import { formatMetricValue } from "../../../utils/metricFormat";

/** Valores de la última lectura ya con la precisión de su magnitud; un `null` es «Sin datos». */
export function toCurrentReadings(reading: ReadingResponse | null) {
  const lastUpdate = parseBackendTimestamp(reading?.timestamp);
  return {
    soilHumidity: formatMetricValue("humidity", reading?.soil?.humidity),
    waterFlow: formatMetricValue("flow", reading?.irrigation?.flow_per_minute),
    accumulatedWater: formatMetricValue("liters", reading?.irrigation?.accumulated_liters),
    eto: formatMetricValue("eto", reading?.environmental?.eto),
    irrigationActive: reading?.irrigation?.active ?? null,
    irrigationElapsedTime: formatElapsed(lastUpdate),
    soilConductivity: formatMetricValue("conductivity", reading?.soil?.conductivity),
    soilTemp: formatMetricValue("temperature", reading?.soil?.temperature),
    waterPotential: formatMetricValue("waterPotential", reading?.soil?.water_potential),
    airTemp: formatMetricValue("temperature", reading?.environmental?.temperature),
    relativeHumidity: formatMetricValue("relativeHumidity", reading?.environmental?.relative_humidity),
    windSpeed: formatMetricValue("wind", reading?.environmental?.wind_speed),
    solarRadiation: formatMetricValue("solarRadiation", reading?.environmental?.solar_radiation),
    lastUpdate,
  };
}

export function toChartReadings(readings: ReadingResponse[]) {
  return readings.flatMap((reading) => {
    const fullTime = parseBackendTimestamp(reading.timestamp);
    return fullTime ? [{
      time: fullTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      fullTime,
      soilHumidity: reading.soil?.humidity ?? null,
      waterFlow: reading.irrigation?.flow_per_minute ?? null,
    }] : [];
  }).sort((a, b) => a.fullTime.getTime() - b.fullTime.getTime());
}

export type CurrentReadings = ReturnType<typeof toCurrentReadings>;
export type ChartReading = ReturnType<typeof toChartReadings>[number];
