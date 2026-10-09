import { useSearchParams } from "react-router";
import { PageTransition } from "../../components/PageTransition";
import { PairingApprovalPanel } from "../../components/PairingApprovalPanel";

export function PairDevice() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Verificar emparejamiento</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
            Escribe el código que muestra el dispositivo que estás instalando. Aprueba la
            solicitud solo si el código coincide con la pantalla del equipo.
          </p>
        </div>
        <PairingApprovalPanel initialCode={initialCode} />
      </div>
    </PageTransition>
  );
}
