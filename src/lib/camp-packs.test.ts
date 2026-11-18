import { describe, expect, it } from "vitest";
import config from "../../camp.config";
import { CAMP_PACKS } from "../../camp-packs";
import { type CampPack, mergePacks, resolvePackOrder } from "./camp-packs";

const reg: Record<string, CampPack> = {
  core: { key: "core", label: "Core", teams: [{ key: "kitchen", label: "Kitchen" }] },
  power: { key: "power", label: "Power", teams: [{ key: "fuel", label: "Fuel" }] },
  sound: {
    key: "sound",
    label: "Sound",
    includes: ["power"],
    teams: [
      { key: "sound", label: "Sound" },
      { key: "fuel", label: "Fuel and generators" },
    ],
  },
  mv: { key: "mv", label: "MV", includes: ["power"], teams: [{ key: "mv", label: "MV" }] },
};

describe("camp packs", () => {
  it("loads core first, includes before the pack, each once", () => {
    expect(resolvePackOrder(["sound", "mv"], reg)).toEqual(["core", "power", "sound", "mv"]);
    expect(resolvePackOrder([], reg)).toEqual(["core"]);
  });

  it("rejects unknown and self-including packs", () => {
    expect(() => resolvePackOrder(["nope"], reg)).toThrow(/Unknown/);
    expect(() =>
      resolvePackOrder(["a"], { ...reg, a: { key: "a", label: "A", includes: ["a"] } }),
    ).toThrow(/itself/);
  });

  it("merges by key, later label wins, then custom adds and removals", () => {
    const m = mergePacks(["sound", "mv"], reg, {
      teams: [{ key: "bar", label: "Bar" }],
      remove: { teams: ["kitchen"] },
    });
    expect(m.teams).toEqual([
      { key: "fuel", label: "Fuel and generators" },
      { key: "sound", label: "Sound" },
      { key: "mv", label: "MV" },
      { key: "bar", label: "Bar" },
    ]);
    expect(m.roles).toEqual([]);
  });

  it("every pack the config picks exists, and keys match", () => {
    for (const [k, p] of Object.entries(CAMP_PACKS)) expect(p.key).toBe(k);
    expect(mergePacks(config.camp.packs, CAMP_PACKS).packs).toEqual([
      "core",
      "power",
      "sound",
      "mutant-vehicle",
    ]);
  });
});
