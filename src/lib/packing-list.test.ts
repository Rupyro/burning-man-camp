import { describe, expect, it } from "vitest";
import {
  CAMP_PROVIDES,
  isPackingKey,
  PACKING_LIST,
  PACKING_TOTAL,
  PLEASE_DONT_BRING,
  packedCount,
} from "./packing";

describe("what to bring vs what the camp provides", () => {
  it("has the 2026 packing list in sections, Priority first, with unique keys", () => {
    expect(PACKING_LIST[0]?.title).toBe("Priority");
    const keys = PACKING_LIST.flatMap((s) => s.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(PACKING_TOTAL).toBe(keys.length);
    expect(PACKING_TOTAL).toBeGreaterThan(50);
    expect(keys).toContain("drinking-water");
  });
  it("lists what the camp provides and what not to bring", () => {
    expect(CAMP_PROVIDES.join(" ")).toMatch(/2 meals a day/);
    expect(PLEASE_DONT_BRING).toContain("Camping chairs");
  });
  it("counts only real, distinct ticks", () => {
    expect(isPackingKey("drinking-water")).toBe(true);
    expect(isPackingKey("a-chair")).toBe(false);
    expect(packedCount(["drinking-water", "drinking-water", "a-chair"])).toBe(1);
  });
});
