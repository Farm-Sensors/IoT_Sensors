import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import { Gateway, GatewayStatus, getGateway, getGatewayStatus, publishConfiguration } from "../../services/gateways";
import { getGeoNodes } from "../../services/nodes";
import { formatElapsed, parseBackendTimestamp } from "../../utils/datetime";
import { getErrorMessage } from "../../utils/errors";

const BINDING_LABELS: Record<string, string> = {
  unbound: "Sin enlazar",
  pending: "Candidato pendiente",
  pending_initial: "Candidato pendiente",
  pending_reassignment: "Reasignación pendiente",
  confirmed: "Confirmado",
};

const MANAGEMENT_LABELS: Record<string, string> = {
  pending_activation: "Pendiente de activación",
  active: "Activo",
  revoked: "Revocado",
};

type PropertyInfo = {
  id: number;
  client_id: number;
  name: string;
};

type ClientInfo = {
  id: number;
  company_name: string;
};

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
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
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

      const propertyRes = await api.get<PropertyInfo>(`/properties/${gatewayRes.data.property_id}`);
      setProperty(propertyRes.data);
      const clientRes = await api.get<ClientInfo>(`/clients/${propertyRes.data.client_id}`);
      setClient(clientRes.data);

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
      setError(getErrorMessage(err, "No se pudo cargar el gateway"));
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
      showToast("Configuración publicada", "success");
      await load();
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo publicar la configuración");
      showToast(message, "error");
      setError(message);
    } finally {
      setPublishing(false);
    }
  };

  const slotCount = gateway?.slots.length ?? 0;
  const confirmedCount = status?.slots.filter((slot) => slot.binding_status === "confirmed").length ?? 0;
  const steps = [
    {
      key: "provisioned",
      label: "Predio provisionado",
      done: true,
      hint: "El predio ya tiene su gateway reservado",
    },
    {
      key: "published",
      label: "Configuración publicada",
      done: (gateway?.configuration_version ?? 0) > 0,
      hint:
        (gateway?.configuration_version ?? 0) > 0
          ? `Versión ${gateway?.configuration_version}`
          : "Falta publicar la configuración",
    },
    {
      key: "linked",
      label: "Credencial vinculada",
      done: gateway?.status === "active",
      hint:
        gateway?.status === "active"
          ? "El equipo ya tiene su credencial"
          : "El equipo debe emparejarse desde su pantalla",
    },
    {
      key: "bound",
      label: "Nodos enlazados",
      done: slotCount > 0 && confirmedCount === slotCount,
      hint: `${confirmedCount} de ${slotCount} ranura(s) confirmadas`,
    },
  ];

  if (loading) {
    return (
      <PageTransition>
        <p>Cargando...</p>
      </PageTransition>
    );
  }

  if (!gateway) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <p className="text-[var(--status-danger)]">{error || "Gateway no encontrado"}</p>
          <Link className="underline" to="/admin/gateways">
            Volver a Gateways
          </Link>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link className="text-sm text-[var(--text-muted)] underline" to="/admin/gateways">
              ← Gateways
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Gateway #{gateway.id}</h1>
            <p className="mt-1 text-[var(--text-muted)]">
              {property?.name || `Predio ${gateway.property_id}`}
              {client?.company_name ? ` · ${client.company_name}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">Gestión:</span>
              <GatewayStatusBadge status={gateway.status} />
              <span className="text-sm text-[var(--text-muted)]">Conexión:</span>
              <GatewayStatusBadge edgeStatus={status?.edge_status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <PillButton type="button" loading={publishing} onClick={() => void handlePublish()}>
              Publicar configuración
            </PillButton>
            <Link
              className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-black/5"
              to="/admin/gateways/pair"
            >
              Aprobación de vinculación
            </Link>
          </div>
        </div>

        {error && <p className="text-[var(--status-danger)]">{error}</p>}

        <BentoCard>
          <h2 className="text-lg font-semibold">Proceso de instalación</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            El equipo muestra el código de vinculación en su pantalla (Instalación → Paso 1); el
            administrador lo aprueba en Aprobación de vinculación.
          </p>
          <ol className="mt-4 grid gap-3 md:grid-cols-4">
            {steps.map((step, index) => (
              <li
                key={step.key}
                className={`rounded-xl border p-3 text-sm ${step.done ? "border-[var(--status-active)]" : ""}`}
              >
                <p className="font-medium">
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1 text-[var(--text-muted)]">{step.hint}</p>
                <p className="mt-2 text-xs font-medium">
                  {step.done ? "Listo" : "Pendiente"}
                </p>
              </li>
            ))}
          </ol>
        </BentoCard>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <BentoCard>
            <p className="text-sm text-[var(--text-muted)]">Último latido del equipo</p>
            <p className="mt-1 text-lg font-semibold">
              {formatElapsed(parseBackendTimestamp(status?.last_heartbeat_at))}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {status?.last_heartbeat_at
                ? new Date(status.last_heartbeat_at).toLocaleString("es-MX")
                : "Sin latido todavía"}
            </p>
          </BentoCard>
          <BentoCard>
            <p className="text-sm text-[var(--text-muted)]">Configuración publicada</p>
            <p className="mt-1 text-lg font-semibold">
              {(gateway.configuration_version ?? 0) > 0
                ? `Versión ${gateway.configuration_version}`
                : "Sin publicar"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Revision de vínculos: {gateway.bindings_revision}
            </p>
          </BentoCard>
          <BentoCard>
            <p className="text-sm text-[var(--text-muted)]">Estado de gestión</p>
            <p className="mt-1 text-lg font-semibold">
              {MANAGEMENT_LABELS[gateway.status] || gateway.status}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {gateway.activated_at
                ? `Activado el ${new Date(gateway.activated_at).toLocaleString("es-MX")}`
                : "Aún sin activar"}
            </p>
          </BentoCard>
          <BentoCard>
            <p className="text-sm text-[var(--text-muted)]">Ranuras</p>
            <p className="mt-1 text-lg font-semibold">
              {confirmedCount} de {slotCount} confirmadas
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Una ranura por área de riego del predio
            </p>
          </BentoCard>
        </div>

        <BentoCard>
          <h2 className="text-lg font-semibold">Ranuras del gateway</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th className="py-2 pr-4">Área</th>
                  <th className="py-2 pr-4">Nodo</th>
                  <th className="py-2 pr-4">Enlace</th>
                  <th className="py-2 pr-4">Identidad física</th>
                  <th className="py-2">Última lectura</th>
                </tr>
              </thead>
              <tbody>
                {(status?.slots || []).map((slot) => {
                  const node = slotNodes[slot.irrigation_area_id];
                  return (
                    <tr key={slot.logical_node_id} className="border-t">
                      <td className="py-2 pr-4">
                        {node?.area_name || `Área ${slot.irrigation_area_id}`}
                      </td>
                      <td className="py-2 pr-4">
                        {node?.name || "—"}
                        {node?.serial_number ? (
                          <span className="block text-xs text-[var(--text-muted)]">{node.serial_number}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4">
                        {BINDING_LABELS[slot.binding_status] || slot.binding_status}
                      </td>
                      <td className="py-2 pr-4">
                        {slot.bound_uid || slot.bound_serial || "—"}
                      </td>
                      <td className="py-2">
                        {slot.latest_reading_at
                          ? `${formatElapsed(parseBackendTimestamp(slot.latest_reading_at))} · ${new Date(slot.latest_reading_at).toLocaleString("es-MX")}`
                          : "Sin lecturas"}
                      </td>
                    </tr>
                  );
                })}
                {(status?.slots || []).length === 0 && (
                  <tr>
                    <td className="py-3 text-[var(--text-muted)]" colSpan={5}>
                      Este gateway no tiene ranuras.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BentoCard>
      </div>
    </PageTransition>
  );
}
