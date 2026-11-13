import { describe, expect, it } from "vitest";
import { spreadOffsets } from "./mapSpread";

describe("spreadOffsets", () => {
  it("leaves a lone point where it is", () => {
    expect(spreadOffsets([[-105.47, 28.19], [-106.07, 28.63]])).toEqual([[0, 0], [0, 0]]);
  });

  it("spreads points that share coordinates so none covers another", () => {
    const offsets = spreadOffsets([[-105.47, 28.19], [-105.47, 28.19], [-105.47, 28.19], [-106.07, 28.63]]);
    expect(offsets[3]).toEqual([0, 0]);
    const shared = offsets.slice(0, 3).map(([x, y]) => `${x},${y}`);
    expect(new Set(shared).size).toBe(3);
    for (const [x, y] of offsets.slice(0, 3)) expect(Math.hypot(x, y)).toBeGreaterThan(20);
  });
});
