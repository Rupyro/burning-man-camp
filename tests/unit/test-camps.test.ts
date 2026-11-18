// Plan PR 15: test camps. Proves the packs make sense for camps other than Oe-aa-sies, and that
// no Oe-aa-sies wording is left hard-coded in the app (it belongs in camp.config.ts and
// camp-content/). Pure: reads pack data and source files, no database.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMP_PACKS } from "../../camp-packs";
import { mergePacks } from "../../src/lib/camp-packs";

const keys = (items: { key: string }[]) => items.map((i) => i.key);
const MODULES = ["obligations", "finance", "procurement", "logistics", "applicants", "shifts"];

describe("a blank core-only camp", () => {
  const camp = mergePacks([], CAMP_PACKS);
  it("gets core only, with every module and no sound, power or vehicle parts", () => {
    expect(camp.packs).toEqual(["core"]);
    expect(keys(camp.sections)).toEqual(expect.arrayContaining(MODULES));
    expect(keys(camp.roles)).not.toContain("sound_officer");
    expect(keys(camp.roles)).not.toContain("mv_dmv_contact");
    expect(keys(camp.obligations)).not.toEqual(
      expect.arrayContaining(["sound_plan", "gas_fuel", "mv_registration"]),
    );
    expect(keys(camp.shiftTemplates).some((k) => k.startsWith("art_car"))).toBe(false);
    expect(keys(camp.materialCategories)).not.toContain("sound_lighting");
    expect(keys(camp.materialCategories)).toContain("other");
  });
  it("can drop what it doesn't need and add its own", () => {
    const c = mergePacks([], CAMP_PACKS, {
      teams: [{ key: "bar", label: "Bar" }],
      remove: { teams: ["content"] },
    });
    expect(keys(c.teams)).toContain("bar");
    expect(keys(c.teams)).not.toContain("content");
  });
});

describe("a sound camp with a mutant vehicle (like Oe-aa-sies)", () => {
  const camp = mergePacks(["sound", "mutant-vehicle"], CAMP_PACKS);
  it("pulls in power once and gets every sound and vehicle part", () => {
    expect(camp.packs).toEqual(["core", "power", "sound", "mutant-vehicle"]);
    expect(keys(camp.obligations)).toEqual(
      expect.arrayContaining(["sound_plan", "gas_fuel", "mv_registration", "dmv_flame_licensing"]),
    );
    expect(keys(camp.roles)).toEqual(expect.arrayContaining(["sound_officer", "mv_dmv_contact"]));
    expect(keys(camp.materialCategories)).toContain("sound_lighting");
    expect(new Set(keys(camp.obligations)).size).toBe(camp.obligations.length);
  });
});

describe("pack keys point at real definitions", () => {
  const defined = (file: string) =>
    new Set([...readFileSync(file, "utf8").matchAll(/^\s+key: "([a-z_]+)",$/gm)].map((m) => m[1]));
  const obligations = defined("src/modules/obligations/seed.ts");
  const shifts = defined("src/modules/shifts/seed.ts");
  it.each(Object.keys(CAMP_PACKS))("%s", (k) => {
    const p = CAMP_PACKS[k];
    for (const o of p?.obligations ?? []) expect(obligations, o.key).toContain(o.key);
    for (const s of p?.shiftTemplates ?? []) expect(shifts, s.key).toContain(s.key);
  });
});

describe("no Oe-aa-sies leftovers in the app code", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const f = join(dir, name);
      if (statSync(f).isDirectory()) {
        if (!["__tests__", "tests", "migrations"].includes(name)) walk(f);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "seed.ts")
        files.push(f);
    }
  };
  walk("src");
  it("the camp name only comes from camp.config.ts", () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => /oe-aa-sies/i.test(line) && !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line)),
    );
    expect(hits.map((h) => `${h.f}:${h.i}`)).toEqual([]);
  });
});
