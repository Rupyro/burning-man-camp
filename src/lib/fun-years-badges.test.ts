import { describe, expect, it } from "vitest";
import { BADGES, badgeRow, dropSlotX, earnedBadges, ROW_MAX } from "./fun-extras";

describe("years badges", () => {
  it("lights 2 years, 3 years and Founding family from confirmed camp years", () => {
    expect(earnedBadges({ done: 0, shifts: 0, thanks: 0 })).toEqual([]);
    expect(earnedBadges({ done: 0, shifts: 0, thanks: 0, years: 3 })).toEqual([
      "years-2",
      "years-3",
    ]);
    expect(earnedBadges({ done: 0, shifts: 0, thanks: 0, years: 4 })).toContain("founding-family");
  });
});

describe("badge row overflow", () => {
  it("keeps the row to a few slots and counts the rest behind +N", () => {
    expect(BADGES.length).toBeGreaterThan(ROW_MAX);
    const row = badgeRow([], null);
    expect(row.ids.length).toBe(ROW_MAX - 1);
    expect(row.more).toBe(BADGES.length - (ROW_MAX - 1));
  });
  it("shows earned badges first in the row, in their usual order", () => {
    const row = badgeRow(["years-3", "tasks-10", "years-2"], null);
    expect(row.ids.slice(0, 3)).toEqual(["tasks-10", "years-2", "years-3"]);
  });
  it("always has a slot for the badge that's dropping in", () => {
    const earned = BADGES.map((b) => b.id).slice(0, ROW_MAX);
    const row = badgeRow(earned, "founding-family");
    expect(row.ids).toContain("founding-family");
    expect(row.ids.length).toBe(ROW_MAX - 1);
  });
  it("lands the drop in its own slot in the row it sees, counting the +N slot", () => {
    const row = { ids: ["a", "b", "c"], more: 2 };
    expect(dropSlotX("a", row)).toBe("-39px");
    expect(dropSlotX("c", row)).toBe("13px");
    expect(dropSlotX("zz", row)).toBe("0px");
    expect(dropSlotX("b", { ids: ["a", "b", "c"], more: 0 })).toBe("0px");
  });
});
