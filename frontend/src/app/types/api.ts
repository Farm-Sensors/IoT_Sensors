export interface SoilReading {
  conductivity: number | null;
  temperature: number | null;
  humidity: number | null;
  water_potential: number | null;
}

export interface IrrigationReading {
  active: boolean | null;
  accumulated_liters: number | null;
  flow_per_minute: number | null;
}

export interface EnvironmentalReading {
  temperature: number | null;
  relative_humidity: number | null;
  wind_speed: number | null;
  solar_radiation: number | null;
  eto: number | null;
}

export interface ReadingResponse {
  id: number;
  node_id: number;
  timestamp: string;
  soil?: SoilReading | null;
  irrigation?: IrrigationReading | null;
  environmental?: EnvironmentalReading | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NodeItem {
  id: number;
  irrigation_area_id: number;
  serial_number: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}