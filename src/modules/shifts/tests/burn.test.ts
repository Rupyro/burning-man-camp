// The lead toolset in the Burn pack: shift gaps and handovers (Burn Mode, Oct 28 2026).
import { describe, expect, it } from "vitest";
import { handovers, shiftGaps } from "../rules/burn";

const at = (d: number, h: number) => new Date(Date.UTC(2027, 3, d, h));
const slot = (id: string, d: number, h: number, len: number, cat: string, min = 2, live = 2) => ({
  id,
  startsAt: at(d, h),
  endsAt: at(d, h + len),
  dutyName: id,
  category: cat,
  minStaff: min,
  liveCount: live,
});
const now = at(26, 6);

describe("shiftGaps", () => {
  it("lists upcoming shifts short of their minimum, soonest first, with how many short", () => {
    const slots = [
      slot("past", 25, 8, 2, "kitchen", 3, 0),
      slot("later", 27, 8, 2, "kitchen", 3, 1),
      slot("full", 26, 8, 2, "kitchen", 2, 2),
      slot("soon", 26, 9, 2, "moop", 2, 1),
    ];
    expect(shiftGaps(slots, now).map((g) => [g.id, g.short])).toEqual([
      ["soon", 1],
      ["later", 2],
    ]);
  });
});

describe("handovers", () => {
  it("pairs a shift with the next one in the same area within 12 hours", () => {
    const slots = [
      slot("dinner", 26, 16, 3, "kitchen"),
      slot("breakfast", 27, 6, 3, "kitchen"),
      slot("moop", 26, 19, 2, "moop"),
      slot("late", 28, 16, 3, "kitchen"),
    ];
    expect(handovers(slots, now).map((h) => `${h.from.id}>${h.to.id}`)).toEqual([
      "dinner>breakfast",
    ]);
  });
  it("skips shifts that are already over", () => {
    expect(handovers([slot("a", 25, 8, 2, "k"), slot("b", 25, 12, 2, "k")], now)).toEqual([]);
  });
});
