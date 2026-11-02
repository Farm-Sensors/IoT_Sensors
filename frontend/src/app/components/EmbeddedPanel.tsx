import { createContext, useContext, type ReactNode } from "react";

const EmbeddedContext = createContext(false);

/** Marca que las pantallas de gestión se muestran dentro de un panel (Directorio) y no como página completa. */
export function EmbeddedPanel({ children }: { children: ReactNode }) {
  return <EmbeddedContext.Provider value={true}><div className="embedded-panel">{children}</div></EmbeddedContext.Provider>;
}

export const useEmbedded = () => useContext(EmbeddedContext);
