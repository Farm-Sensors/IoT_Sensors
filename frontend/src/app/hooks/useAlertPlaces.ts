import { useCallback, useEffect, useState } from "react";
import { useOptionalSelection } from "../context/SelectionContext";
import { api } from "../services/api";

export interface AlertPlace {
  client?: string;
  property?: string;
  area: string;
  /** «Cliente › Predio › Área» (el cliente solo para el admin). */
  where: string;
}

/**
 * Nombres para las alertas, que traen solo ids: predio y área salen de lo que la app ya carga
 * (`SelectionContext`); el cliente, de una consulta a `/clients` solo para el admin.
 */
export function useAlertPlaces(isAdmin: boolean): {
  placeOf: (areaId: number) => AlertPlace;
  /** Nombre del cliente dueño del predio (solo admin). */
  clientOf: (propertyId: number) => string | undefined;
} {
  const selection = useOptionalSelection();
  const areas = selection?.areas;
  const properties = selection?.properties;
  const [clientNames, setClientNames] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api
      .get("/clients", { params: { per_page: 100 } })
      .then((response) => {
        if (cancelled) return;
        const list: Array<{ id: number; company_name: string }> = response.data?.data ?? [];
        setClientNames(new Map(list.map((c) => [c.id, c.company_name])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const placeOf = useCallback(
    (areaId: number) => {
      const area = areas?.find((a) => a.id === areaId);
      if (!area) return { area: `Área ${areaId}`, where: `Área ${areaId}` };
      const property = properties?.find((p) => p.id === area.property_id);
      const client = isAdmin && property ? clientNames.get(property.client_id) : undefined;
      return {
        client,
        property: property?.name,
        area: area.name,
        where: [client, property?.name, area.name].filter(Boolean).join(" › "),
      };
    },
    [areas, properties, clientNames, isAdmin],
  );

  const clientOf = useCallback(
    (propertyId: number) => {
      const property = properties?.find((p) => p.id === propertyId);
      return isAdmin && property ? clientNames.get(property.client_id) : undefined;
    },
    [properties, clientNames, isAdmin],
  );

  return { placeOf, clientOf };
}
