import { describe, expect, it } from "vitest";
import { eventDays, readCount, waterPlan } from "./water-plan";

describe("waterPlan", () => {
  const base = {
    people: 10,
    days: 8,
    perPersonPerDay: 1.5,
    unit: "gal" as const,
    kitchenPerDay: 2,
    showersPerDay: 4,
    perShower: 1,
    spare: 0.1,
  };

  it("adds drinking, kitchen, showers and spare", () => {
    const p = waterPlan(base);
    expect(p.drinking).toBe(120);
    expect(p.kitchen).toBe(16);
    expect(p.showers).toBe(32);
    expect(p.spare).toBe(16.8);
    expect(p.total).toBe(184.8);
    expect(p.gray).toBe(48);
  });

  it("packs gallons into jugs and drums, rounding up", () => {
    const p = waterPlan(base);
    expect(p.small).toEqual({ size: 5, count: 37, label: "5-gallon jugs" });
    expect(p.large).toEqual({ size: 55, count: 4, label: "55-gallon drums" });
  });

  it("packs litres into jerry cans and totes", () => {
    const p = waterPlan({ ...base, unit: "L", perPersonPerDay: 5, kitchenPerDay: 0, showersPerDay: 0, spare: 0 });
    expect(p.total).toBe(400);
    expect(p.small.count).toBe(16);
    expect(p.large.count).toBe(1);
  });

  it("is zero for nobody", () => {
    const p = waterPlan({ ...base, people: 0, kitchenPerDay: 0, showersPerDay: 0 });
    expect(p.total).toBe(0);
    expect(p.small.count).toBe(0);
  });
});

describe("eventDays", () => {
  it("counts both ends", () => {
    expect(eventDays({ start: "2027-08-29", end: "2027-09-06" })).toBe(9);
  });
  it("falls back without dates", () => {
    expect(eventDays(undefined)).toBe(7);
    expect(eventDays(undefined, 3)).toBe(3);
  });
});

describe("readCount", () => {
  it("reads, rounds and clamps", () => {
    expect(readCount("12", 5, 100)).toBe(12);
    expect(readCount("2.6", 5, 100)).toBe(3);
    expect(readCount("500", 5, 100)).toBe(100);
    expect(readCount("-4", 5, 100)).toBe(0);
  });
  it("uses the fallback for missing or junk", () => {
    expect(readCount(undefined, 5, 100)).toBe(5);
    expect(readCount("", 5, 100)).toBe(5);
    expect(readCount("abc", 5, 100)).toBe(5);
  });
});
