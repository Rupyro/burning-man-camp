// Plan PR 16: the setup questions and the camp.config.ts they write. Pure (no prompts, no files).
import { type CampConfig, type CampPackKey, DEFAULT_OWNERS } from "../../src/lib/camp-config";

export const PICKABLE_PACKS: { key: CampPackKey; label: string }[] = [
  { key: "sound", label: "Sound camp (pulls in power)" },
  { key: "mutant-vehicle", label: "Mutant vehicle (pulls in power)" },
  { key: "power", label: "Power: generators and fuel, on its own" },
];
export const TRADITIONS = [{ key: "rain-dance", label: "Rain dance" }] as const;

/** The 7 steps, in order, as shown by `pnpm camp:setup`. */
export const SETUP_STEPS = [
  "Camp name",
  "Short description",
  "Camp type packs",
  "Money",
  "Joining and Family years",
  "Traditions",
  "Check and save",
] as const;

export interface SetupAnswers {
  name: string;
  tagline?: string;
  packs: CampPackKey[];
  currency: string;
  symbol: string;
  campFee: number;
  familyYears: boolean;
  since: number;
  traditions: string[];
  /** The camp's own gear categories, e.g. "Bar supplies" (plan PR 11). */
  ownCategories?: string[];
}

/** "Oe-aa-sies" → "oeaasies". */
export function slugFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "R3,500" / "3500" → 350000 cents; null if it isn't a plain amount. */
export function feeCents(input: string): number | null {
  const s = input
    .trim()
    .replace(/^[^\d]+/, "")
    .replace(/[ ,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** "Bar supplies" → { key: "bar_supplies", label: "Bar supplies" }. */
export function categoryFrom(label: string): { key: string; label: string } {
  const l = label.trim();
  return {
    key: l
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "c_$1")
      .slice(0, 40),
    label: l,
  };
}

export function configFrom(a: SetupAnswers): CampConfig {
  const name = a.name.trim();
  const own = (a.ownCategories ?? []).filter((l) => l.trim()).map(categoryFrom);
  return {
    camp: {
      name,
      shortName: name,
      slug: slugFor(name),
      tagline: a.tagline?.trim() || `Operations platform for the ${name} camp at AfrikaBurn`,
      packs: ["core", ...a.packs],
    },
    look: { logo: "/backdrop/logomark.png", emblem: "protea" },
    money: {
      currency: a.currency.toUpperCase(),
      symbol: a.symbol,
      campFeeCents: a.campFee,
      xceed: { enabled: false },
    },
    joining: { familyYears: { enabled: a.familyYears, since: a.since } },
    extras: { traditions: a.traditions as CampConfig["extras"]["traditions"] },
    event: { pack: "afrikaburn" },
    owners: DEFAULT_OWNERS,
    ...(own.length ? { custom: { materialCategories: own } } : {}),
  };
}

const q = (s: string) => JSON.stringify(s);
const list = (xs: readonly string[]) => `[${xs.map(q).join(", ")}]`;
const cents = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d)$)/g, "_");

/** The camp.config.ts file text for a config, in the same layout as the hand-written one. */
export function renderCampConfig(c: CampConfig): string {
  return `// ${c.camp.name} camp settings. Another camp copies the repo and swaps these values (and camp-art/).
// Run \`pnpm camp:setup\` to answer 7 questions and rewrite this file, or edit it by hand.
import { defineCampConfig } from "./src/lib/camp-config";

export default defineCampConfig({
  camp: {
    name: ${q(c.camp.name)},
    shortName: ${q(c.camp.shortName)},
    slug: ${q(c.camp.slug)},
    tagline: ${q(c.camp.tagline)},
    packs: ${list(c.camp.packs)},
  },
  look: { logo: ${q(c.look.logo)}, emblem: ${q(c.look.emblem)} },
  money: { currency: ${q(c.money.currency)}, symbol: ${q(c.money.symbol)}, campFeeCents: ${cents(c.money.campFeeCents)}, xceed: { enabled: ${c.money.xceed.enabled} } },
  joining: { familyYears: { enabled: ${c.joining.familyYears.enabled}, since: ${c.joining.familyYears.since} } },
  extras: { traditions: ${list(c.extras.traditions)} },
  event: { pack: ${q(c.event.pack)} },
  owners: {
    campKey: ${q(c.owners.campKey)},
    labels: {
      oeaasies: ${q(c.owners.labels.oeaasies)},
      khoena: ${q(c.owners.labels.khoena)},
      shared: ${q(c.owners.labels.shared)},
      borrowed: ${q(c.owners.labels.borrowed)},
      rented: ${q(c.owners.labels.rented)},
    },
  },${
    c.custom?.materialCategories?.length
      ? `\n  custom: {\n    materialCategories: [\n${c.custom.materialCategories.map((m) => `      { key: ${q(m.key)}, label: ${q(m.label)} },`).join("\n")}\n    ],\n  },`
      : ""
  }
});
`;
}
