// The shape of a camp's settings (camp.config.ts at the repo root). Another camp swaps the values
// in that one file, plus its art in camp-art/, to make the app its own. See docs plan PR 1.
// PR 1 only adds the file; later PRs switch each part of the app over to read from it.

import type { CampCustom } from "./camp-packs";

export type CampPackKey =
  | "core"
  | "sound"
  | "mutant-vehicle"
  | "power"
  | "fire-flame"
  | "kitchen"
  | "art"
  | "village"
  | "workshops";

/**
 * Kinds of Burning Man camp (Placement's placed-camp categories, plus open camping). A camp's
 * type decides which Placement screens it sees, e.g. open camping hides the Statement of Intent.
 */
export const CAMP_TYPES = [
  { key: "theme", label: "Theme camp (placed)" },
  { key: "art-support", label: "Art support camp" },
  { key: "mutant-vehicle", label: "Mutant vehicle camp" },
  { key: "work-support", label: "Work or civic support camp" },
  { key: "open", label: "Open camping (not placed)" },
] as const;
export type CampTypeKey = (typeof CAMP_TYPES)[number]["key"];

/** Database enum values for who owns a piece of gear (procurement_owner_label). */
export const OWNER_KEYS = ["ours", "borrowed", "rented"] as const;
export type OwnerKey = (typeof OWNER_KEYS)[number];

/** Display names for the owner keys; campKey "ours" is the database default. */
export const DEFAULT_OWNERS = {
  campKey: "ours",
  labels: {
    ours: "Ours",
    borrowed: "Borrowed",
    rented: "Rented",
  },
} as const satisfies { campKey: OwnerKey; labels: Record<OwnerKey, string> };

export interface CampConfig {
  camp: {
    name: string;
    shortName: string;
    /** Lowercase key, letters and digits only. */
    slug: string;
    tagline: string;
    /** Camp type packs; core always loads first even if left out. */
    packs: readonly CampPackKey[];
    /** What kind of camp this is (CAMP_TYPES). Optional until every camp has set it. */
    type?: CampTypeKey;
    /** About how many people camp with us, including first-timers. */
    size?: number;
  };
  look: {
    /** URL of the logo; files live in camp-art/ and are served from public/ at build. */
    logo: string;
    emblem: "protea";
  };
  money: {
    /** ISO 4217 code. */
    currency: string;
    /** Shown before amounts and accepted when typing them, e.g. "R" for "R4,500". */
    symbol: string;
    /** The camp fee, integer cents (placeholder until leadership sets the year's amount). */
    campFeeCents: number;
    xceed: { enabled: boolean };
  };
  joining: {
    familyYears: { enabled: boolean; since: number };
  };
  extras: {
    traditions: readonly "rain-dance"[];
  };
  /** The event the camp goes to (camp-events/<key>/): its dates, deadlines and rules. */
  event: { pack: "burning-man" | "afrikaburn" };
  /**
   * Who owns gear: display names for the fixed database keys. campKey must be one of
   * OWNER_KEYS; the database default is "ours".
   */
  owners: { campKey: OwnerKey; labels: Record<OwnerKey, string> };
  /** The camp's own additions to its packs, and pack items it drops (plan PR 2, PR 11). */
  custom?: CampCustom;
}

/** Typed helper so camp.config.ts gets checked and autocompleted. */
export function defineCampConfig<const T extends CampConfig>(config: T): T {
  return config;
}

/** Problems with a config, in plain words; empty means it's fine. */
export function campConfigProblems(c: CampConfig): string[] {
  const out: string[] = [];
  if (!c.camp.name.trim()) out.push("camp.name is empty");
  if (!/^[a-z0-9]+$/.test(c.camp.slug)) out.push("camp.slug must be lowercase letters and digits");
  if (!/^[A-Z]{3}$/.test(c.money.currency)) out.push("money.currency must be a 3-letter code");
  if (c.camp.type !== undefined && !CAMP_TYPES.some((t) => t.key === c.camp.type))
    out.push("camp.type must be one of the camp types");
  if (c.camp.size !== undefined && (!Number.isInteger(c.camp.size) || c.camp.size < 1))
    out.push("camp.size must be a whole number of people");
  if (new Set(c.camp.packs).size !== c.camp.packs.length) out.push("camp.packs has duplicates");
  const y = c.joining.familyYears.since;
  if (!Number.isInteger(y) || y < 1990 || y > 2100)
    out.push("joining.familyYears.since looks wrong");
  const own = c.custom?.materialCategories ?? [];
  const seen = new Set<string>();
  for (const m of own) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(m.key))
      out.push(
        `custom.materialCategories "${m.key}" must be lowercase letters, digits or _ (up to 40)`,
      );
    if (!m.label.trim()) out.push(`custom.materialCategories "${m.key}" needs a label`);
    if (seen.has(m.key)) out.push(`custom.materialCategories has "${m.key}" twice`);
    seen.add(m.key);
  }
  if (!(OWNER_KEYS as readonly string[]).includes(c.owners.campKey))
    out.push("owners.campKey must be one of the database keys (ours, borrowed, rented)");
  for (const k of OWNER_KEYS) {
    if (!c.owners.labels[k]?.trim()) out.push(`owners.labels.${k} is empty`);
  }
  return out;
}
