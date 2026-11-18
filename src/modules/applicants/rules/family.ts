// Oe-aa-sies Family fast track (Nov 1 2026): returning members skip the interview once an admin
// welcomes them in. Pure: no db, no next.

import { CAMP_START_YEAR, isFoundingFamily, validFamilyYears } from "@/lib/family-years";

export {
  CAMP_START_YEAR,
  familyLine,
  familyYearsOffered,
  isFoundingFamily,
  validFamilyYears,
} from "@/lib/family-years";

export const FAMILY_TEAMS = [
  "Kitchen",
  "Build",
  "Art",
  "MOOP",
  "Transport",
  "Crew / stage",
  "Power",
  "Welfare",
] as const;
export const FAMILY_BUILD_PIECES = [
  "Cloud",
  "Ossewas",
  "Protea lanterns",
  "Signage",
  "Shade structure",
  "Kitchen dome",
] as const;
export const FAMILY_GOOD_AT = [
  "Welding",
  "Lights & wiring",
  "Cooking for crowds",
  "Driving big vehicles",
  "Painting",
  "Sorting people out",
] as const;
export const FAMILY_LOVE_TO = [
  "Same as before",
  "Something new",
  "Leading a team",
  "Happy anywhere",
] as const;

/** Who may welcome family in. A setting; admins only for now. */
export type FamilyApprovers = "admins" | "admins_and_leads";
export const FAMILY_APPROVERS: FamilyApprovers = "admins";

/** Years badges: 2 years, 3 years, Founding family at 4 or more. */
export const YEARS_TIERS = [
  { id: "years-2", min: 2 },
  { id: "years-3", min: 3 },
  { id: "founding-family", min: 4 },
] as const;
export function yearsBadges(count: number): string[] {
  return YEARS_TIERS.filter((t) => count >= t.min).map((t) => t.id);
}

export function litMessage(years: readonly number[], now: Date): string {
  const n = validFamilyYears(years, now).length;
  if (!n) return "Tap a year. Your protea opens a little more for each one.";
  if (isFoundingFamily(years, now))
    return `All ${n} in bloom, every year since we began in ${CAMP_START_YEAR}. You're Founding family!`;
  return `${n} ${n === 1 ? "year" : "years"} bloomed. Thank you for coming back.`;
}

export function canWelcomeFamily(
  who: { isAdmin: boolean; isLead: boolean },
  approvers: FamilyApprovers,
): boolean {
  return who.isAdmin || (approvers === "admins_and_leads" && who.isLead);
}

/** Demo (keyword) guess at a good fit. Always shown as a suggestion; a person decides. */
export function suggestFamilyRole(a: { teams: string[]; led: boolean; loveTo: string[] }): string {
  const team = a.teams[0];
  if (!team) return "happy anywhere: ask what they'd enjoy";
  if (a.led && a.loveTo.includes("Leading a team")) return `could lead ${team}`;
  return `a natural fit for ${team}`;
}
