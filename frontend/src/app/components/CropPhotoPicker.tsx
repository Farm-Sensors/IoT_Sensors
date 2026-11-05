import { Check, Search } from "lucide-react";
import { useState } from "react";
import { searchCropPhotos, suggestedQuery, type CropPhotoOption } from "../services/cropPhotos";
import { CropPhoto } from "./CropPhoto";

/** Foto elegida de un cultivo; solo se guardan su dirección y su atribución. */
export interface ChosenPhoto { url: string; credit: string; page: string }

/**
 * «Foto (opcional)» del alta y la edición de un cultivo: busca en Wikimedia Commons y muestra las primeras 6
 * opciones; se puede elegir una o dejar el cultivo sin foto (con su ícono de siempre).
 */
export function CropPhotoPicker({ cropName, value, onChange }: { cropName: string; value: ChosenPhoto | null; onChange: (photo: ChosenPhoto | null) => void }) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<CropPhotoOption[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const search = async () => {
    const query = term.trim() || suggestedQuery(cropName);
    if (!query) return;
    setState("loading");
    try {
      setOptions(await searchCropPhotos(query, 6));
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm text-[var(--text-subtle)]">Foto (opcional)</legend>
      <div className="flex items-center gap-3">
        <CropPhoto name={cropName || "cultivo"} url={value?.url} credit={value?.credit} size={56} />
        <p className="min-w-0 flex-1 text-sm text-[var(--text-muted)]">
          {value ? <span className="block truncate">{value.credit}</span> : "Sin foto: se muestra el ícono del cultivo."}
        </p>
        {value && <button type="button" onClick={() => onChange(null)} className="inline-flex min-h-[44px] items-center rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Quitar foto</button>}
      </div>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Qué buscar</span>
          <input type="text" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
            placeholder={cropName ? `Buscar fotos de ${cropName}` : "Buscar fotos del cultivo"} className="min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-panel)] px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
        </label>
        <button type="button" onClick={() => void search()} disabled={state === "loading" || (!term.trim() && !cropName.trim())} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm font-semibold hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50">
          <Search aria-hidden="true" className="h-4 w-4" />Buscar fotos
        </button>
      </div>
      {state === "loading" && <p role="status" className="text-sm text-[var(--text-muted)]">Buscando fotos…</p>}
      {state === "error" && <p role="alert" className="text-sm text-[var(--status-danger-text)]">No se pudo buscar fotos (revisa tu conexión). Puedes guardar el cultivo sin foto.</p>}
      {options && state === "idle" && (options.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No encontré fotos. Prueba con otro nombre, por ejemplo en inglés.</p>
      ) : (
        <>
          <ul aria-label="Fotos encontradas" className="grid grid-cols-3 gap-2">
            {options.map((o) => {
              const chosen = value?.url === o.url;
              return (
                <li key={o.url}>
                  <button type="button" aria-pressed={chosen} aria-label={`Elegir esta foto: ${o.title}`} title={o.credit} onClick={() => onChange({ url: o.url, credit: o.credit, page: o.pageUrl })}
                    className={`relative block w-full overflow-hidden rounded-[var(--radius)] border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${chosen ? "border-[var(--accent-primary)]" : "border-transparent hover:border-[var(--border-strong)]"}`}>
                    <img src={o.url} alt="" referrerPolicy="no-referrer" className="aspect-square w-full object-cover" />
                    {chosen && <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[var(--text-inverted)]"><Check aria-hidden="true" className="h-4 w-4" /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-[var(--text-muted)]">Fotos de Wikimedia Commons. ¿Ninguna te gusta? Quita la foto y el cultivo queda con su ícono.</p>
        </>
      ))}
    </fieldset>
  );
}
