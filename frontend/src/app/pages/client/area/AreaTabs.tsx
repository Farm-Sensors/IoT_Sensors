import { Navigate } from "react-router";
import { useSelection } from "../../../context/SelectionContext";
import { ClientDashboard } from "../ClientDashboard";
import { HistoricalData } from "../HistoricalData";

export const AreaNow = () => <ClientDashboard embedded />;
export const AreaHistory = () => <HistoricalData embedded />;

/** Rutas antiguas `/cliente/historico` y `/cliente/exportar`: llevan al Historial del área activa. */
export function ToAreaHistory() {
  const { selectedArea, loading } = useSelection();
  if (loading) return null;
  return <Navigate to={selectedArea ? `/cliente/area/${selectedArea.id}/historial` : "/cliente"} replace />;
}
