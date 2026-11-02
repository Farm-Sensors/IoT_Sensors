import { describe, expect, it } from "vitest";
import { applyOrder, moveBy, moveTo } from "./order";

const ids = (list: Array<{ id: number }>) => list.map((i) => i.id);
const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

describe("orden de Mis predios", () => {
  it("aplica el orden guardado, deja lo nuevo al final e ignora lo que ya no existe", () => {
    expect(ids(applyOrder(items, [3, 1, 99], (i) => i.id))).toEqual([3, 1, 2, 4]);
    expect(ids(applyOrder(items, undefined, (i) => i.id))).toEqual([1, 2, 3, 4]);
    expect(ids(applyOrder(items, [], (i) => i.id))).toEqual([1, 2, 3, 4]);
  });

  it("mueve una posición sin salirse de los extremos", () => {
    expect(moveBy([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveBy([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(moveBy([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
  });

  it("al soltar, el elemento ocupa el lugar del destino", () => {
    expect(moveTo([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
    expect(moveTo([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
    expect(moveTo([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
  });
});
