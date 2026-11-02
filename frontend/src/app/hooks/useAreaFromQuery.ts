import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useOptionalSelection } from "../context/SelectionContext";

/**
 * Las pantallas de Alertas filtran por el área elegida (`SelectionContext`). Con `?area=ID` en la dirección
 * (por ejemplo desde Área › Ahora) esa área se fija sola, así el enlace lleva justo a las alertas o reglas de esa área.
 */
export function useAreaFromQuery(): void {
  const [params] = useSearchParams();
  const selection = useOptionalSelection();
  const wanted = Number(params.get("area"));
  const areas = selection?.areas;
  const properties = selection?.properties;
  const selectedId = selection?.selectedArea?.id;
  const setSelectedArea = selection?.setSelectedArea;
  const setSelectedProperty = selection?.setSelectedProperty;

  useEffect(() => {
    if (!Number.isInteger(wanted) || wanted <= 0 || !areas || !setSelectedArea || !setSelectedProperty) return;
    if (selectedId === wanted) return;
    const area = areas.find((a) => a.id === wanted);
    if (!area) return;
    const property = properties?.find((p) => p.id === area.property_id);
    if (property) setSelectedProperty(property);
    setSelectedArea(area);
  }, [wanted, areas, properties, selectedId, setSelectedArea, setSelectedProperty]);
}
