import { describe, expect, it } from "vitest";
import config from "../../camp.config";
import { campConfigProblems } from "./camp-config";
import { CAMP_START_YEAR } from "./family-years";

describe("camp.config.ts", () => {
  it("is valid", () => expect(campConfigProblems(config)).toEqual([]));

  it("ships the neutral Burning Man starter values", () => {
    expect(config.joining.familyYears.since).toBe(CAMP_START_YEAR);
    expect(config.camp.name).toBe("Your Camp");
    expect(config.camp.slug).toBe("yourcamp");
    expect(config.money.currency).toBe("USD");
    expect(config.event.pack).toBe("burning-man");
    expect(config.owners.campKey).toBe("ours");
    expect(config.owners.labels).toEqual({ ours: "Ours", borrowed: "Borrowed", rented: "Rented" });
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

  it("ships the placeholder sweep-crew rule and checks its numbers", () => {
    expect(config.exodus.sweepCrew).toEqual({ min: 2, perCampers: 10 });
    const bad = { ...config, exodus: { sweepCrew: { min: -1, perCampers: 0 } } };
    expect(campConfigProblems(bad)).toEqual([
      "exodus.sweepCrew.min must be a whole number, 0 or more",
      "exodus.sweepCrew.perCampers must be a whole number, 1 or more",
    ]);
  });

  it("only knows the neutral gear owners", () => {
    const old = { ...config, owners: { ...config.owners, campKey: "oeaasies" as "ours" } };
    expect(campConfigProblems(old)).toEqual([
      "owners.campKey must be one of the database keys (ours, borrowed, rented)",
    ]);
  });
});
