import { describe, expect, it } from "vitest";
import { byNeighbor, inQuietHours, isClockTime } from "../rules/sound";

describe("quiet hours", () => {
  it("reads HH:MM only", () => {
    expect(isClockTime("03:00")).toBe(true);
    expect(isClockTime("3:00")).toBe(false);
    expect(isClockTime("24:00")).toBe(false);
  });
  it("handles a window across midnight and one inside a day", () => {
    expect(inQuietHours("01:00", "23:00", "08:00")).toBe(true);
    expect(inQuietHours("12:00", "23:00", "08:00")).toBe(false);
    expect(inQuietHours("08:00", "23:00", "08:00")).toBe(false);
    expect(inQuietHours("04:00", "03:00", "10:00")).toBe(true);
    expect(inQuietHours("10:00", "03:00", "10:00")).toBe(false);
    expect(inQuietHours("04:00", "03:00", "03:00")).toBe(false);
  });
});

describe("neighbor summary", () => {
  it("counts visits per neighbor, most first", () => {
    const at = new Date();
    expect(
      byNeighbor([
        { neighbor: "B camp", at },
        { neighbor: "A camp ", at },
        { neighbor: "B camp", at },
      ]),
    ).toEqual([
      { neighbor: "B camp", count: 2 },
      { neighbor: "A camp", count: 1 },
    ]);
  });
});
