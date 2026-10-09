import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Link } from "react-router";
import { BentoCard } from "../../components/BentoCard";
import { PageTransition } from "../../components/PageTransition";
import { PairingApprovalPanel } from "../../components/PairingApprovalPanel";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import {
  Gateway,
  GatewayStatus,
  getGateway,
  getGatewayStatus,
  issueActivationReference,
  listGateways,
  provisionGateway,
  publishConfiguration,
} from "../../services/gateways";
import { getGeoNodes } from "../../services/nodes";
import { formatElapsed, parseBackendTimestamp } from "../../utils/datetime";
import { getErrorMessage } from "../../utils/errors";

type PropertyOption = {
  id: number;
  client_id: number;
  name: string;
};

type ClientOption = {
  id: number;
  company_name: string;
};

type AreaOption = {
  id: number;
  property_id: number;
  name: string;
  crop_type?: { id: number; name: string } | null;
};

type AreaNode = {
  name: string | null;
  serial_number: string | null;
  area_name: string;
  is_active: boolean;
};

const BINDING_LABELS: Record<string, string> = {
  unbound: "Sin nodo físico todavía",
  pending: "Nodo propuesto, sin confirmar",
  pending_initial: "Nodo propuesto, sin confirmar",
  pending_reassignment: "Cambio de nodo pendiente",
  confirmed: "Nodo enlazado",
};

const STEPS = [
  { key: "create", title: "Elige el rancho y sus parcelas", hint: "Crea el enlace del predio" },
  { key: "publish", title: "Publica la configuración", hint: "El equipo la leerá al vincularse" },
  { key: "link", title: "Vincula la Raspberry", hint: "Aprueba el código de su pantalla" },
  { key: "bind", title: "Enlaza los nodos", hint: "Cada parcela con su nodo físico" },
];

function confirmedCount(status: GatewayStatus | undefined): number {
  return status?.slots.filter((slot) => slot.binding_status === "confirmed").length ?? 0;
}

function stateLabel(gateway: Gateway, status: GatewayStatus | undefined): string {
  if (gateway.status === "revoked") {
    return "Enlace revocado";
  }
  if (gateway.status === "pending_activation") {
    return "Falta vincular la Raspberry";
  }
  if (status?.edge_status === "connected") {
    return "Vinculada y reportando";
  }
  if (status?.edge_status === "delayed") {
    return "Vinculada, con retraso";
  }
  return "Vinculada, sin conexión reciente";
}

function isIncomplete(gateway: Gateway, status: GatewayStatus | undefined): boolean {
  if (gateway.status === "revoked") {
    return false;
  }
  return gateway.status === "pending_activation" || confirmedCount(status) < gateway.slots.length;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function GatewayManagement() {
  const { showToast } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [statuses, setStatuses] = useState<Record<number, GatewayStatus>>({});
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [setup, setSetup] = useState<Gateway | null>(null);
  const [setupStatus, setSetupStatus] = useState<GatewayStatus | null>(null);
  const [slotNodes, setSlotNodes] = useState<Record<number, AreaNode>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [nodesByArea, setNodesByArea] = useState<Record<number, AreaNode>>({});
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<{ gatewayId: number; expiresAt: string; image: string } | null>(null);
  const [issuing, setIssuing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = async (items: Gateway[]) => {
    const results = await Promise.allSettled(items.map((gateway) => getGatewayStatus(gateway.id)));
    const next: Record<number, GatewayStatus> = {};
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        next[items[index].id] = result.value.data;
      }
    });
    setStatuses(next);
    return next;
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await listGateways();
      setGateways(res.data);
      const nextStatuses = await loadStatuses(res.data);
      setError(null);
      setSetup((current) => {
        if (current) {
          return current;
        }
        const inProgress = [...res.data]
          .reverse()
          .find((gateway) => isIncomplete(gateway, nextStatuses[gateway.id]));
        if (inProgress) {
          setSetupStatus(nextStatuses[inProgress.id] ?? null);
        }
        return inProgress ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar los enlaces"));
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const [propertiesRes, clientsRes] = await Promise.all([
        api.get<{ data: PropertyOption[] }>("/properties?per_page=100"),
        api.get<{ data: ClientOption[] }>("/clients?per_page=100"),
      ]);
      setProperties(propertiesRes.data.data || []);
      setClients(clientsRes.data.data || []);
    } catch (err) {
      showToast(getErrorMessage(err, "No se pudieron cargar los predios"), "error");
    }
  };

  useEffect(() => {
    void load();
    void loadProperties();
  }, []);

  // The reference is per-visit: dropping it when the page unmounts keeps it from lingering.
  useEffect(() => () => {
    setOneTimeSecret(null);
    setQr(null);
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) {
      setAreas([]);
      setNodesByArea({});
      setSelectedAreaIds([]);
      return;
    }
    let cancelled = false;
    const fetchAreas = async () => {
      try {
        setLoadingAreas(true);
        const [areasRes, geoRes] = await Promise.all([
          api.get<{ data: AreaOption[] }>(
            `/irrigation-areas?property_id=${selectedPropertyId}&per_page=100`,
          ),
          getGeoNodes({
            property_id: Number(selectedPropertyId),
            include_without_coordinates: true,
            per_page: 200,
          }),
        ]);
        if (cancelled) return;
        setAreas(areasRes.data.data || []);
        const byArea: Record<number, AreaNode> = {};
        for (const node of geoRes.data) {
          byArea[node.irrigation_area_id] = {
            name: node.name,
            serial_number: node.serial_number,
            area_name: node.irrigation_area_name,
            is_active: node.is_active,
          };
        }
        setNodesByArea(byArea);
        setSelectedAreaIds([]);
      } catch (err) {
        if (!cancelled) {
          showToast(getErrorMessage(err, "No se pudieron cargar las parcelas del rancho"), "error");
        }
      } finally {
        if (!cancelled) setLoadingAreas(false);
      }
    };
    void fetchAreas();
    return () => {
      cancelled = true;
    };
  }, [selectedPropertyId]);

  const refreshSetup = async (gatewayId: number) => {
    try {
      const [gatewayRes, statusRes] = await Promise.all([
        getGateway(gatewayId),
        getGatewayStatus(gatewayId),
      ]);
      setSetup(gatewayRes.data);
      setSetupStatus(statusRes.data);
      setGateways((current) =>
        current.map((item) => (item.id === gatewayRes.data.id ? gatewayRes.data : item)),
      );
      setStatuses((current) => ({ ...current, [gatewayId]: statusRes.data }));
    } catch (err) {
      showToast(getErrorMessage(err, "No se pudo actualizar el enlace"), "error");
    }
  };

  // Parcelas y nodos del rancho enlazado (nombres para el paso 4).
  useEffect(() => {
    if (!setup) {
      setSlotNodes({});
      return;
    }
    let cancelled = false;
    getGeoNodes({ property_id: setup.property_id, include_without_coordinates: true, per_page: 200 })
      .then((geoRes) => {
        if (cancelled) return;
        const byArea: Record<number, AreaNode> = {};
        for (const node of geoRes.data) {
          byArea[node.irrigation_area_id] = {
            name: node.name,
            serial_number: node.serial_number,
            area_name: node.irrigation_area_name,
            is_active: node.is_active,
          };
        }
        setSlotNodes(byArea);
      })
      .catch(() => {
        if (!cancelled) setSlotNodes({});
      });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  const handleCreateLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPropertyId || selectedAreaIds.length === 0) {
      const message = "Elige un rancho y al menos una parcela";
      setError(message);
      showToast(message, "error");
      return;
    }
    try {
      setBusy(true);
      const created = await provisionGateway(Number(selectedPropertyId), selectedAreaIds);
      showToast(`Enlace creado con ${selectedAreaIds.length} parcela(s)`, "success");
      setSelectedPropertyId("");
      setSelectedAreaIds([]);
      setError(null);
      setGateways((current) => [...current, created.data]);
      setSetup(created.data);
      await refreshSetup(created.data.id);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo crear el enlace");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async (gatewayId: number) => {
    try {
      setBusy(true);
      await publishConfiguration(gatewayId);
      showToast("Configuración publicada", "success");
      setError(null);
      await refreshSetup(gatewayId);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo publicar la configuración");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyReference = async () => {
    if (!oneTimeSecret) return;
    const copied = await copyToClipboard(oneTimeSecret);
    showToast(
      copied ? "Referencia copiada" : "No se pudo copiar la referencia",
      copied ? "success" : "error",
    );
  };

  const handleReference = async (gatewayId: number) => {
    try {
      setIssuing(gatewayId);
      const res = await issueActivationReference(gatewayId);
      const image = await QRCode.toDataURL(res.data.activation_reference, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      });
      setOneTimeSecret(res.data.activation_reference);
      setQr({ gatewayId, expiresAt: res.data.expires_at, image });
      showToast("Referencia lista. Generar otra invalida esta.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Este enlace ya no está pendiente de vinculación"), "error");
    } finally {
      setIssuing(null);
    }
  };

  const clientNames = new Map(clients.map((client) => [client.id, client.company_name]));
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const ranchLabel = (propertyId: number) => {
    const property = propertyById.get(propertyId);
    if (!property) return `Predio ${propertyId}`;
    const company = clientNames.get(property.client_id);
    return company ? `${property.name} · ${company}` : property.name;
  };

  const setupSlots = setupStatus?.slots ?? [];
  const setupConfirmed = confirmedCount(setupStatus ?? undefined);
  const stepDone = [
    Boolean(setup),
    (setup?.configuration_version ?? 0) > 0,
    setup?.status === "active",
    setupSlots.length > 0 && setupConfirmed === setupSlots.length,
  ];
  const currentStep = stepDone.findIndex((done) => !done);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Gateways</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
            Aquí enlazas una Raspberry con Agro a un rancho: eliges el rancho y sus parcelas,
            publicas la configuración, apruebas el código que muestra la pantalla del equipo y ves
            los nodos reportando.
          </p>
        </div>

        <BentoCard>
          <ol className="grid gap-3 md:grid-cols-4" aria-label="Pasos del enlace">
            {STEPS.map((step, index) => {
              const done = stepDone[index];
              const current = !done && index === currentStep;
              return (
                <li
                  key={step.key}
                  className={`rounded-xl border p-3 text-sm ${done ? "border-[var(--status-active)]" : ""}`}
                >
                  <p className="font-medium">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-[var(--text-muted)]">{step.hint}</p>
                  <p className="mt-2 text-xs font-medium">
                    {done ? "Listo" : current ? "En curso" : "Pendiente"}
                  </p>
                </li>
              );
            })}
          </ol>
        </BentoCard>

        {error && <p className="text-[var(--status-danger)]">{error}</p>}

        {!setup ? (
          <BentoCard>
            <form className="space-y-4" onSubmit={handleCreateLink}>
              <div>
                <h2 className="text-lg font-semibold">1. Elige el rancho y sus parcelas</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Cada parcela marcada será una ranura del enlace. Todas las parcelas necesitan su
                  nodo activo (se asigna en Nodos); si falta, la API rechazará la operación.
                </p>
              </div>
              <label className="block max-w-xl text-sm font-medium">
                Rancho (predio)
                <select
                  aria-label="Rancho"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={selectedPropertyId}
                  onChange={(event) => setSelectedPropertyId(event.target.value)}
                >
                  <option value="">Selecciona un rancho…</option>
                  {properties.map((property) => {
                    const occupied = gateways.some(
                      (gateway) => gateway.property_id === property.id && gateway.status !== "revoked",
                    );
                    return (
                      <option key={property.id} value={property.id} disabled={occupied}>
                        {ranchLabel(property.id)}
                        {occupied ? " (ya tiene enlace)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              {selectedPropertyId && (
                <fieldset>
                  <legend className="text-sm font-medium">Parcelas del rancho</legend>
                  {loadingAreas ? (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Cargando parcelas…</p>
                  ) : areas.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      Este rancho todavía no tiene parcelas. Créalas en Predios → Áreas.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {areas.map((area) => {
                        const node = nodesByArea[area.id];
                        const hasActiveNode = Boolean(node?.is_active);
                        return (
                          <label
                            key={area.id}
                            className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              aria-label={area.name}
                              className="mt-1"
                              checked={selectedAreaIds.includes(area.id)}
                              disabled={!hasActiveNode}
                              onChange={(event) =>
                                setSelectedAreaIds((current) =>
                                  event.target.checked
                                    ? [...current, area.id]
                                    : current.filter((id) => id !== area.id),
                                )
                              }
                            />
                            <span>
                              <span className="font-medium">{area.name}</span>
                              {area.crop_type?.name ? (
                                <span className="text-[var(--text-muted)]"> · {area.crop_type.name}</span>
                              ) : null}
                              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                                {hasActiveNode
                                  ? `Nodo: ${node?.name || node?.serial_number || "sin nombre"}`
                                  : "Sin nodo activo: asígnalo en Nodos antes de crear el enlace"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <PillButton
                  type="submit"
                  disabled={!selectedPropertyId || selectedAreaIds.length === 0}
                  loading={busy}
                >
                  Crear enlace
                </PillButton>
                <span className="text-sm text-[var(--text-muted)]">
                  {selectedAreaIds.length > 0
                    ? `${selectedAreaIds.length} parcela(s) seleccionada(s)`
                    : "Marca al menos una parcela"}
                </span>
              </div>
            </form>
          </BentoCard>
        ) : (
          <>
            <BentoCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    2. Publica la configuración de {ranchLabel(setup.property_id)}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
                    La configuración dice al equipo qué parcelas tiene y qué ranura le toca a cada
                    una. Sin publicarla, la Raspberry no podrá reportar.
                  </p>
                </div>
                {setup.configuration_version > 0 ? (
                  <p className="text-sm font-medium text-[var(--status-active)]">
                    Publicada (versión {setup.configuration_version})
                  </p>
                ) : (
                  <PillButton type="button" loading={busy} onClick={() => void handlePublish(setup.id)}>
                    Publicar configuración
                  </PillButton>
                )}
              </div>
            </BentoCard>

            <BentoCard>
              <h2 className="text-lg font-semibold">3. Vincula la Raspberry</h2>
              <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
                En la pantalla del equipo entra a <strong>Instalación → Paso 1</strong> y toca
                «Vincular dispositivo»: mostrará un código y un QR. Escríbelo aquí y apruébalo solo
                si coincide con la pantalla.
              </p>
              {setup.status === "active" ? (
                <p className="mt-3 text-sm font-medium text-[var(--status-active)]">
                  Raspberry vinculada. Si necesitas vincular otra, genera su código en la pantalla
                  y apruébalo aquí abajo.
                </p>
              ) : null}
              <div className="mt-4">
                <PairingApprovalPanel
                  preselectGatewayId={setup.id}
                  onApproved={() => void refreshSetup(setup.id)}
                />
              </div>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-[var(--text-muted)]">
                  Respaldo: referencia de activación (equipo sin pantalla o sin pairing)
                </summary>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <PillButton
                    type="button"
                    variant="outline"
                    loading={issuing === setup.id}
                    disabled={setup.status !== "pending_activation"}
                    onClick={() => void handleReference(setup.id)}
                  >
                    Generar referencia de activación
                  </PillButton>
                  {oneTimeSecret && qr && (
                    <div className="flex flex-wrap items-center gap-3">
                      <code
                        data-testid="one-time-secret"
                        className="break-all font-mono text-sm font-semibold"
                      >
                        {oneTimeSecret}
                      </code>
                      <img
                        src={qr.image}
                        alt={`QR de activación del gateway ${qr.gatewayId}`}
                        width={110}
                        height={110}
                      />
                      <PillButton type="button" variant="ghost" onClick={() => void handleCopyReference()}>
                        Copiar
                      </PillButton>
                      <span className="text-[var(--text-muted)]">
                        Caduca {new Date(qr.expiresAt).toLocaleString("es-MX")}
                      </span>
                    </div>
                  )}
                </div>
              </details>
            </BentoCard>

            <BentoCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">4. Enlaza los nodos</h2>
                  <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">
                    En la pantalla del equipo (Instalación → Pasos 3 y 4) el técnico elige qué nodo
                    físico va en cada parcela y confirma. Aquí ves el avance.
                  </p>
                </div>
                <Link
                  className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-black/5"
                  to={`/admin/gateways/${setup.id}`}
                >
                  Ver detalle completo
                </Link>
              </div>
              <p className="mt-3 text-sm font-medium">
                {setupConfirmed} de {setupSlots.length || setup.slots.length} parcela(s) reportando
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[var(--text-muted)]">
                      <th className="py-2 pr-4">Parcela</th>
                      <th className="py-2 pr-4">Nodo</th>
                      <th className="py-2 pr-4">Estado</th>
                      <th className="py-2 pr-4">Nodo físico</th>
                      <th className="py-2">Última lectura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(setupSlots.length > 0 ? setupSlots : []).map((slot) => {
                      const node = slotNodes[slot.irrigation_area_id];
                      return (
                        <tr key={slot.logical_node_id} className="border-t">
                          <td className="py-2 pr-4">
                            {node?.area_name || `Parcela ${slot.irrigation_area_id}`}
                          </td>
                          <td className="py-2 pr-4">{node?.name || "—"}</td>
                          <td className="py-2 pr-4">
                            {BINDING_LABELS[slot.binding_status] || slot.binding_status}
                          </td>
                          <td className="py-2 pr-4">{slot.bound_uid || "—"}</td>
                          <td className="py-2">
                            {slot.latest_reading_at
                              ? formatElapsed(parseBackendTimestamp(slot.latest_reading_at))
                              : "Sin lecturas"}
                          </td>
                        </tr>
                      );
                    })}
                    {setupSlots.length === 0 && (
                      <tr>
                        <td className="py-3 text-[var(--text-muted)]" colSpan={5}>
                          Esperando la configuración publicada del equipo…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </BentoCard>
          </>
        )}

        <section aria-labelledby="existing-links-title" className="space-y-3">
          <h2 id="existing-links-title" className="text-lg font-semibold">
            Enlaces existentes
          </h2>
          {loading ? (
            <p>Cargando...</p>
          ) : gateways.length === 0 ? (
            <p className="text-[var(--text-muted)]">Todavía no hay ningún enlace creado.</p>
          ) : (
            gateways.map((gateway) => {
              const status = statuses[gateway.id];
              const total = gateway.slots.length;
              const confirmed = confirmedCount(status);
              const incomplete = isIncomplete(gateway, status);
              return (
                <BentoCard key={gateway.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{ranchLabel(gateway.property_id)}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        Enlace #{gateway.id} · {total} parcela(s) · configuración v
                        {gateway.configuration_version}
                      </p>
                      <p className="mt-1 text-sm">
                        {stateLabel(gateway, status)}
                        {status ? ` · ${confirmed} de ${total} reportando` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {incomplete && (
                        <PillButton
                          type="button"
                          onClick={() => {
                            setSetup(gateway);
                            void refreshSetup(gateway.id);
                          }}
                        >
                          Continuar enlace
                        </PillButton>
                      )}
                      <Link
                        className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-black/5"
                        to={`/admin/gateways/${gateway.id}`}
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </div>
                </BentoCard>
              );
            })
          )}
        </section>

        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--text-muted)]">
            Detalles técnicos (API)
          </summary>
          <BentoCard>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-xl border p-3 text-sm">
                <p className="font-medium">Administración</p>
                <code className="mt-2 block break-all text-xs">POST /api/v1/gateways/{"{gateway_id}"}/configuration</code>
                <p className="mt-2 text-[var(--text-muted)]">El administrador publica la configuración desde esta página.</p>
              </article>
              <article className="rounded-xl border p-3 text-sm">
                <p className="font-medium">Configuración y presencia</p>
                <code className="mt-2 block break-all text-xs">GET /api/v1/gateways/me/configuration</code>
                <code className="mt-2 block break-all text-xs">POST /api/v1/gateways/me/heartbeat</code>
                <p className="mt-2 text-[var(--text-muted)]">Agro/edge consulta la configuración y reporta que el gateway sigue disponible.</p>
              </article>
              <article className="rounded-xl border p-3 text-sm">
                <p className="font-medium">Telemetría</p>
                <code className="mt-2 block break-all text-xs">POST /api/v1/readings</code>
                <p className="mt-2 text-[var(--text-muted)]">
                  Usa X-API-Key del gateway, X-Logical-Node-Id y X-Event-ID. La clave nunca se muestra aquí.
                </p>
              </article>
              <article className="rounded-xl border p-3 text-sm">
                <p className="font-medium">Vinculación (emparejamiento)</p>
                <code className="mt-2 block break-all text-xs">POST /api/v1/gateways/pairing-sessions/lookup</code>
                <code className="mt-2 block break-all text-xs">POST /api/v1/gateways/pairing-sessions/{"{id}"}/approve</code>
                <p className="mt-2 text-[var(--text-muted)]">El código se aprueba aquí; el dispositivo recibe su credencial en el siguiente sondeo.</p>
              </article>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              La interfaz de campo (instalación, ranuras y confirmación) vive en la pantalla del
              equipo Agro, no en esta web. La documentación de la API está en{" "}
              <a className="underline" href="/api/v1/docs" rel="noreferrer" target="_blank">
                Swagger
              </a>
              .
            </p>
          </BentoCard>
        </details>
      </div>
    </PageTransition>
  );
}
