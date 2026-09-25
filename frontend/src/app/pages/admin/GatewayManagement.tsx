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

  const handleProvision = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await provisionGateway(Number(propertyId), Number(areaId));
    showToast("Gateway provisionado", "success");
    setPropertyId("");
    setAreaId("");
    setGateways((current) => [...current, created.data]);
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
    await publishConfiguration(gatewayId);
    showToast("Configuración publicada", "success");
    await load();
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
        {error && <p className="text-[var(--status-danger)]">{error}</p>}
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
          <p data-testid="one-time-secret" className="sr-only">Referencia: {oneTimeSecret}</p>
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
