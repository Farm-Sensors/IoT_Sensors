import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { areasWithData, EquipoStateBadge, equipoState } from "../../components/EquipoStateBadge";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { RevokeLinkButton } from "../../components/RevokeLinkButton";
import { useToast } from "../../components/Toast";
import {
  Gateway,
  gatewayRanchLabel,
  GatewayStatus,
  getGateway,
  getGatewayStatus,
  publishConfiguration,
} from "../../services/gateways";
import { getGeoNodes } from "../../services/nodes";
import { formatElapsed, parseBackendTimestamp } from "../../utils/datetime";
import { getErrorMessage } from "../../utils/errors";

const BINDING_LABELS: Record<string, string> = {
  unbound: "Esperando nodo",
  pending: "Nodo propuesto",
  pending_initial: "Nodo propuesto",
  pending_reassignment: "Cambio de nodo pendiente",
  confirmed: "Nodo asignado",
};

const PRIMARY_LINK =
  "inline-flex items-center justify-center rounded-full bg-[var(--accent-primary)] px-6 py-2.5 font-medium text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

type SlotNode = {
  name: string | null;
  serial_number: string | null;
  area_name: string;
};

export function GatewayDetail() {
  const { gatewayId } = useParams<{ gatewayId: string }>();
  const { showToast } = useToast();
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [slotNodes, setSlotNodes] = useState<Record<number, SlotNode>>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!gatewayId) return;
    try {
      setLoading(true);
      const [gatewayRes, statusRes] = await Promise.all([
        getGateway(Number(gatewayId)),
        getGatewayStatus(Number(gatewayId)),
      ]);
      setGateway(gatewayRes.data);
      setStatus(statusRes.data);
      setError(null);

      const geoRes = await getGeoNodes({
        property_id: gatewayRes.data.property_id,
        include_without_coordinates: true,
        per_page: 200,
      });
      const byArea: Record<number, SlotNode> = {};
      for (const node of geoRes.data) {
        byArea[node.irrigation_area_id] = {
          name: node.name,
          serial_number: node.serial_number,
          area_name: node.irrigation_area_name,
        };
      }
      setSlotNodes(byArea);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar el equipo"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [gatewayId]);

  const handlePublish = async () => {
    if (!gateway) return;
    try {
      setPublishing(true);
      await publishConfiguration(gateway.id);
      showToast("Configuración lista", "success");
      await load();
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo dejar lista la configuración");
      showToast(message, "error");
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  const backLink = (
    <Link
      className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-main)]"
      to="/admin/gateways"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Volver a la lista
    </Link>
  );

  if (loading && !gateway) {
    return (
      <PageTransition>
        <p role="status">Cargando…</p>
      </PageTransition>
    );
  }

  if (!gateway) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <p role="alert" className="text-[var(--status-danger-text)]">
            {error || "Equipo no encontrado"}
          </p>
          {backLink}
        </div>
      </PageTransition>
    );
  }

  const state = equipoState(gateway, status);
  const slotCount = gateway.slots.length;
  const lastHeartbeat = parseBackendTimestamp(status?.last_heartbeat_at);
  const needsConfiguration = gateway.configuration_version === 0 && state !== "revoked";

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="space-y-3">
          {backLink}
          <PageHeader title={gatewayRanchLabel(gateway)} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--text-muted)]">
            <EquipoStateBadge state={state} />
            {state !== "revoked" && (
              <>
                <span>
                  {areasWithData(status)} de {slotCount} áreas con datos
                </span>
                <span>Última señal del equipo: {lastHeartbeat ? formatElapsed(lastHeartbeat) : "todavía no"}</span>
              </>
            )}
          </div>
          {needsConfiguration ? (
            <PillButton loading={publishing} onClick={() => void handlePublish()}>
              Dejar lista la configuración
            </PillButton>
          ) : state === "unlinked" || state === "assigning" ? (
            <Link className={PRIMARY_LINK} to={`/admin/gateways?gateway=${gateway.id}`}>
              {state === "unlinked" ? "Vincular equipo" : "Ver avance"}
            </Link>
          ) : null}
        </div>

        {error && (
          <p role="alert" className="text-[var(--status-danger-text)]">
            {error}
          </p>
        )}
        {state === "revoked" && (
          <p className="text-sm text-[var(--text-muted)]">
            Este equipo ya no puede enviar datos; las lecturas recibidas se conservan.
          </p>
        )}

        <BentoCard>
          <h2 className="text-lg font-semibold">Áreas de riego</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th scope="col" className="py-2 pr-4">Área</th>
                  <th scope="col" className="py-2 pr-4">Nodo</th>
                  <th scope="col" className="py-2 pr-4">Estado</th>
                  <th scope="col" className="py-2">Última lectura</th>
                </tr>
              </thead>
              <tbody>
                {(status?.slots || []).map((slot) => {
                  const node = slotNodes[slot.irrigation_area_id];
                  const last = parseBackendTimestamp(slot.latest_reading_at);
                  return (
                    <tr key={slot.logical_node_id} className="border-t border-[var(--border-subtle)]">
                      <td className="py-2 pr-4">{node?.area_name || `Área ${slot.irrigation_area_id}`}</td>
                      <td className="py-2 pr-4">{node?.name || "—"}</td>
                      <td className="py-2 pr-4">
                        {BINDING_LABELS[slot.binding_status] || slot.binding_status}
                      </td>
                      <td className="py-2">{last ? formatElapsed(last) : "Sin lecturas"}</td>
                    </tr>
                  );
                })}
                {(status?.slots || []).length === 0 && (
                  <tr>
                    <td className="py-3 text-[var(--text-muted)]" colSpan={4}>
                      Este equipo no tiene áreas de riego.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>

        {gateway.status !== "revoked" && (
          <section aria-labelledby="more-actions-title" className="space-y-3">
            <h2 id="more-actions-title" className="text-base font-semibold">
              Más acciones
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              {gateway.status === "active" && (
                <Link
                  className="inline-flex min-h-[44px] items-center rounded text-sm font-medium underline underline-offset-4"
                  to="/admin/gateways/pair"
                >
                  Cambiar el equipo de este rancho
                </Link>
              )}
              <RevokeLinkButton gateway={gateway} onRevoked={load} />
            </div>
          </section>
        )}

        <details className="text-sm">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Datos para soporte
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-[var(--text-muted)]">Enlace</dt>
              <dd>#{gateway.id}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Configuración</dt>
              <dd>
                {gateway.configuration_version > 0
                  ? `Versión ${gateway.configuration_version}`
                  : "Pendiente"}
                {` · revisión de asignaciones ${gateway.bindings_revision}`}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Conexión</dt>
              <dd>
                <GatewayStatusBadge edgeStatus={status?.edge_status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Último latido</dt>
              <dd>{lastHeartbeat ? lastHeartbeat.toLocaleString("es-MX") : "Sin latido todavía"}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Fechas</dt>
              <dd>
                {gateway.revoked_at
                  ? `Revocado el ${new Date(gateway.revoked_at).toLocaleString("es-MX")}`
                  : gateway.activated_at
                    ? `Activado el ${new Date(gateway.activated_at).toLocaleString("es-MX")}`
                    : "Aún sin activar"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--text-muted)]">Identidad física de los nodos</dt>
              <dd>
                <ul>
                  {(status?.slots || []).map((slot) => (
                    <li key={slot.logical_node_id}>
                      {slotNodes[slot.irrigation_area_id]?.area_name || `Área ${slot.irrigation_area_id}`}:{" "}
                      {slot.bound_uid || slot.bound_serial || slotNodes[slot.irrigation_area_id]?.serial_number || "—"}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </details>
      </div>
    </PageTransition>
  );
}
