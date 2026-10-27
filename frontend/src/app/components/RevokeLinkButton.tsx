import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { PillButton } from "./PillButton";
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
}

/** «Revocar enlace» con confirmación; no se muestra para un enlace ya revocado. */
export function RevokeLinkButton({ gateway, onRevoked }: RevokeLinkButtonProps) {
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
      <PillButton type="button" variant="outline" loading={revoking} onClick={() => setOpen(true)}>
        Revocar enlace
      </PillButton>
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
