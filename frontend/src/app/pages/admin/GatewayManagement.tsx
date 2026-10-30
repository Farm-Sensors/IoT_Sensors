import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Hourglass, Plus, Router } from "lucide-react";
import { BentoCard } from "../../components/BentoCard";
import { EmptyState } from "../../components/EmptyState";
import {
  areasWithData,
  EquipoStateBadge,
  equipoState,
  slotHasRecentData,
} from "../../components/EquipoStateBadge";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PairingApprovalPanel } from "../../components/PairingApprovalPanel";
import { PillButton } from "../../components/PillButton";
import { RevokeLinkButton } from "../../components/RevokeLinkButton";
import { useToast } from "../../components/Toast";
import { api } from "../../services/api";
import {
  Gateway,
  gatewayRanchLabel,
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
  is_active: boolean;
};

type ActivationReference = {
  gatewayId: number;
  value: string;
  expiresAt: string;
  image: string;
};

const STEP_TITLES = ["Rancho y áreas", "Vincular equipo", "Asignar nodos"];
// Mientras el asistente está abierto, el avance se actualiza solo.
const REFRESH_MS = 15_000;
const OUTLINE_LINK =
  "inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--outline-contrast)] px-5 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

// Mensajes llanos para los rechazos al crear el enlace (el API responde en inglés).
function createLinkErrorMessage(err: unknown): string {
  const text = getErrorMessage(err, "");
  if (text.includes("already exists")) {
    return "Este rancho ya tiene un equipo.";
  }
  if (text.includes("disabled node")) {
    return "Una de las áreas tiene su nodo deshabilitado. Actívalo en Nodos o quita esa área.";
  }
  if (text.includes("binding history")) {
    return "Un área que quitaste ya tuvo un nodo en este rancho. Vuelve a marcarla.";
  }
  return "No se pudo guardar. Revisa las áreas e inténtalo de nuevo.";
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
  // El asistente vive en la URL: ?gateway=N (equipo en curso) o ?nuevo=1 (paso 1).
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = Number(searchParams.get("gateway")) || null;
  const creating = !openId && searchParams.get("nuevo") === "1";
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [statuses, setStatuses] = useState<Record<number, GatewayStatus>>({});
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [areaNames, setAreaNames] = useState<Record<number, string>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [nodesByArea, setNodesByArea] = useState<Record<number, AreaNode>>({});
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [reference, setReference] = useState<ActivationReference | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [justLinked, setJustLinked] = useState(false);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const setup = openId
    ? (gateways.find((gateway) => gateway.id === openId && gateway.status !== "revoked") ?? null)
    : null;
  const setupId = setup?.id ?? null;
  const setupPropertyId = setup?.property_id ?? null;
  const setupStatus = setupId ? (statuses[setupId] ?? null) : null;
  const wizardOpen = !loading && (creating || setup !== null);

  const load = async () => {
    try {
      const res = await listGateways();
      setGateways(res.data);
      const results = await Promise.allSettled(res.data.map((gateway) => getGatewayStatus(gateway.id)));
      const next: Record<number, GatewayStatus> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          next[res.data[index].id] = result.value.data;
        }
      });
      setStatuses(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "No se pudieron cargar los equipos"));
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
      showToast(getErrorMessage(err, "No se pudieron cargar los ranchos"), "error");
    }
  };

  const refreshGateway = async (gatewayId: number, silent = false) => {
    try {
      const [gatewayRes, statusRes] = await Promise.all([
        getGateway(gatewayId),
        getGatewayStatus(gatewayId),
      ]);
      setGateways((current) =>
        current.some((item) => item.id === gatewayId)
          ? current.map((item) => (item.id === gatewayId ? gatewayRes.data : item))
          : [...current, gatewayRes.data],
      );
      setStatuses((current) => ({ ...current, [gatewayId]: statusRes.data }));
    } catch (err) {
      if (!silent) showToast(getErrorMessage(err, "No se pudo actualizar el equipo"), "error");
    }
  };

  useEffect(() => {
    void load();
    void loadProperties();
  }, []);

  // Un ?gateway=N que no existe o ya está revocado vuelve a la lista.
  useEffect(() => {
    if (loading || !openId || setup) return;
    setSearchParams({}, { replace: true });
  }, [loading, openId, setup]);

  // Al abrir un equipo: estado fresco y actualización periódica mientras siga abierto.
  useEffect(() => {
    setJustLinked(false);
    setReference(null);
    if (!setupId) return;
    void refreshGateway(setupId, true);
    const timer = window.setInterval(() => void refreshGateway(setupId, true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [setupId]);

  // Nombres de las áreas del equipo abierto (paso 3).
  useEffect(() => {
    if (!setupPropertyId) {
      setAreaNames({});
      return;
    }
    let cancelled = false;
    getGeoNodes({ property_id: setupPropertyId, include_without_coordinates: true, per_page: 200 })
      .then((geoRes) => {
        if (cancelled) return;
        const names: Record<number, string> = {};
        for (const node of geoRes.data) {
          names[node.irrigation_area_id] = node.irrigation_area_name;
        }
        setAreaNames(names);
      })
      .catch(() => {
        if (!cancelled) setAreaNames({});
      });
    return () => {
      cancelled = true;
    };
  }, [setupPropertyId]);

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
            is_active: node.is_active,
          };
        }
        setNodesByArea(byArea);
        setSelectedAreaIds([]);
      } catch (err) {
        if (!cancelled) {
          showToast(getErrorMessage(err, "No se pudieron cargar las áreas del rancho"), "error");
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

  const total = setup?.slots.length ?? 0;
  const withData = areasWithData(setupStatus);
  const stepDone = [
    (setup?.configuration_version ?? 0) > 0,
    setup?.status === "active",
    total > 0 && withData === total,
  ];
  // -1: los tres pasos están hechos.
  const currentStep = stepDone.findIndex((done) => !done);

  // El foco sigue al paso en curso (al abrir el asistente y al avanzar) y vuelve al título al salir.
  const stepKey = wizardOpen ? `${setupId ?? "nuevo"}-${currentStep}` : null;
  const wasWizardOpen = useRef(false);
  useEffect(() => {
    if (stepKey) {
      stepHeadingRef.current?.focus();
    } else if (wasWizardOpen.current) {
      pageHeadingRef.current?.focus();
    }
    wasWizardOpen.current = Boolean(stepKey);
  }, [stepKey]);

  const startNew = () => {
    setSelectedPropertyId("");
    setSelectedAreaIds([]);
    setFormError(null);
    setSearchParams({ nuevo: "1" });
  };

  const handleCreateLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPropertyId || selectedAreaIds.length === 0) {
      setFormError("Elige un rancho y al menos un área.");
      return;
    }
    try {
      setBusy(true);
      const created = await provisionGateway(Number(selectedPropertyId), selectedAreaIds);
      showToast("Rancho y áreas guardados", "success");
      setSelectedPropertyId("");
      setSelectedAreaIds([]);
      setFormError(null);
      // Un rancho con enlace revocado reutiliza el mismo enlace: reemplázalo, no lo dupliques.
      setGateways((current) => [
        ...current.filter((item) => item.id !== created.data.id),
        created.data,
      ]);
      setSearchParams({ gateway: String(created.data.id) }, { replace: true });
    } catch (err) {
      setFormError(createLinkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Solo para enlaces creados antes de que el paso 1 dejara lista la configuración.
  const handlePublish = async (gatewayId: number) => {
    try {
      setBusy(true);
      await publishConfiguration(gatewayId);
      showToast("Configuración lista", "success");
      await refreshGateway(gatewayId);
    } catch (err) {
      showToast(getErrorMessage(err, "No se pudo dejar lista la configuración"), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleApproved = (gatewayId: number) => {
    // Avanza al paso 3 sin esperar a la recarga.
    setGateways((current) =>
      current.map((item) => (item.id === gatewayId ? { ...item, status: "active" } : item)),
    );
    setJustLinked(true);
    void refreshGateway(gatewayId);
  };

  const handleRevoked = async (gatewayId: number) => {
    try {
      const res = await getGateway(gatewayId);
      setGateways((current) => current.map((item) => (item.id === gatewayId ? res.data : item)));
    } catch (err) {
      showToast(getErrorMessage(err, "No se pudo actualizar el equipo"), "error");
    }
    setSearchParams({});
  };

  const handleReference = async (gatewayId: number) => {
    try {
      setIssuing(true);
      const res = await issueActivationReference(gatewayId);
      const image = await QRCode.toDataURL(res.data.activation_reference, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      });
      setReference({
        gatewayId,
        value: res.data.activation_reference,
        expiresAt: res.data.expires_at,
        image,
      });
      showToast("Referencia lista. Generar otra invalida esta.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Este equipo ya no está pendiente de vincular"), "error");
    } finally {
      setIssuing(false);
    }
  };

  const handleCopyReference = async () => {
    if (!reference) return;
    const copied = await copyToClipboard(reference.value);
    showToast(
      copied ? "Referencia copiada" : "No se pudo copiar la referencia",
      copied ? "success" : "error",
    );
  };

  const clientNames = new Map(clients.map((client) => [client.id, client.company_name]));
  const ranchOptionLabel = (property: PropertyOption) => {
    const company = clientNames.get(property.client_id);
    return company ? `${property.name} · ${company}` : property.name;
  };

  const currentLinks = gateways.filter((gateway) => gateway.status !== "revoked");
  const revokedLinks = gateways.filter((gateway) => gateway.status === "revoked");

  const renderCard = (gateway: Gateway) => {
    const status = statuses[gateway.id];
    const state = equipoState(gateway, status);
    const label = gatewayRanchLabel(gateway);
    const open = () => setSearchParams({ gateway: String(gateway.id) });
    return (
      <li key={gateway.id}>
        <BentoCard padding="sm" className="h-full">
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--text-main)]">{label}</h2>
              <EquipoStateBadge state={state} />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {areasWithData(status)} de {gateway.slots.length} áreas con datos
            </p>
            <div className="mt-auto">
              {state === "unlinked" || state === "assigning" ? (
                <PillButton
                  variant="outline"
                  aria-label={`${state === "unlinked" ? "Vincular equipo" : "Ver avance"}: ${label}`}
                  onClick={open}
                >
                  {state === "unlinked" ? "Vincular equipo" : "Ver avance"}
                </PillButton>
              ) : (
                <Link
                  className={OUTLINE_LINK}
                  aria-label={`Ver detalle: ${label}`}
                  to={`/admin/gateways/${gateway.id}`}
                >
                  Ver detalle
                </Link>
              )}
            </div>
          </div>
        </BentoCard>
      </li>
    );
  };

  const renderList = () => (
    <div className="space-y-6">
      {currentLinks.length === 0 ? (
        <BentoCard>
          <EmptyState
            icon={Router}
            title="Todavía no hay equipos"
            description="Vincula el primero a un rancho."
            action={{ label: "Nuevo equipo", onClick: startNew }}
          />
        </BentoCard>
      ) : (
        <ul aria-label="Equipos" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {currentLinks.map(renderCard)}
        </ul>
      )}
      {revokedLinks.length > 0 && (
        <details className="text-sm text-[var(--text-muted)]">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Revocados ({revokedLinks.length})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
            {revokedLinks.map((gateway) => (
              <li key={gateway.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{gatewayRanchLabel(gateway)}</span>
                <Link
                  className="inline-flex min-h-[44px] items-center underline underline-offset-4"
                  aria-label={`Ver detalle: ${gatewayRanchLabel(gateway)}`}
                  to={`/admin/gateways/${gateway.id}`}
                >
                  Ver detalle
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  const renderStepOne = () => {
    if (setup) {
      // Enlace antiguo sin configuración: lo único pendiente del paso 1.
      return (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[var(--text-muted)]">Falta dejar lista la configuración del equipo.</p>
          <PillButton loading={busy} onClick={() => void handlePublish(setup.id)}>
            Dejar lista la configuración
          </PillButton>
        </div>
      );
    }
    return (
      <form className="mt-3 space-y-4" onSubmit={handleCreateLink} noValidate>
        <p className="text-sm text-[var(--text-muted)]">
          Elige el rancho y marca las áreas que atenderá el equipo.
        </p>
        <div className="flex max-w-xl flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="ranch-select">
            Rancho
          </label>
          <select
            id="ranch-select"
            className="w-full rounded-xl border px-3 py-2"
            value={selectedPropertyId}
            onChange={(event) => setSelectedPropertyId(event.target.value)}
          >
            <option value="">Selecciona un rancho…</option>
            {properties.map((property) => {
              const occupied = currentLinks.some((gateway) => gateway.property_id === property.id);
              return (
                <option key={property.id} value={property.id} disabled={occupied}>
                  {ranchOptionLabel(property)}
                  {occupied ? " (ya tiene equipo)" : ""}
                </option>
              );
            })}
          </select>
        </div>
        {selectedPropertyId && (
          <fieldset>
            <legend className="text-sm font-medium">Áreas de riego</legend>
            {loadingAreas ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">Cargando áreas…</p>
            ) : areas.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Este rancho no tiene áreas. Créalas en Predios → Áreas.
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {areas.map((area) => {
                  const node = nodesByArea[area.id];
                  // Sin nodo: se crea al guardar. Nodo deshabilitado: hay que activarlo.
                  const selectable = !node || node.is_active;
                  return (
                    <label
                      key={area.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${selectable ? "cursor-pointer" : "opacity-70"}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={area.name}
                        className="mt-1"
                        checked={selectedAreaIds.includes(area.id)}
                        disabled={!selectable}
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
                          {!node
                            ? "Sin nodo: se crea uno"
                            : node.is_active
                              ? `Nodo: ${node.name || node.serial_number || "sin nombre"}`
                              : "Nodo deshabilitado: actívalo en Nodos"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        )}
        {formError && (
          <p role="alert" className="text-sm text-[var(--status-danger-text)]">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <PillButton
            type="submit"
            disabled={!selectedPropertyId || selectedAreaIds.length === 0}
            loading={busy}
          >
            Crear y continuar
          </PillButton>
          <span className="text-sm text-[var(--text-muted)]" aria-live="polite">
            {selectedAreaIds.length === 1 ? "1 área elegida" : `${selectedAreaIds.length} áreas elegidas`}
          </span>
        </div>
      </form>
    );
  };

  const renderStepTwo = (gateway: Gateway) => (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        En la pantalla del equipo toca «Vincular equipo» y escribe aquí el código.
      </p>
      <PairingApprovalPanel
        embedded
        preselectGatewayId={gateway.id}
        onApproved={() => handleApproved(gateway.id)}
      />
      <details className="text-sm">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded text-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          ¿El equipo no muestra código?
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-[var(--text-muted)]">Genera una referencia y escríbela en el equipo.</p>
          <PillButton
            variant="outline"
            loading={issuing}
            onClick={() => void handleReference(gateway.id)}
          >
            Generar referencia
          </PillButton>
          {reference && reference.gatewayId === gateway.id && (
            <div className="flex flex-wrap items-center gap-3">
              <code data-testid="one-time-secret" className="break-all font-mono text-sm font-semibold">
                {reference.value}
              </code>
              <img src={reference.image} alt="QR de la referencia" width={110} height={110} />
              <PillButton variant="ghost" onClick={() => void handleCopyReference()}>
                Copiar
              </PillButton>
              <span className="text-[var(--text-muted)]">
                Caduca {new Date(reference.expiresAt).toLocaleString("es-MX")}
              </span>
            </div>
          )}
        </div>
      </details>
    </div>
  );

  const renderStepThree = (gateway: Gateway) => (
    <div className="mt-3 space-y-4">
      {justLinked && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-[var(--status-active-bg)] px-3 py-2 text-sm font-medium text-[var(--text-main)]"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-[var(--status-active)]" />
          Equipo vinculado
        </p>
      )}
      <p className="text-sm text-[var(--text-muted)]">
        En la pantalla del equipo asigna cada nodo a su área y toca «Enviar asignaciones».
      </p>
      <p className="text-sm font-medium" aria-live="polite">
        {withData} de {gateway.slots.length} áreas con datos
      </p>
      {setupStatus ? (
        <ul aria-label="Áreas" className="divide-y divide-[var(--border-subtle)] text-sm">
          {setupStatus.slots.map((slot) => {
            const receiving = slotHasRecentData(slot);
            const assigned = slot.binding_status === "confirmed";
            const Icon = receiving ? CheckCircle2 : assigned ? AlertTriangle : Hourglass;
            const last = parseBackendTimestamp(slot.latest_reading_at);
            return (
              <li key={slot.logical_node_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">
                  {areaNames[slot.irrigation_area_id] || `Área ${slot.irrigation_area_id}`}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon
                      aria-hidden="true"
                      className={`h-4 w-4 ${receiving ? "text-[var(--status-active)]" : assigned ? "text-[var(--status-warning)]" : "text-[var(--text-muted)]"}`}
                    />
                    {receiving ? "Recibiendo datos" : assigned ? "Sin datos recientes" : "Esperando nodo"}
                  </span>
                  {last && <span className="text-[var(--text-muted)]">· {formatElapsed(last)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Cargando áreas…</p>
      )}
      <p className="text-xs text-[var(--text-muted)]">Se actualiza solo cada 15 segundos.</p>
    </div>
  );

  const stepSummaries = setup
    ? [
        `${gatewayRanchLabel(setup)} · ${total === 1 ? "1 área" : `${total} áreas`}`,
        "Equipo vinculado",
        "Todas las áreas reciben datos",
      ]
    : [];

  const renderWizard = () => (
    <section aria-labelledby="wizard-title" className="space-y-4">
      <button
        type="button"
        onClick={() => setSearchParams({})}
        className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-medium text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-main)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver a la lista
      </button>
      <h2 id="wizard-title" className="text-xl font-semibold text-[var(--text-main)]">
        {setup ? gatewayRanchLabel(setup) : "Nuevo equipo"}
      </h2>
      <ol aria-label="Pasos" className="space-y-2">
        {STEP_TITLES.map((title, index) => {
          const done = stepDone[index];
          if (index === currentStep) {
            return (
              <li key={title} aria-current="step">
                <BentoCard>
                  <section aria-labelledby={`step-${index}-title`} data-testid="current-step">
                    <p className="text-xs font-medium text-[var(--text-muted)]">
                      Paso {index + 1} de {STEP_TITLES.length}
                    </p>
                    <h3
                      id={`step-${index}-title`}
                      ref={stepHeadingRef}
                      tabIndex={-1}
                      className="text-lg font-semibold text-[var(--text-main)] focus:outline-none"
                    >
                      {title}
                    </h3>
                    {index === 0 && renderStepOne()}
                    {index === 1 && setup && renderStepTwo(setup)}
                    {index === 2 && setup && renderStepThree(setup)}
                  </section>
                </BentoCard>
              </li>
            );
          }
          return (
            <li
              key={title}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] px-4 py-3 text-sm"
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-[var(--status-active-bg)] text-[var(--text-main)]" : "border border-[var(--outline-contrast)] text-[var(--text-muted)]"}`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="font-medium text-[var(--text-main)]">{title}</span>
              <span className="min-w-0 truncate text-[var(--text-muted)]">
                <span className="sr-only">{done ? "Hecho: " : ""}</span>
                {done ? stepSummaries[index] : "Pendiente"}
              </span>
            </li>
          );
        })}
      </ol>
      {currentStep === -1 && setup && (
        <BentoCard>
          <div role="status" className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="h-8 w-8 flex-shrink-0 text-[var(--status-active)]" />
            <div>
              <h3
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-lg font-semibold text-[var(--text-main)] focus:outline-none"
              >
                Listo
              </h3>
              <p className="text-sm text-[var(--text-muted)]">Todas las áreas reciben datos.</p>
            </div>
          </div>
          <Link
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--accent-primary)] px-6 py-2.5 font-medium text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            to={`/admin/gateways/${setup.id}`}
          >
            Ver detalle
          </Link>
        </BentoCard>
      )}
      {setup && (
        <div className="pt-2">
          <RevokeLinkButton variant="link" gateway={setup} onRevoked={() => handleRevoked(setup.id)} />
        </div>
      )}
    </section>
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Equipos"
          headingRef={pageHeadingRef}
          action={
            !loading && !wizardOpen && currentLinks.length > 0 ? (
              <PillButton onClick={startNew}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nuevo equipo
              </PillButton>
            ) : undefined
          }
        />

        {loadError && (
          <p role="alert" className="text-[var(--status-danger-text)]">
            {loadError}
          </p>
        )}

        {loading ? (
          <p role="status" className="text-[var(--text-muted)]">
            Cargando equipos…
          </p>
        ) : wizardOpen ? (
          renderWizard()
        ) : (
          renderList()
        )}
      </div>
    </PageTransition>
  );
}
