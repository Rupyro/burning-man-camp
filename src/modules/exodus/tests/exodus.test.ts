import { describe, expect, it } from "vitest";
import { byDay, sweepCrew, sweepCrewWanted } from "../rules/exodus";

describe("exodus rules", () => {
  it("groups departures by day, in order", () => {
    const days = byDay([
      { name: "B", day: "2027-09-07", staysForSweep: true },
      { name: "A", day: "2027-09-06", staysForSweep: false },
      { name: "C", day: "2027-09-07", staysForSweep: false },
    ]);
    expect(days.map((d) => [d.day, d.rows.map((r) => r.name)])).toEqual([
      ["2027-09-06", ["A"]],
      ["2027-09-07", ["B", "C"]],
    ]);
  });
  it("wants one in ten for the sweep, at least two", () => {
    expect(sweepCrewWanted(5)).toBe(2);
    expect(sweepCrewWanted(70)).toBe(7);
    expect(sweepCrewWanted(71)).toBe(8);
  });
  it("counts who stays and how many are missing", () => {
    const rows = [
      { name: "A", day: "2027-09-07", staysForSweep: true },
      { name: "B", day: "2027-09-06", staysForSweep: false },
    ];
    expect(sweepCrew(rows, 20)).toEqual({ staying: ["A"], wanted: 2, short: 1 });
    const c = { name: "C", day: "2027-09-07", staysForSweep: true };
    expect(sweepCrew([...rows, c], 20).short).toBe(0);
  });
});
