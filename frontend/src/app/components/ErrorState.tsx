import { AlertTriangle } from "lucide-react";
import { PillButton } from "./PillButton";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** Error de carga con mensaje llano y «Reintentar»; se anuncia a lectores de pantalla. */
export function ErrorState({ title = "No se pudo cargar", message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--status-danger-bg)]">
        <AlertTriangle aria-hidden="true" className="h-8 w-8 text-[var(--status-danger)]" />
      </div>
      <h2 className="mb-2 text-lg font-medium text-[var(--text-main)]">{title}</h2>
      <p className="max-w-xs text-sm text-[var(--text-muted)]">{message}</p>
      {onRetry && (
        <PillButton variant="outline" className="mt-5" onClick={onRetry}>
          Reintentar
        </PillButton>
      )}
    </div>
  );
}
