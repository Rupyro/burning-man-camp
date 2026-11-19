import { describe, expect, it } from "vitest";
import { driverRoster } from "../rules/mv";

describe("driver roster", () => {
  it("puts cleared drivers first, then by name, and counts them", () => {
    const r = driverRoster([
      { name: "Bo", cleared: false },
      { name: "Cy", cleared: true },
      { name: "Al", cleared: false },
      { name: "Di", cleared: true },
    ]);
    expect(r.sorted.map((d) => d.name)).toEqual(["Cy", "Di", "Al", "Bo"]);
    expect(r.cleared).toBe(2);
  });
});
