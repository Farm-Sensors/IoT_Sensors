import { useCallback, useState } from "react";

/** Orden elegido por la persona en «Mis predios»: ids de predios y, por predio, ids de sus áreas. */
export interface SavedOrder {
  properties: number[];
  areas: Record<string, number[]>;
}

const EMPTY: SavedOrder = { properties: [], areas: {} };
const storageKey = (userKey: string) => `mis-predios-orden:${userKey}`;

/**
 * Ordena `items` según los ids guardados. Lo que no está guardado (un predio o área nuevos) va al final,
 * en su orden original; lo guardado que ya no existe se ignora.
 */
export function applyOrder<T>(items: T[], ids: number[] | undefined, idOf: (item: T) => number): T[] {
  if (!ids || ids.length === 0) return items;
  const position = new Map(ids.map((id, index) => [id, index]));
  return items
    .map((item, original) => ({ item, original }))
    .sort((a, b) => {
      const pa = position.get(idOf(a.item));
      const pb = position.get(idOf(b.item));
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return a.original - b.original;
    })
    .map(({ item }) => item);
}

/** Mueve `id` una posición (`-1` hacia el inicio, `1` hacia el final) sin salirse de la lista. */
export function moveBy(ids: number[], id: number, delta: -1 | 1): number[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Suelta `id` en el lugar de `target` (arrastrar y soltar). */
export function moveTo(ids: number[], id: number, target: number): number[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

function read(userKey: string): SavedOrder {
  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SavedOrder>;
    return {
      properties: Array.isArray(parsed.properties) ? parsed.properties.filter((n) => Number.isInteger(n)) : [],
      areas: parsed.areas && typeof parsed.areas === "object" ? parsed.areas : {},
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Orden guardado en este navegador (no viaja al servidor: no hay datos que el sistema necesite saber).
 * Si el almacenamiento no está disponible, el orden vale mientras la página esté abierta.
 */
export function useSavedOrder(userKey: string): { order: SavedOrder; save: (next: SavedOrder) => void; reset: () => void; hasCustomOrder: boolean } {
  const [order, setOrder] = useState<SavedOrder>(() => read(userKey));
  const save = useCallback(
    (next: SavedOrder) => {
      setOrder(next);
      try {
        window.localStorage.setItem(storageKey(userKey), JSON.stringify(next));
      } catch {
        /* sin almacenamiento: el orden vale solo en esta sesión */
      }
    },
    [userKey],
  );
  const reset = useCallback(() => {
    setOrder(EMPTY);
    try {
      window.localStorage.removeItem(storageKey(userKey));
    } catch {
      /* nada que borrar */
    }
  }, [userKey]);
  const hasCustomOrder = order.properties.length > 0 || Object.keys(order.areas).length > 0;
  return { order, save, reset, hasCustomOrder };
}
