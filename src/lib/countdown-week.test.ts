import { describe, expect, it } from "vitest";
import { countdownNote, thisWeek } from "./countdown-week";

describe("countdown: what to do this week", () => {
  it("suggests early jobs months out, packing close to build, and arrival in the last days", () => {
    expect(thisWeek(170).map((t) => t.key)).toEqual(["fee", "ride", "bring"]);
    expect(thisWeek(20).map((t) => t.key)).toEqual(["bring", "ride", "shifts"]);
    expect(thisWeek(3).map((t) => t.key)).toEqual(["bring", "water", "arrive"]);
    expect(thisWeek(-2).map((t) => t.key)).toEqual(["arrive"]);
    expect(thisWeek(null).map((t) => t.key)).toEqual(["fee", "ride", "bring"]);
    for (const t of thisWeek(170)) expect(t.href).toMatch(/^\//);
    expect(thisWeek(170).find((t) => t.key === "ride")?.href).toBe("/logistics/rides");
  });
  it("labels unconfirmed dates as dates to confirm for the year", () => {
    expect(countdownNote(false, 2027)).toBe("Dates to confirm for 2027");
    expect(countdownNote(true, 2027)).toBeNull();
  });
});
