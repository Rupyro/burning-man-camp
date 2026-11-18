import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import current from "../../camp.config";
import { campConfigProblems } from "../../src/lib/camp-config";
import { configFrom, feeCents, renderCampConfig, SETUP_STEPS, slugFor } from "./camp-setup";

const OE = {
  name: "Oe-aa-sies",
  packs: ["sound", "mutant-vehicle", "power"] as const,
  currency: "zar",
  symbol: "R",
  campFee: 350_000,
  familyYears: true,
  since: 2023,
  traditions: ["rain-dance"],
};

describe("camp setup", () => {
  it("has 7 steps", () => expect(SETUP_STEPS).toHaveLength(7));

  it("Oe-aa-sies answers rebuild today's camp.config.ts exactly", () => {
    const c = configFrom({ ...OE, packs: [...OE.packs] });
    expect(c).toEqual(current);
    expect(renderCampConfig(c)).toBe(readFileSync("camp.config.ts", "utf8"));
  });

  it("a new core-only camp gets a valid config", () => {
    const c = configFrom({
      ...OE,
      name: "Dust Bunnies",
      packs: [],
      familyYears: false,
      since: 2027,
      traditions: [],
    });
    expect(campConfigProblems(c)).toEqual([]);
    expect(c.camp).toMatchObject({ slug: "dustbunnies", packs: ["core"] });
    expect(c.camp.tagline).toBe("Operations platform for the Dust Bunnies camp at AfrikaBurn");
  });

  it("reads fees and slugs", () => {
    expect(feeCents("R3,500")).toBe(350_000);
    expect(feeCents("12.5")).toBe(1_250);
    expect(feeCents("lots")).toBeNull();
    expect(slugFor("Camp Ząb 2")).toBe("campzb2");
  });
});
