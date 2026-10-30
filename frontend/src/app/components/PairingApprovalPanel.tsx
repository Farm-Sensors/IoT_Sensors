import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BentoCard } from "./BentoCard";
import { ConfirmDialog } from "./ConfirmDialog";
import { PillButton } from "./PillButton";
import { useToast } from "./Toast";
import {
  approvePairing,
  denyPairing,
  Gateway,
  gatewayRanchLabel,
  GatewayStatus,
  getPropertyGatewayStatus,
  listGateways,
  lookupPairing,
  PairingApproval,
  PairingSession,
} from "../services/gateways";
import { getErrorMessage } from "../utils/errors";
import { parseBackendTimestamp } from "../utils/datetime";

const USER_CODE_ALPHABET = /^[BCDFGHJKLMNPQRSTVWXZ]{8}$/;

/**
 * Uppercases, strips the optional hyphen/spaces and validates the RFC 8628
 * alphabet, returning the canonical ``XXXX-XXXX`` form or an empty string.
 */
export function normalizeUserCode(value: string): string {
  const compact = value.toUpperCase().replace(/[-\s]/g, "");
  if (!USER_CODE_ALPHABET.test(compact)) {
    return "";
  }
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface PairingError {
  code: string;
  message: string;
  status?: number;
}

function pairingError(error: unknown): PairingError {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object") {
      const status =
        "status" in response && typeof response.status === "number"
          ? response.status
          : undefined;
      const data = "data" in response ? response.data : undefined;
      if (data && typeof data === "object" && "code" in data && typeof data.code === "string") {
        const message =
          "message" in data && typeof data.message === "string"
            ? data.message
            : "No se pudo completar la operación.";
        return { code: data.code, message, status };
      }
    }
  }
  return {
    code: "unknown",
    message: getErrorMessage(error, "No se pudo completar la operación."),
  };
}

type LookupState = "idle" | "loading" | "found" | "not_found" | "locked" | "unavailable";

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "falta vincular su equipo",
  active: "ya tiene equipo · se reemplaza",
};

interface PairingApprovalPanelProps {
  initialCode?: string;
  preselectGatewayId?: number | null;
  onApproved?: (approval: PairingApproval) => void;
  /**
   * Dentro del asistente de Equipos: el rancho ya está elegido, los datos del
   * equipo van plegados y el aviso de éxito lo muestra el asistente.
   */
  embedded?: boolean;
}

/**
 * Código del equipo → solicitud → aprobación. Compartido por la página de
 * verificación y por el asistente de enlace.
 */
export function PairingApprovalPanel({
  initialCode = "",
  preselectGatewayId = null,
  onApproved,
  embedded = false,
}: PairingApprovalPanelProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState(initialCode);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [session, setSession] = useState<PairingSession | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gatewayId, setGatewayId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const [outcome, setOutcome] = useState<{ kind: "approved" | "denied"; message: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedStatus, setSelectedStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    void loadGateways();
  }, []);

  useEffect(() => {
    if (!initialCode) {
      return;
    }
    void runLookup(initialCode);
    // Runs once with the code carried by verification_uri_complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  async function loadGateways() {
    try {
      const { data } = await listGateways();
      setGateways(data);
      if (preselectGatewayId != null) {
        setGatewayId(String(preselectGatewayId));
      }
    } catch (error) {
      setFormError(getErrorMessage(error, "No se pudieron cargar los ranchos enlazados."));
    }
  }

  async function runLookup(raw: string) {
    const normalized = normalizeUserCode(raw);
    if (!normalized) {
      setSession(null);
      setLookupState("idle");
      setLookupMessage(null);
      setFormError("El código tiene 8 caracteres; por ejemplo BCDF-GHJK.");
      return;
    }
    setFormError(null);
    setLookupMessage(null);
    setOutcome(null);
    setCodeInput(normalized);
    setLookupState("loading");
    try {
      const { data } = await lookupPairing(normalized);
      setSession(data);
      setGatewayId(preselectGatewayId != null ? String(preselectGatewayId) : "");
      setConfirmed(false);
      setLookupState("found");
    } catch (error) {
      const parsed = pairingError(error);
      setSession(null);
      if (parsed.status === 429 || parsed.code === "too_many_attempts") {
        setLookupState("locked");
        setLookupMessage(
          parsed.message ||
            "Demasiados intentos; espera unos minutos antes de volver a buscar.",
        );
      } else if (parsed.status === 503 || parsed.code === "pairing_unavailable") {
        setLookupState("unavailable");
        setLookupMessage(parsed.message || "El emparejamiento está deshabilitado.");
      } else {
        setLookupState("not_found");
        setLookupMessage(
          "No encontramos ese código. Solicita un código nuevo en el equipo y vuelve a intentarlo.",
        );
      }
    }
  }

  const selectableGateways = gateways.filter(
    (gateway) => gateway.status === "pending_activation" || gateway.status === "active",
  );
  const selectedGateway = selectableGateways.find((g) => String(g.id) === gatewayId) ?? null;

  useEffect(() => {
    if (!selectedGateway || selectedGateway.status !== "active") {
      setSelectedStatus(null);
      return;
    }
    let cancelled = false;
    getPropertyGatewayStatus(selectedGateway.property_id)
      .then(({ data }) => {
        if (!cancelled) {
          setSelectedStatus(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGateway]);

  const expiresAt = session ? parseBackendTimestamp(session.expires_at) : null;
  const remainingMs = expiresAt ? expiresAt.getTime() - nowMs : 0;
  const expired = Boolean(session) && remainingMs <= 0;
  const canApprove = Boolean(session && selectedGateway && confirmed && !expired && !submitting);

  const handleLookupSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runLookup(codeInput);
  };

  const handleApprove = async () => {
    if (!session || !selectedGateway || !confirmed) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await approvePairing(session.session_id, {
        user_code: session.user_code,
        gateway_id: selectedGateway.id,
        confirm: true,
        replace_credential: selectedGateway.status === "active",
      });
      setOutcome({
        kind: "approved",
        message: `${selectedGateway.property_name} vinculado. El equipo termina de conectarse en unos segundos.`,
      });
      setSession(null);
      showToast("Equipo vinculado", "success");
      onApproved?.(data);
    } catch (error) {
      const parsed = pairingError(error);
      setFormError(parsed.message);
      showToast(parsed.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!session) {
      return;
    }
    setDenyOpen(false);
    setSubmitting(true);
    setFormError(null);
    try {
      await denyPairing(session.session_id, session.user_code);
      setOutcome({
        kind: "denied",
        message: "Rechazaste la solicitud. El equipo no recibirá ninguna credencial.",
      });
      setSession(null);
      showToast("Emparejamiento rechazado", "info");
    } catch (error) {
      const parsed = pairingError(error);
      setFormError(parsed.message);
      showToast(parsed.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const lookupDisabled = lookupState === "locked" || lookupState === "loading";

  const SectionHeading = embedded ? "h3" : "h2";

  return (
    <>
      <form className="flex flex-wrap items-end gap-3" onSubmit={handleLookupSubmit}>
        <div className="flex flex-col gap-1">
          <label htmlFor="pairing-code" className="text-sm font-medium">
            Código del equipo
          </label>
          <input
            id="pairing-code"
            className="w-full max-w-[16rem] rounded-xl border px-4 py-3 font-mono text-2xl uppercase tracking-[0.2em]"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder="BCDF-GHJK"
            autoComplete="off"
            spellCheck={false}
            disabled={lookupDisabled}
          />
        </div>
        <PillButton type="submit" loading={lookupState === "loading"} disabled={lookupDisabled}>
          Buscar código
        </PillButton>
      </form>
      {formError && (
        <p role="alert" className="mt-3 text-sm text-[var(--status-danger-text)]">
          {formError}
        </p>
      )}

      {lookupState === "not_found" && (
        <BentoCard>
          <p role="alert" data-testid="pairing-not-found" className="text-[var(--text-body)]">
            {lookupMessage}
          </p>
        </BentoCard>
      )}

      {lookupState === "locked" && (
        <BentoCard>
          <p role="alert" data-testid="pairing-locked" className="text-[var(--status-danger-text)]">
            {lookupMessage}
          </p>
        </BentoCard>
      )}

      {lookupState === "unavailable" && (
        <BentoCard>
          <p role="alert" className="text-[var(--status-danger-text)]">
            {lookupMessage}
          </p>
        </BentoCard>
      )}

      {session && !outcome && (
        <BentoCard className={embedded ? "mt-4" : ""}>
          <section aria-labelledby="pairing-session-title">
            <SectionHeading id="pairing-session-title" className="text-lg font-semibold">
              {embedded ? "Código encontrado" : "Solicitud de emparejamiento"}
            </SectionHeading>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--text-muted)]">Código</dt>
                <dd className="font-mono text-lg font-semibold tracking-widest">
                  {session.user_code}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Tiempo restante</dt>
                <dd data-testid="pairing-remaining">
                  {expired ? "Caducado" : `${formatRemaining(remainingMs)} min`}
                </dd>
              </div>
              {!embedded && (
                <>
                  <div>
                    <dt className="text-[var(--text-muted)]">Solicitado</dt>
                    <dd>{new Date(session.requested_at).toLocaleString("es-MX")}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Red de origen</dt>
                    <dd>{session.source_network ?? "No disponible"}</dd>
                  </div>
                </>
              )}
            </dl>
            <details className="mt-3 text-sm" open={!embedded}>
              <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[var(--text-muted)]">
                Datos reportados por el equipo
              </summary>
              <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--text-muted)]">Hostname</dt>
                  <dd>{session.device.hostname ?? "No reportado"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Modelo</dt>
                  <dd>{session.device.model ?? "No reportado"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Versión del agente</dt>
                  <dd>{session.device.agent_version ?? "No reportada"}</dd>
                </div>
              </dl>
            </details>
          </section>

          {!embedded && (
            <div className="mt-6 flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Rancho a vincular</h2>
              <label htmlFor="pairing-gateway" className="mt-2 text-sm font-medium">
                Rancho
              </label>
              <select
                id="pairing-gateway"
                className="max-w-md rounded-xl border px-3 py-2"
                value={gatewayId}
                onChange={(event) => setGatewayId(event.target.value)}
              >
                <option value="">Selecciona un rancho</option>
                {selectableGateways.map((gateway) => (
                  <option key={gateway.id} value={gateway.id}>
                    {gatewayRanchLabel(gateway)} ·{" "}
                    {STATUS_LABELS[gateway.status] ?? gateway.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGateway?.status === "active" && (
            <p
              data-testid="replace-credential-warning"
              className="mt-3 rounded-xl border border-[var(--status-warning,#B45309)] p-3 text-sm text-[var(--text-body)]"
            >
              Este rancho ya tiene un equipo vinculado. Al aprobar, este equipo lo reemplaza
              y el anterior deja de enviar datos; las áreas de riego y sus nodos se
              conservan.
              {selectedStatus?.last_heartbeat_at && (
                <> Última señal del equipo anterior: {new Date(selectedStatus.last_heartbeat_at).toLocaleString("es-MX")}.</>
              )}
            </p>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Confirmo que este código aparece en la pantalla del equipo que estoy
              instalando.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <PillButton
              type="button"
              onClick={() => void handleApprove()}
              disabled={!canApprove}
              loading={submitting}
            >
              {embedded ? "Aprobar código" : "Aprobar emparejamiento"}
            </PillButton>
            <PillButton
              type="button"
              variant="outline"
              onClick={() => setDenyOpen(true)}
              disabled={submitting}
            >
              Rechazar
            </PillButton>
          </div>
          {expired && (
            <p className="mt-3 text-sm text-[var(--status-danger-text)]">
              El código caducó. Solicita uno nuevo en el equipo.
            </p>
          )}
        </BentoCard>
      )}

      {outcome && !(embedded && outcome.kind === "approved") && (
        <BentoCard className={embedded ? "mt-4" : ""}>
          <p role="status" data-testid="pairing-outcome" className="text-[var(--text-body)]">
            {outcome.message}
          </p>
          {!embedded && (
            <div className="mt-4">
              <PillButton type="button" variant="secondary" onClick={() => navigate("/admin/gateways")}>
                Volver a Equipos
              </PillButton>
            </div>
          )}
        </BentoCard>
      )}

      <ConfirmDialog
        open={denyOpen}
        title="¿Rechazar la solicitud?"
        description="El equipo no recibirá ninguna credencial y deberá pedir un código nuevo."
        confirmLabel="Rechazar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void handleDeny()}
        onCancel={() => setDenyOpen(false)}
      />
    </>
  );
}
