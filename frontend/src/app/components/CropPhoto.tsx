import { Leaf } from "lucide-react";
import { useState } from "react";
import { cropIcons } from "./icons/CropIcons";

const normalize = (name: string) => name.trim().toLowerCase();

/** Foto elegida del cultivo o, si no tiene (o no carga), su ícono de siempre. */
export function CropPhoto({ name, url, credit, size = 64 }: { name: string; url?: string | null; credit?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const Icon = cropIcons[normalize(name)] || Leaf;
  const box = { width: size, height: size };
  if (url && !failed) {
    return (
      <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}
        title={credit ? `${credit} · Wikimedia Commons` : undefined}
        style={box} className="flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] object-cover" />
    );
  }
  return (
    <span style={box} className="flex flex-shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-sand)]">
      <Icon aria-hidden="true" className="h-6 w-6 text-[var(--accent-primary)]" />
    </span>
  );
}
