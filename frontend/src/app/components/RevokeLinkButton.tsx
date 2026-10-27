import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { Gateway, gatewayRanchLabel, revokeGateway } from "../services/gateways";
import { getErrorMessage } from "../utils/errors";

export const REVOKE_LINK_DESCRIPTION =
  "El equipo dejará de poder enviar datos. Las lecturas ya recibidas se conservan. " +
  "Para volver a usar este equipo en este u otro rancho, en la pantalla del equipo toca " +
  "«Desvincular equipo» y después crea el enlace de nuevo en Equipos.";

interface RevokeLinkButtonProps {
  gateway: Gateway;
  /** Se llama tras revocar para que la vista recargue el enlace. */
  onRevoked: () => void | Promise<void>;
  /** "button": acción secundaria peligrosa (detalle); "link": enlace de texto discreto (asistente). */
  variant?: "button" | "link";
}

const VARIANT_CLASSES = {
  button:
    "rounded-full border border-[var(--status-danger-text)] px-5 py-2 text-sm hover:bg-[var(--status-danger-bg)]",
  link: "rounded text-sm underline underline-offset-4 hover:no-underline",
};

/** «Revocar enlace» con confirmación; no se muestra para un enlace ya revocado. */
export function RevokeLinkButton({ gateway, onRevoked, variant = "button" }: RevokeLinkButtonProps) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (gateway.status === "revoked") return null;

  const handleConfirm = async () => {
    setOpen(false);
    try {
      setRevoking(true);
      await revokeGateway(gateway.id);
      showToast("Enlace revocado. Las lecturas ya recibidas se conservan.", "success");
      await onRevoked();
    } catch (err) {
      showToast(getErrorMessage(err, "No se pudo revocar el enlace"), "error");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={revoking}
        aria-busy={revoking}
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 font-medium text-[var(--status-danger-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-[var(--disabled-opacity)] ${VARIANT_CLASSES[variant]}`}
      >
        {revoking && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        Revocar enlace
      </button>
      <ConfirmDialog
        open={open}
        title={`¿Revocar el enlace de ${gatewayRanchLabel(gateway)}?`}
        description={REVOKE_LINK_DESCRIPTION}
        confirmLabel="Revocar enlace"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
