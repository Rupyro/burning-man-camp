import { describe, expect, it } from "vitest";
import { keywordSearch } from "@/lib/keyword-search";
import { GUIDE_ENTRIES } from "./guide-content";

const ask = (q: string) => keywordSearch(GUIDE_ENTRIES, q).map((e) => e.topic);

describe("Ask the guide content", () => {
  it("answers what to bring, rules, food and fees", () => {
    expect(ask("what to bring water")).toContain("What to bring");
    expect(ask("rules quiet hours")).toContain("Camp rules");
    expect(ask("food")).toContain("Food");
    expect(ask("how much is the camp fee")).toContain("Fees");
  });
  it("marks unconfirmed fee details as TBC", () => {
    const fees = GUIDE_ENTRIES.filter((e) => e.topic === "Fees");
    expect(fees.length).toBeGreaterThan(0);
    expect(fees.every((e) => e.text.includes("TBC"))).toBe(true);
  });
  it("gives every entry a unique id", () => {
    const ids = GUIDE_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
