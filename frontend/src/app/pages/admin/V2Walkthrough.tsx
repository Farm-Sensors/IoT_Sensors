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
} from "../../services/gateways";
import { getErrorMessage } from "../../utils/errors";

const STEPS = [
  {
    title: "1. Un predio, una Raspberry",
    body: "El admin prepara cliente, predio, área y nodo lógico. El gateway es la Raspberry del predio, no el nodo.",
  },
  {
    title: "2. QR de activación",
    body: "El QR solo lleva una referencia opaca de un solo uso, 24 horas. No lleva la credencial. La credencial se entrega una vez al activar y no se vuelve a mostrar.",
  },
  {
    title: "3. El técnico elige el slot",
    body: "Eso ocurre en la pantalla de Agro, en campo. El UID del sensor no asigna el área. El mismo gateway confirma.",
  },
  {
    title: "4. La nube publica la config",
    body: "Agro hace polling. Si no cambió, responde 304. Si la nube cae, Agro sigue con la última config válida.",
  },
  {
    title: "5. Las lecturas ya no usan key de nodo",
    body: "Cada POST lleva la credencial del gateway, el id del nodo lógico y un event id. El mismo envío se acepta. El mismo id con otro cuerpo se rechaza.",
  },
  {
    title: "6. Heartbeat no es frescura",
    body: "El gateway avisa cada 5 minutos si está en línea. La frescura es la hora de la última lectura del nodo. Un nodo puede tener dato reciente y el gateway estar desconectado, o al revés.",
  },
  {
    title: "7. NDVI va aparte",
    body: "No es un campo 13 de la lectura. Es el último punto Sentinel-2, en su propio evento. Polígono e historial no están en esta versión.",
  },
];

export function V2Walkthrough() {
  const { showToast } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ gatewayId: number; expiresAt: string; image: string } | null>(null);
  const [issuing, setIssuing] = useState<number | null>(null);

  useEffect(() => {
    listGateways()
      .then((res) => setGateways(res.data))
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los gateways")))
      .finally(() => setLoading(false));
  }, []);

  const showQr = async (gatewayId: number) => {
    try {
      setIssuing(gatewayId);
      const res = await issueActivationReference(gatewayId);
      const image = await QRCode.toDataURL(res.data.activation_reference, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
      });
      setQr({ gatewayId, expiresAt: res.data.expires_at, image });
      showToast("QR listo. Generar otro invalida este.", "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Este gateway ya no está pendiente de activación"), "error");
    } finally {
      setIssuing(null);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Recorrido v2</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
            Esto es lo que se puede enseñar de la integración. El dashboard del cliente sigue mostrando lecturas.
            El cambio está en quién envía, cómo se activa la Raspberry y qué no entra en la telemetría.
          </p>
        </div>

        {error && <p className="text-[var(--status-danger)]">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {STEPS.map((step) => (
            <BentoCard key={step.title}>
              <h2 className="text-lg font-medium">{step.title}</h2>
              <p className="mt-2 text-[var(--text-body)]">{step.body}</p>
            </BentoCard>
          ))}
        </div>

        <BentoCard>
          <h2 className="text-lg font-medium">Gateways de esta prueba</h2>
          {loading ? (
            <p className="mt-3">Cargando...</p>
          ) : (
            <div className="mt-4 space-y-4">
              {gateways.map((gateway) => (
                <div key={gateway.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 first:border-t-0 first:pt-0">
                  <div>
                    <p>Gateway #{gateway.id} · Predio {gateway.property_id}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Config v{gateway.configuration_version} · {gateway.slots.length} slot(s) · {gateway.status}
                    </p>
                    <div className="mt-2">
                      <GatewayStatusBadge status={gateway.status} />
                    </div>
                  </div>
                  {gateway.status === "pending_activation" && (
                    <PillButton type="button" loading={issuing === gateway.id} onClick={() => void showQr(gateway.id)}>
                      Generar QR
                    </PillButton>
                  )}
                </div>
              ))}
            </div>
          )}
          {qr && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <img src={qr.image} alt={`QR de activación del gateway ${qr.gatewayId}`} width={220} height={220} />
              <div className="max-w-md text-sm text-[var(--text-body)]">
                <p>QR del gateway #{qr.gatewayId}. Caduca {new Date(qr.expiresAt).toLocaleString("es-MX")}.</p>
                <p className="mt-2">No contiene la credencial. En campo, Agro lo consume y recibe la credencial una sola vez. Si generas otro, este deja de servir.</p>
              </div>
            </div>
          )}
        </BentoCard>

        <BentoCard>
          <h2 className="text-lg font-medium">Dónde ver cada pieza</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-body)]">
            <li>Cliente demo: dashboard, frescura del nodo y pastilla del gateway. Abajo, NDVI puntual. No es un campo de la lectura.</li>
            <li>Esta página: el relato y el QR real de un predio que todavía no se activa.</li>
            <li>Gateways: provisionar y publicar config.</li>
            <li>La pantalla del técnico, el LoRa y la cola offline viven en Agro, no aquí.</li>
          </ul>
        </BentoCard>
      </div>
    </PageTransition>
  );
}
