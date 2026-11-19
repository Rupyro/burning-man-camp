import { describe, expect, it } from "vitest";
import { fuelPlan, readAmount } from "./fuel-plan";

const base = {
  generators: 2,
  hoursPerDay: 10,
  perHour: 0.3,
  days: 9,
  unit: "gal" as const,
  spare: 0.1,
  maxFill: 0.8,
};

describe("fuelPlan", () => {
  it("adds the burn and spare, and packs 5-gallon cans filled to 80%", () => {
    const p = fuelPlan(base, 110);
    expect(p.burn).toBe(54);
    expect(p.spare).toBe(5.4);
    expect(p.total).toBe(59.4);
    expect(p.can).toEqual({ size: 5, holds: 4, count: 15, label: "5-gallon cans" });
    expect(p.overLimit).toBe(false);
  });

  it("flags more than the storage limit, and never without one", () => {
    const big = { ...base, generators: 4 };
    expect(fuelPlan(big, 110).overLimit).toBe(true);
    expect(fuelPlan(big).overLimit).toBe(false);
  });

  it("uses 20 L jerry cans for litres", () => {
    const p = fuelPlan({ ...base, unit: "L", perHour: 1, spare: 0 });
    expect(p.total).toBe(180);
    expect(p.can).toEqual({ size: 20, holds: 16, count: 12, label: "20 L jerry cans" });
  });

  it("needs no cans for no generators", () => {
    expect(fuelPlan({ ...base, generators: 0 }).can.count).toBe(0);
  });
});

describe("readAmount", () => {
  it("keeps two decimals and clamps", () => {
    expect(readAmount("0.333", 1, 50)).toBe(0.33);
    expect(readAmount("99", 1, 50)).toBe(50);
    expect(readAmount("-1", 1, 50)).toBe(0);
  });
  it("uses the fallback for missing or junk", () => {
    expect(readAmount(undefined, 0.3, 50)).toBe(0.3);
    expect(readAmount("x", 0.3, 50)).toBe(0.3);
  });
});
