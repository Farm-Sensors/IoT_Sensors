/**
 * Búsqueda de fotos de un cultivo en Wikimedia Commons (API pública sin cuenta ni clave).
 * Solo se usa al agregar o editar un cultivo, para ofrecer las primeras opciones; de la foto elegida se
 * guarda únicamente su dirección y su atribución (nunca la imagen).
 */
export interface CropPhotoOption {
  /** Miniatura en el servidor de Wikimedia. */
  url: string;
  /** Página del archivo en Commons (autor y licencia). */
  pageUrl: string;
  /** «Autor · Licencia», para la atribución. */
  credit: string;
  title: string;
}

/** Búsqueda en inglés que mejor devuelve fotos reales de los cultivos iniciales; para el resto, el nombre escrito. */
const SUGGESTED: Record<string, string> = {
  nogal: "walnut tree nuts",
  alfalfa: "alfalfa field Medicago sativa",
  manzana: "red apples on tree",
  maiz: "maize field corn plants",
  chile: "green chili pepper on plant",
  algodon: "cotton plant bolls",
};

const normalize = (name: string) => name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Texto de búsqueda sugerido para un cultivo. */
export function suggestedQuery(name: string): string {
  return SUGGESTED[normalize(name)] ?? name.trim();
}

/** Las primeras 6 fotos (JPEG, de al menos 800 px, sin escaneos de libros ni grabados) para ese texto. */
export async function searchCropPhotos(term: string, limit = 6): Promise<CropPhotoOption[]> {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `${term} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "320", format: "json", origin: "*",
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Commons respondió ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data?.query?.pages ?? {}) as Array<{ index?: number; title: string; imageinfo?: Array<Record<string, any>> }>;
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0];
      if (!info || info.mime !== "image/jpeg" || info.width < 800 || !info.thumburl) return [];
      if (/\(\d{8,}\)|herbari|plate|illustration|scan/i.test(p.title)) return [];
      const meta = info.extmetadata ?? {};
      const author = stripHtml(meta.Artist?.value ?? "") || "Autor desconocido";
      const license = meta.LicenseShortName?.value ?? "Licencia libre";
      return [{ url: info.thumburl as string, pageUrl: info.descriptionurl as string, credit: `${author} · ${license}`.slice(0, 250), title: p.title.replace(/^File:/, "") }];
    })
    .slice(0, limit);
}
