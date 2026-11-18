import { describe, expect, it } from "vitest";
import config from "../../camp.config";
import { campConfigProblems } from "./camp-config";
import { CAMP_START_YEAR } from "./family-years";

describe("camp.config.ts", () => {
  it("is valid", () => expect(campConfigProblems(config)).toEqual([]));

  it("matches today's hard-coded Oe-aa-sies values", () => {
    expect(config.joining.familyYears.since).toBe(CAMP_START_YEAR);
    expect(config.camp.name).toBe("Oe-aa-sies");
    expect(config.camp.slug).toBe("oeaasies");
    expect(config.money.currency).toBe("ZAR");
    expect(config.owners.campKey).toBe("oeaasies");
    expect(config.owners.labels).toEqual({
      oeaasies: "Ours",
      khoena: "Khoena's",
      shared: "Shared",
      borrowed: "Borrowed",
      rented: "Rented",
    });
  });

  it("flags bad values", () => {
    const bad = {
      ...config,
      camp: { ...config.camp, name: " ", slug: "Oe-aa", packs: ["core", "core"] as const },
      money: { ...config.money, currency: "rand" },
      joining: { familyYears: { enabled: true, since: 23 } },
    };
    expect(campConfigProblems(bad)).toHaveLength(5);
  });
});
