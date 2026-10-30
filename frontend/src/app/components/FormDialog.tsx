import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XCircle } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { BentoCard } from "./BentoCard";

interface FormDialogProps {
  open: boolean;
  title: string;
  /** Se llama al cerrar con el botón, con Escape o al cancelar; no se cierra al hacer clic fuera. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Formulario en diálogo (patrón 8.5): nombre accesible, foco atrapado, Escape cierra y el foco
 * vuelve a quien lo abrió. El cuerpo es el `<form>` de la página.
 */
export function FormDialog({ open, title, onClose, children }: FormDialogProps) {
  const openerRef = useRef<HTMLElement | null>(null);
  // Se guarda antes de que el diálogo mueva el foco: Radix solo devuelve el foco a su propio Trigger.
  useLayoutEffect(() => {
    if (open) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--surface-page)]/75 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 focus:outline-none"
        >
          <BentoCard variant="light" className="max-h-[90vh] overflow-y-auto border border-[var(--border-strong)]">
            <div className="mb-6 flex items-center justify-between gap-3">
              <DialogPrimitive.Title className="text-xl font-serif text-[var(--text-title)]">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[var(--text-subtle)] transition-colors hover:bg-[var(--hover-overlay)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <XCircle aria-hidden="true" className="h-6 w-6" />
              </DialogPrimitive.Close>
            </div>
            {children}
          </BentoCard>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
