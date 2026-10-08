import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BentoCard } from "../../components/BentoCard";
import { GatewayStatusBadge } from "../../components/GatewayStatusBadge";
import { PageTransition } from "../../components/PageTransition";
import { PillButton } from "../../components/PillButton";
import { useToast } from "../../components/Toast";
import {
  Gateway,
  issueActivationReference,
  listGateways,
  provisionGateway,
  publishConfiguration,
} from "../../services/gateways";
import { getErrorMessage } from "../../utils/errors";

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
  const [propertyId, setPropertyId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<{ gatewayId: number; expiresAt: string; image: string } | null>(null);
  const [issuing, setIssuing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await listGateways();
      setGateways(res.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar los gateways"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // The reference is per-visit: dropping it when the page unmounts keeps it from lingering.
  useEffect(() => () => {
    setOneTimeSecret(null);
    setQr(null);
  }, []);

  const handleProvision = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const created = await provisionGateway(Number(propertyId), Number(areaId));
      showToast("Gateway provisionado", "success");
      setPropertyId("");
      setAreaId("");
      setError(null);
      setGateways((current) => [...current, created.data]);
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo provisionar el gateway");
      setError(message);
      showToast(message, "error");
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
      showToast("QR listo. Generar otro invalida este.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Este gateway ya no está pendiente de activación"), "error");
    } finally {
      setIssuing(null);
    }
  };

  const handlePublish = async (gatewayId: number) => {
    try {
      await publishConfiguration(gatewayId);
      showToast("Configuración publicada", "success");
      setError(null);
      await load();
    } catch (err) {
      const message = getErrorMessage(err, "No se pudo publicar la configuración");
      setError(message);
      showToast(message, "error");
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Gateways</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
            Un gateway por predio. El QR solo lleva la referencia de activación, nunca la credencial.
            La Raspberry confirma el slot en Agro. Aquí se publica la config y se ve si el gateway está en línea.
          </p>
        </div>
        <BentoCard>
          <section aria-labelledby="gateway-communication-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Flujo v2 de comunicación</p>
                <h2 id="gateway-communication-title" className="mt-1 text-lg font-semibold">
                  IoT_Sensors ↔ Agro.io
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
                  Esta página administra gateways. La interfaz de campo o de la Raspberry se ejecuta fuera de esta aplicación web.
                </p>
              </div>
              <a
                className="rounded-full border px-3 py-2 text-sm font-medium hover:bg-black/5"
                href="/api/v1/docs"
                rel="noreferrer"
                target="_blank"
              >
                Documentación API/Swagger
              </a>
            </div>

            <div aria-label="Flujo de comunicación entre administrador, API y Agro" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <div className="rounded-xl border px-3 py-2">
                <p className="font-medium">Administrador</p>
                <p className="text-[var(--text-muted)]">Publica configuración</p>
              </div>
              <span aria-hidden="true" className="text-lg text-[var(--text-muted)]">→</span>
              <div className="rounded-xl border px-3 py-2">
                <p className="font-medium">API IoT_Sensors</p>
                <p className="text-[var(--text-muted)]">Configuración, estado y datos</p>
              </div>
              <span aria-hidden="true" className="text-lg text-[var(--text-muted)]">↔</span>
              <div className="rounded-xl border px-3 py-2">
                <p className="font-medium">Agro/edge</p>
                <p className="text-[var(--text-muted)]">Gateway en campo</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                <p className="font-medium">NDVI separado</p>
                <code className="mt-2 block break-all text-xs">POST /api/v1/ndvi-snapshots</code>
                <p className="mt-2 text-[var(--text-muted)]">NDVI se envía por separado; nunca forma parte de la telemetría.</p>
              </article>
            </div>
          </section>
        </BentoCard>
        {error && <p className="text-[var(--status-danger)]">{error}</p>}
        <p className="text-sm text-[var(--text-muted)]">
          Cada área necesita al menos un nodo lógico activo antes de provisionar; si no, la API rechazará la operación.
        </p>
        <form className="flex flex-wrap gap-3" onSubmit={handleProvision}>
          <input
            aria-label="ID de predio"
            className="rounded-xl border px-3 py-2"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            placeholder="Predio"
          />
          <input
            aria-label="ID de área"
            className="rounded-xl border px-3 py-2"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            placeholder="Área"
          />
          <PillButton type="submit">Provisionar</PillButton>
        </form>
        {oneTimeSecret && (
          <BentoCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">
                  Referencia de activación (de un solo uso)
                </p>
                <code
                  data-testid="one-time-secret"
                  className="mt-2 block break-all font-mono text-lg font-semibold tracking-tight"
                >
                  {oneTimeSecret}
                </code>
                {qr && (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    Caduca el {new Date(qr.expiresAt).toLocaleString("es-MX")}. Generar otra invalida esta.
                  </p>
                )}
              </div>
              <PillButton type="button" variant="outline" onClick={() => void handleCopyReference()}>
                Copiar referencia
              </PillButton>
            </div>
          </BentoCard>
        )}
        {qr && (
          <BentoCard>
            <div className="flex flex-wrap items-center gap-4">
              <img src={qr.image} alt={`QR de activación del gateway ${qr.gatewayId}`} width={220} height={220} />
              <div className="max-w-md text-sm text-[var(--text-body)]">
                <p>QR del gateway #{qr.gatewayId}. Caduca {new Date(qr.expiresAt).toLocaleString("es-MX")}.</p>
                <p className="mt-2">No contiene la credencial. Agro lo consume en campo y recibe la credencial una sola vez. Si generas otro, este deja de servir.</p>
              </div>
            </div>
          </BentoCard>
        )}
        {loading ? (
          <p>Cargando...</p>
        ) : (
          gateways.map((gateway) => (
            <BentoCard key={gateway.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p>Gateway #{gateway.id} · Predio {gateway.property_id}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Config v{gateway.configuration_version} · {gateway.slots.length} slot(s)
                  </p>
                  <div className="mt-2">
                    <GatewayStatusBadge status={gateway.status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  {gateway.status === "pending_activation" && (
                    <PillButton type="button" loading={issuing === gateway.id} onClick={() => void handleReference(gateway.id)}>
                      Activación
                    </PillButton>
                  )}
                  <PillButton type="button" onClick={() => void handlePublish(gateway.id)}>
                    Publicar config
                  </PillButton>
                </div>
              </div>
            </BentoCard>
          ))
        )}
      </div>
    </PageTransition>
  );
}
