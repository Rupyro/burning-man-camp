// What this camp's chosen packs add up to (camp.config.ts camp.packs, merged by plan PR 2 rules).
// Seeds read teams, roles, obligations and shift templates from here.
import { EVENT_PACKS } from "../../camp-events";
import { CAMP_PACKS } from "../../camp-packs";
import { campConfig } from "./camp";
import type { CampConfig } from "./camp-config";
import { type CampPack, mergePacks } from "./camp-packs";

/** The camp's event pack (Burning Man by default). */
export const activeEvent = EVENT_PACKS[(campConfig as CampConfig).event.pack];

// The event's obligations and section labels merge last, like one more pack.
const EVENT_KEY = `event:${activeEvent.key}`;
const eventAsPack: CampPack = {
  key: EVENT_KEY,
  label: activeEvent.label,
  obligations: [...(activeEvent.obligations ?? [])],
  sections: [...(activeEvent.sections ?? [])],
};

export const activePacks = mergePacks(
  [...campConfig.camp.packs, EVENT_KEY],
  { ...CAMP_PACKS, [EVENT_KEY]: eventAsPack },
  (campConfig as CampConfig).custom,
);

/** Keys the active packs switch on for one list, e.g. which obligations to seed. */
export function activeKeys(list: "obligations" | "shiftTemplates"): Set<string> {
  return new Set(activePacks[list].map((i) => i.key));
}

/** Whether one of the camp's packs (or a pack they pull in, or its event) is on, e.g. "mutant-vehicle". */
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
