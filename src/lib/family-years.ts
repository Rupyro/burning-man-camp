// Oe-aa-sies Family years: shared by the applicants module and the app shell (badges, My profile).

import { campConfig } from "./camp";

/** The camp's first year (camp.config.ts joining.familyYears.since). */
export const CAMP_START_YEAR = campConfig.joining.familyYears.since;
/** Whether returning members get the Family fast track (camp.config.ts joining.familyYears). */
export const FAMILY_YEARS_ENABLED = campConfig.joining.familyYears.enabled;

/** Every camp year from 2023 up to this year. */
export function familyYearsOffered(now: Date): number[] {
  const last = Math.max(CAMP_START_YEAR, now.getUTCFullYear());
  return Array.from({ length: last - CAMP_START_YEAR + 1 }, (_, i) => CAMP_START_YEAR + i);
}

export function validFamilyYears(years: readonly number[], now: Date): number[] {
  const offered = new Set(familyYearsOffered(now));
  return [...new Set(years)].filter((y) => offered.has(y)).sort((a, b) => a - b);
}

export function isFoundingFamily(years: readonly number[], now: Date): boolean {
  const all = familyYearsOffered(now);
  return validFamilyYears(years, now).length === all.length && all.length >= 4;
}

export function familyLine(years: readonly number[], now: Date): string {
  const ys = validFamilyYears(years, now);
  const base = `${ys.join(" · ")} · ${ys.length} years in bloom`;
  return isFoundingFamily(ys, now) ? `${base} · Founding family` : base;
}

/** How open the family protea is: one stage per confirmed year, full bloom from 4. */
export function proteaStage(count: number): number {
  return Math.min(4, Math.max(0, Math.floor(count)));
}
