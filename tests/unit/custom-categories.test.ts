// Plan PR 11: camps can add their own gear categories (camp.config.ts custom.materialCategories).
import { describe, expect, it } from "vitest";
import config from "../../camp.config";
import { CAMP_PACKS } from "../../camp-packs";
import { categoryFrom, configFrom, renderCampConfig } from "../../scripts/lib/camp-setup";
import { type CampConfig, campConfigProblems } from "../../src/lib/camp-config";
import { mergePacks } from "../../src/lib/camp-packs";
import {
  CAMP_CATEGORIES,
  CATEGORIES,
  categoryLabel,
  isCampCategory,
  parseImport,
} from "../../src/modules/procurement/rules/csv";

const withOwn = (materialCategories: { key: string; label: string }[]): CampConfig => ({
  ...config,
  custom: { materialCategories },
});

describe("custom material categories", () => {
  it("Oe-aa-sies keeps exactly the 12 built-in categories, in the same order", () => {
    expect(CAMP_CATEGORIES).toEqual(CATEGORIES);
  });

  it("a camp's own category joins its packs' categories", () => {
    const m = mergePacks(["sound"], CAMP_PACKS, {
      materialCategories: [{ key: "bar_supplies", label: "Bar supplies" }],
    });
    expect(m.materialCategories.map((c) => c.key)).toContain("bar_supplies");
  });

  it("checks custom keys and labels in plain words", () => {
    expect(campConfigProblems(withOwn([{ key: "bar_supplies", label: "Bar supplies" }]))).toEqual(
      [],
    );
    const bad = campConfigProblems(
      withOwn([
        { key: "Bar Supplies", label: "Bar" },
        { key: "art", label: " " },
        { key: "art", label: "Art" },
      ]),
    );
    expect(bad).toHaveLength(3);
  });

  it("unknown categories are not accepted, and imports put them under Other", () => {
    expect(isCampCategory("bar_supplies")).toBe(false);
    expect(isCampCategory("sound_lighting")).toBe(true);
    const r = parseImport(
      "name,category,unit,quantity,location,condition\nIce,bar supplies,bag,3,Shed,good",
    );
    expect(r.rows[0]?.category).toBe("other");
  });

  it("labels: built-in wording, else the key in words", () => {
    expect(categoryLabel("kitchen_equipment")).toBe("Kitchen gear");
    expect(categoryLabel("bar_supplies")).toBe("Bar supplies");
  });

  it("setup turns typed names into keys and writes them to camp.config.ts", () => {
    expect(categoryFrom(" Bar supplies ")).toEqual({ key: "bar_supplies", label: "Bar supplies" });
    expect(categoryFrom("2nd-hand gear").key).toBe("c_2nd_hand_gear");
    const c = configFrom({
      name: "Dust Bunnies",
      packs: [],
      currency: "ZAR",
      symbol: "R",
      campFee: 100_000,
      familyYears: false,
      since: 2027,
      traditions: [],
      ownCategories: ["Bar supplies", " "],
    });
    expect(c.custom?.materialCategories).toEqual([{ key: "bar_supplies", label: "Bar supplies" }]);
    expect(campConfigProblems(c)).toEqual([]);
    expect(renderCampConfig(c)).toContain('{ key: "bar_supplies", label: "Bar supplies" },');
  });
});
