import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "bg-[var(--status-success-solid)] text-white",
  error:   "bg-[var(--status-danger-solid)] text-white",
  info:    "bg-[var(--bg-elevated)] text-[var(--text-main)] border border-[var(--border-strong)]",
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const Icon = ICONS[item.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-[20px] shadow-lg max-w-sm pointer-events-auto
        ${item.exiting ? "toast-exit" : "toast-enter"}
        ${STYLES[item.type]}`}
      role="status"
      aria-live="polite"
    >
      <Icon aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Cerrar notificación"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    // Mark as exiting for exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Remove after animation duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 4s
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — bottom-right on desktop, top on mobile */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none
          max-md:bottom-24 max-md:right-4 max-md:left-4 max-md:items-stretch"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
