import { Info } from "lucide-react";
import { useLocation } from "react-router";
import { useModuleStatus } from "../../hooks/useModules";
import { moduleForPath } from "./items";

export const MODULE_OFF_TEXT = "Esta función está desactivada por ahora. Puedes ver la pantalla, pero todavía no genera avisos ni respuestas.";

/** Aviso al inicio de las pantallas de Fase 2 cuyo módulo está apagado (se muestra solo cuando ya se sabe). */
export function ModuleOffNotice() {
  const { pathname } = useLocation();
  const modules = useModuleStatus();
  const module = moduleForPath(pathname);
  if (!module || !modules || modules[module]) return null;
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-4 md:px-8">
      <p role="status" className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--status-info-bg)] px-3 py-2 text-sm text-[var(--text-main)]">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-info)]" />
        <span><span className="font-semibold">Función desactivada.</span> {MODULE_OFF_TEXT}</span>
      </p>
    </div>
  );
}
