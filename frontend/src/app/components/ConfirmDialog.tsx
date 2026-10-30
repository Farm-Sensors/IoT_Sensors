import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirmation modal — replaces window.confirm() with a polished dialog
 * that respects the design system and traps focus.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  // Focus cancel button on open (safer default) and give focus back to the opener on close
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => opener?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? "confirm-dialog-description" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--text-main)]/30 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm bg-[var(--bg-surface)] rounded-[32px] p-8 shadow-lg"
        style={{ animation: "fadeInUp 0.25s ease-out both" }}
      >
        {variant === "danger" && (
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-[var(--status-danger-bg)] flex items-center justify-center">
              <AlertTriangle aria-hidden="true" className="w-6 h-6 text-[var(--status-danger)]" />
            </div>
          </div>
        )}

        <h2
          id="confirm-dialog-title"
          className="text-lg font-serif font-medium text-[var(--text-main)] text-center mb-2"
        >
          {title}
        </h2>

        {description && (
          <p id="confirm-dialog-description" className="text-sm text-[var(--text-muted)] text-center mb-6">{description}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-full text-sm font-medium
              bg-[var(--card-sand)] text-[var(--text-main)] hover:brightness-95 active:scale-[0.97]
              transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-full text-sm font-medium
              active:scale-[0.97] transition-all
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              ${variant === "danger"
                ? "bg-[var(--status-danger-solid)] text-white hover:opacity-90 focus-visible:ring-[var(--status-danger-solid)]"
                : "bg-[var(--accent-primary)] text-[var(--text-inverted)] hover:opacity-90 focus-visible:ring-[var(--accent-primary)]"
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
