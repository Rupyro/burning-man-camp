import { describe, expect, it } from "vitest";
import { fuelTotal, stakesLeft } from "../rules/registers";

const line = (kind: "fuel" | "flame" | "stake", quantity: number, pulled = 0) => ({
  kind,
  label: `${kind} ${quantity}`,
  quantity,
  pulled,
});

describe("register rules", () => {
  it("adds stored fuel and flags it over the limit", () => {
    const rows = [line("fuel", 60), line("fuel", 55), line("flame", 2)];
    expect(fuelTotal(rows, 110)).toEqual({ total: 115, overLimit: true });
    expect(fuelTotal(rows)).toEqual({ total: 115, overLimit: false });
    expect(fuelTotal([line("fuel", 110)], 110).overLimit).toBe(false);
  });
  it("counts stakes still in the ground", () => {
    const left = stakesLeft([line("stake", 48, 40), line("stake", 12, 12), line("fuel", 5)]);
    expect(left.left).toBe(8);
    expect(left.lines).toEqual([
      { label: "stake 48", left: 8 },
      { label: "stake 12", left: 0 },
    ]);
  });
});
