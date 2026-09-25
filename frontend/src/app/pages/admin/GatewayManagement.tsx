import { useEffect, useState } from "react";
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
    const res = await issueActivationReference(gatewayId);
    setOneTimeSecret(res.data.activation_reference);
    showToast("Referencia de activación lista. Cópiala ahora; no se vuelve a mostrar.", "success");
  };

  const handlePublish = async (gatewayId: number) => {
    await publishConfiguration(gatewayId);
    showToast("Configuración publicada", "success");
    await load();
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Gateways</h1>
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
          <p data-testid="one-time-secret">Referencia: {oneTimeSecret}</p>
        )}
        {loading ? (
          <p>Cargando...</p>
        ) : (
          gateways.map((gateway) => (
            <BentoCard key={gateway.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p>Gateway #{gateway.id} · Predio {gateway.property_id}</p>
                  <GatewayStatusBadge status={gateway.status} />
                </div>
                <div className="flex gap-2">
                  <PillButton type="button" onClick={() => void handleReference(gateway.id)}>
                    Activación
                  </PillButton>
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
