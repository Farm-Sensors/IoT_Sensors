import { useSearchParams } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { PairingApprovalPanel } from "../../components/PairingApprovalPanel";

export function PairDevice() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Verificar emparejamiento"
          subtitle="Escribe el código que muestra la pantalla del equipo que estás instalando. Aprueba la solicitud solo si el código coincide."
        />
        <PairingApprovalPanel initialCode={initialCode} />
      </div>
    </PageTransition>
  );
}
