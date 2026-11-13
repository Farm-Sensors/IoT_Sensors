/**
 * Pines que caen en el mismo punto (p. ej. varias áreas sin GPS ubicadas en su predio) se tapan
 * entre sí. Esto los reparte en un pequeño círculo alrededor del punto, en píxeles de pantalla,
 * para que se vean y se puedan tocar a cualquier zoom. Un pin solo en su punto no se mueve.
 */
export const SPREAD_RADIUS_PX = 26;

const key = (lng: number, lat: number) => `${lng.toFixed(5)},${lat.toFixed(5)}`;

/** Desplazamiento `[x, y]` en píxeles para cada punto, en el mismo orden que `points`. */
export function spreadOffsets(points: ReadonlyArray<[number, number]>, radius = SPREAD_RADIUS_PX): [number, number][] {
  const groups = new Map<string, number[]>();
  points.forEach(([lng, lat], index) => {
    const k = key(lng, lat);
    groups.set(k, [...(groups.get(k) ?? []), index]);
  });
  const offsets: [number, number][] = points.map(() => [0, 0]);
  groups.forEach((indexes) => {
    if (indexes.length < 2) return;
    indexes.forEach((pointIndex, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / indexes.length;
      offsets[pointIndex] = [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)];
    });
  });
  return offsets;
}
