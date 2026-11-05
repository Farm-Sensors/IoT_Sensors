import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "./ui/dialog";

const AUTO_CLOSE_MS = 4000;

/**
 * Ventana centrada que confirma que la descarga quedó lista, con una palomita animada.
 * Se cierra sola a los 4 s, con «Listo» o con Escape. Con movimiento reducido la palomita aparece ya dibujada.
 */
export function DownloadReadyDialog({ fileName, onClose }: { fileName: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!fileName) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [fileName, onClose]);

  return (
    <Dialog open={fileName !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--card)] p-8 text-center shadow-lg duration-200 focus:outline-none"
        >
          <svg aria-hidden="true" viewBox="0 0 64 64" className="download-check mx-auto h-20 w-20 text-[var(--status-success-solid)]" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <circle className="download-check-circle" cx="32" cy="32" r="27" pathLength="1" />
            <path className="download-check-mark" d="M20 33.5 28.5 42 44.5 24" pathLength="1" />
          </svg>
          <DialogPrimitive.Title className="mt-4 text-xl font-semibold">Descarga lista</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 break-words text-sm text-[var(--text-muted)]">
            {fileName}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius)] bg-[var(--accent-primary)] px-8 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
            Listo
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
