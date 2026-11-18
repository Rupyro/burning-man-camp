// What this camp's chosen packs add up to (camp.config.ts camp.packs, merged by plan PR 2 rules).
// Seeds read teams, roles, obligations and shift templates from here.
import { CAMP_PACKS } from "../../camp-packs";
import { campConfig } from "./camp";
import type { CampConfig } from "./camp-config";
import { mergePacks } from "./camp-packs";

export const activePacks = mergePacks(
  campConfig.camp.packs,
  CAMP_PACKS,
  (campConfig as CampConfig).custom,
);

/** Keys the active packs switch on for one list, e.g. which obligations to seed. */
export function activeKeys(list: "obligations" | "shiftTemplates"): Set<string> {
  return new Set(activePacks[list].map((i) => i.key));
}

/** Whether one of the camp's packs (or a pack they pull in) is on, e.g. "mutant-vehicle". */
export function hasPack(key: string): boolean {
  return activePacks.packs.includes(key);
}

/** Whether the camp's packs switch on an app section: a module id or a home tile key. */
export function hasSection(key: string): boolean {
  return activePacks.sections.some((s) => s.key === key);
}

const knownSections = new Set(
  Object.values(CAMP_PACKS).flatMap((p) => (p.sections ?? []).map((s) => s.key)),
);
/**
 * A section some pack in the repo brings, but none of this camp's packs. Sections no pack
 * mentions at all (a brand-new module, test modules) are left to their own flags.
 */
export function sectionSwitchedOffByPacks(key: string): boolean {
  return knownSections.has(key) && !hasSection(key);
}
