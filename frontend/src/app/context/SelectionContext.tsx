import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../services/api";

export interface Property {
  id: number;
  client_id: number;
  name: string;
  location: string | null;
  /** Ubicación de referencia del predio (la reporta el equipo o la captura el admin). */
  latitude?: number | null;
  longitude?: number | null;
}

export interface CropTypeBrief {
  id: number;
  name: string;
}

export interface IrrigationArea {
  id: number;
  property_id: number;
  crop_type_id: number;
  name: string;
  area_size: number | null;
  crop_type: CropTypeBrief | null;
}

interface SelectionContextType {
  properties: Property[];
  areas: IrrigationArea[];
  selectedProperty: Property | null;
  selectedArea: IrrigationArea | null;
  setSelectedProperty: (property: Property | null) => void;
  setSelectedArea: (area: IrrigationArea | null) => void;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

function readStoredId(key: string): number | null {
  if (typeof window === "undefined") return null;
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function writeStoredId(key: string, value: number | null): void {
  if (typeof window === "undefined") return;
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, String(value));
}

function isDemoPropertyName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toUpperCase().startsWith("DEMO -");
}

export function SelectionProvider({
  children,
  autoSelectFirst = true,
  persistenceKey = autoSelectFirst ? "client" : "admin",
}: {
  children: ReactNode;
  autoSelectFirst?: boolean;
  persistenceKey?: string;
}) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [areas, setAreas] = useState<IrrigationArea[]>([]);
  const [selectedProperty, setSelectedPropertyState] = useState<Property | null>(null);
  const [selectedArea, setSelectedAreaState] = useState<IrrigationArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const propertyStorageKey = `selection:${persistenceKey}:propertyId`;
  const areaStorageKey = `selection:${persistenceKey}:areaId`;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all properties (API handles filtering by client context)
      const propsRes = await api.get("/properties?per_page=100");
      const fetchedProperties = propsRes.data.data;
      setProperties(fetchedProperties);

      // Fetch all areas
      const areasRes = await api.get("/irrigation-areas?per_page=100");
      const fetchedAreas = areasRes.data.data;
      setAreas(fetchedAreas);

      let nextProperty = selectedProperty
        ? fetchedProperties.find((item: Property) => item.id === selectedProperty.id) || null
        : null;

      if (!nextProperty) {
        const storedPropertyId = readStoredId(propertyStorageKey);
        if (storedPropertyId != null) {
          nextProperty =
            fetchedProperties.find((item: Property) => item.id === storedPropertyId) || null;
        }
      }

      // Default behavior for client views: select first property/area.
      // Admin views can disable this to keep global scope until explicit selection.
      if (!nextProperty && autoSelectFirst && fetchedProperties.length > 0) {
        nextProperty =
          fetchedProperties.find((item: Property) => !isDemoPropertyName(item.name)) ||
          fetchedProperties[0];
      }

      setSelectedPropertyState(nextProperty);

      let nextArea = selectedArea
        ? fetchedAreas.find((item: IrrigationArea) => item.id === selectedArea.id) || null
        : null;
      if (nextArea && nextProperty && nextArea.property_id !== nextProperty.id) {
        nextArea = null;
      }

      if (!nextArea) {
        const storedAreaId = readStoredId(areaStorageKey);
        if (storedAreaId != null) {
          const storedArea = fetchedAreas.find((item: IrrigationArea) => item.id === storedAreaId);
          if (storedArea && (!nextProperty || storedArea.property_id === nextProperty.id)) {
            nextArea = storedArea;
          }
        }
      }

      if (!nextArea && nextProperty) {
        nextArea = fetchedAreas.find((item: IrrigationArea) => item.property_id === nextProperty.id) || null;
      }

      setSelectedAreaState(nextArea);
      setSelectionHydrated(true);
    } catch (err: any) {
      console.error("Error fetching selection data:", err);
      setError("No se pudieron cargar las propiedades o áreas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if authenticated. The caller (ClientLayout) should be inside ProtectedRoute.
    fetchData();
  }, []);

  const setSelectedProperty = useCallback(
    (property: Property | null) => {
      setSelectedPropertyState(property);
      if (!selectionHydrated) return;
      writeStoredId(propertyStorageKey, property?.id ?? null);
    },
    [selectionHydrated, propertyStorageKey],
  );

  const setSelectedArea = useCallback(
    (area: IrrigationArea | null) => {
      setSelectedAreaState(area);
      if (!selectionHydrated) return;
      writeStoredId(areaStorageKey, area?.id ?? null);
    },
    [selectionHydrated, areaStorageKey],
  );

  useEffect(() => {
    if (!selectionHydrated || loading || error) return;
    writeStoredId(propertyStorageKey, selectedProperty?.id ?? null);
  }, [selectionHydrated, loading, error, propertyStorageKey, selectedProperty?.id]);

  useEffect(() => {
    if (!selectionHydrated || loading || error) return;
    writeStoredId(areaStorageKey, selectedArea?.id ?? null);
  }, [selectionHydrated, loading, error, areaStorageKey, selectedArea?.id]);

  // Whenever the selected property changes, try to pick an area for it if it doesn't match
  useEffect(() => {
    if (selectedProperty && areas.length > 0) {
      if (!selectedArea || selectedArea.property_id !== selectedProperty.id) {
        const firstArea = areas.find(a => a.property_id === selectedProperty.id);
        if (firstArea) {
          setSelectedAreaState(firstArea);
        } else {
          setSelectedAreaState(null); // No areas matched this property
        }
      }
    }
  }, [selectedProperty, selectedArea, areas]);

  return (
    <SelectionContext.Provider
      value={{
        properties,
        areas,
        selectedProperty,
        selectedArea,
        setSelectedProperty,
        setSelectedArea,
        loading,
        error,
        refreshData: fetchData,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}

export function useOptionalSelection() {
  return useContext(SelectionContext);
}
