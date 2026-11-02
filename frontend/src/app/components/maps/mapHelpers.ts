import maplibregl, { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import { GeoNode } from "../../services/nodes";

const CLUSTER_SOURCE_ID = "admin-geo-nodes";
const CLUSTER_LAYER_ID = "admin-geo-nodes-clusters";
const CLUSTER_COUNT_LAYER_ID = "admin-geo-nodes-cluster-count";
const UNCLUSTERED_LAYER_ID = "admin-geo-nodes-unclustered";

export function markerColorByStatus(
  status: GeoNode["freshness_status"],
  noDataColor: string
): string {
  if (status === "fresh") return "var(--accent-primary)";
  if (status === "stale") return "var(--status-warning)";
  return noDataColor;
}

export function freshnessText(node: GeoNode): string {
  if (node.minutes_since_last_reading === null) {
    return "Sin lecturas";
  }
  if (node.minutes_since_last_reading < 60) {
    return `Hace ${node.minutes_since_last_reading} min`;
  }
  const hours = Math.floor(node.minutes_since_last_reading / 60);
  const mins = node.minutes_since_last_reading % 60;
  return `Hace ${hours}h ${mins}min`;
}

export function communicationStatusLabel(status: GeoNode["freshness_status"]): string {
  if (status === "fresh") return "Reportando";
  if (status === "stale") return "Sin reporte reciente";
  return "Sin lecturas";
}

export function communicationStatusClass(status: GeoNode["freshness_status"]): string {
  if (status === "fresh") return "text-[var(--status-active-text)]";
  if (status === "stale") return "text-[var(--status-warning-text)]";
  return "text-[var(--text-muted)]";
}

export interface NodePopupOptions {
  /** El popup de admin incluye la fila de Cliente; el de cliente no. */
  includeClient?: boolean;
}

export function buildNodePopupHtml(node: GeoNode, options: NodePopupOptions = {}): string {
  const clientRow = options.includeClient
    ? `<div><strong>Cliente:</strong> ${node.client_company_name}</div>`
    : "";
  return `
    <div class="iot-map-popup-content">
      <div class="iot-map-popup-title">${node.name || `Nodo #${node.id}`}</div>
      ${clientRow}
      <div><strong>Predio:</strong> ${node.property_name}</div>
      <div><strong>Área:</strong> ${node.irrigation_area_name}</div>
      <div><strong>Cultivo:</strong> ${node.crop_type_name}</div>
      <div><strong>Frescura:</strong> ${freshnessText(node)}</div>
    </div>
  `;
}

/** Encaja la cámara al conjunto de nodos (flyTo a zoom 12 si hay 1, fitBounds si hay más). */
export function fitMapToNodes(map: MapLibreMap, nodes: GeoNode[]): void {
  if (nodes.length === 1) {
    const oneNode = nodes[0];
    map.flyTo({
      center: [oneNode.longitude as number, oneNode.latitude as number],
      zoom: 12,
      essential: true,
    });
  } else if (nodes.length > 1) {
    const bounds = new maplibregl.LngLatBounds();
    nodes.forEach((node) => {
      bounds.extend([node.longitude as number, node.latitude as number]);
    });
    map.fitBounds(bounds as LngLatBoundsLike, {
      padding: 60,
      maxZoom: 13,
      duration: 700,
    });
  }
}

export function removeClusterLayers(map: MapLibreMap | null): void {
  if (!map || !map.getStyle()) return;

  if (map.getLayer(CLUSTER_LAYER_ID)) {
    map.removeLayer(CLUSTER_LAYER_ID);
  }
  if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.removeLayer(CLUSTER_COUNT_LAYER_ID);
  }
  if (map.getLayer(UNCLUSTERED_LAYER_ID)) {
    map.removeLayer(UNCLUSTERED_LAYER_ID);
  }
  if (map.getSource(CLUSTER_SOURCE_ID)) {
    map.removeSource(CLUSTER_SOURCE_ID);
  }
}

export interface NodeLayerRenderOptions {
  /** Modo clusters (solo admin). */
  enableClusters: boolean;
  includeClientInPopup: boolean;
  noDataColor: string;
  onSelectNode: (node: GeoNode) => void;
}

/**
 * Renderiza la capa de nodos sobre el mapa: clusters (admin) o marcadores.
 * Devuelve una función de limpieza que elimina marcadores, listeners y capas.
 */
export function renderNodeLayer(
  map: MapLibreMap,
  nodes: GeoNode[],
  options: NodeLayerRenderOptions
): () => void {
  const { enableClusters, includeClientInPopup, noDataColor, onSelectNode } = options;

  if (enableClusters) {
    const featureCollection = {
      type: "FeatureCollection",
      features: nodes.map((node) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [node.longitude as number, node.latitude as number],
        },
        properties: {
          node_id: node.id,
          freshness_status: node.freshness_status,
        },
      })),
    } as GeoJSON.FeatureCollection<GeoJSON.Point, { node_id: number; freshness_status: GeoNode["freshness_status"] }>;

    map.addSource(CLUSTER_SOURCE_ID, {
      type: "geojson",
      data: featureCollection,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 40,
    });

    map.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: CLUSTER_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#9CA3AF", 20, "#8CA478", 60, "#6D7E5E"],
        "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 60, 30],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: CLUSTER_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["Open Sans Bold"],
        "text-size": 11,
      },
      paint: {
        "text-color": "#FFFFFF",
      },
    });

    map.addLayer({
      id: UNCLUSTERED_LAYER_ID,
      type: "circle",
      source: CLUSTER_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["match", ["get", "freshness_status"], "fresh", "#8CA478", "stale", "#D97706", "#6E6359"],
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    });

    const onClusterClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTER_LAYER_ID],
      });
      const feature = features[0];
      if (!feature || !feature.properties) return;

      const clusterId = feature.properties.cluster_id;
      const source = map.getSource(CLUSTER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (!source || clusterId === undefined) return;

      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          if (!feature.geometry || feature.geometry.type !== "Point") return;
          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
            duration: 400,
          });
        })
        .catch(() => {
          // noop: keep current zoom on failure
        });
    };

    const onUnclusteredClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [UNCLUSTERED_LAYER_ID],
      });
      const feature = features[0];
      const nodeId = feature?.properties?.node_id;
      if (!nodeId) return;

      const node = nodes.find((item) => item.id === Number(nodeId));
      if (node) onSelectNode(node);
    };

    const onClusterMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onClusterMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const onUnclusteredMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onUnclusteredMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", CLUSTER_LAYER_ID, onClusterClick);
    map.on("click", UNCLUSTERED_LAYER_ID, onUnclusteredClick);
    map.on("mouseenter", CLUSTER_LAYER_ID, onClusterMouseEnter);
    map.on("mouseleave", CLUSTER_LAYER_ID, onClusterMouseLeave);
    map.on("mouseenter", UNCLUSTERED_LAYER_ID, onUnclusteredMouseEnter);
    map.on("mouseleave", UNCLUSTERED_LAYER_ID, onUnclusteredMouseLeave);

    return () => {
      map.off("click", CLUSTER_LAYER_ID, onClusterClick);
      map.off("click", UNCLUSTERED_LAYER_ID, onUnclusteredClick);
      map.off("mouseenter", CLUSTER_LAYER_ID, onClusterMouseEnter);
      map.off("mouseleave", CLUSTER_LAYER_ID, onClusterMouseLeave);
      map.off("mouseenter", UNCLUSTERED_LAYER_ID, onUnclusteredMouseEnter);
      map.off("mouseleave", UNCLUSTERED_LAYER_ID, onUnclusteredMouseLeave);

      removeClusterLayers(map);
      map.getCanvas().style.cursor = "";
    };
  }

  const markers: maplibregl.Marker[] = [];
  for (const node of nodes) {
    const markerElement = document.createElement("button");
    markerElement.type = "button";
    markerElement.className = "w-4 h-4 rounded-full border-2 border-white shadow-md";
    markerElement.style.backgroundColor = markerColorByStatus(node.freshness_status, noDataColor);
    markerElement.title = node.name || `Nodo #${node.id}`;

    const marker = new maplibregl.Marker({ element: markerElement, anchor: "bottom" })
      .setLngLat([node.longitude as number, node.latitude as number])
      .setPopup(
        new maplibregl.Popup({ offset: 16, className: "iot-map-popup" }).setHTML(
          buildNodePopupHtml(node, { includeClient: includeClientInPopup })
        )
      )
      .addTo(map);

    markerElement.addEventListener("click", () => onSelectNode(node));
    markers.push(marker);
  }

  return () => {
    markers.forEach((marker) => marker.remove());
    map.getCanvas().style.cursor = "";
  };
}