// Catalogue + stock CSV import: name,category,unit,quantity,location,condition. Pure.
import { activePacks } from "@/lib/active-packs";
import type { Condition } from "./have-it";

export const CATEGORIES = [
  "tool",
  "kitchen_equipment",
  "building_material",
  "electrical",
  "plumbing",
  "safety",
  "decor",
  "consumable",
  "food",
  "camping",
  "sound_lighting",
  "other",
] as const;
/** The 12 built-in category keys. */
export type BuiltInCategory = (typeof CATEGORIES)[number];
/**
 * A category key: one of the 12 built-in ones or a camp's own (camp.config.ts
 * custom.materialCategories). Stored as text since plan PR 11; checked here, not by the database.
 */
export type Category = string;

/** Lowercase letters, digits and underscores, starting with a letter, up to 40 characters. */
export const CATEGORY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

const DEFAULT_LABEL: Record<BuiltInCategory, string> = {
  tool: "Tool",
  kitchen_equipment: "Kitchen gear",
  building_material: "Building material",
  electrical: "Electrical",
  plumbing: "Plumbing and water",
  safety: "Safety",
  decor: "Decor",
  consumable: "Consumable",
  food: "Food",
  camping: "Camping",
  sound_lighting: "Sound and lighting",
  other: "Other",
};

const packCategories = new Map(activePacks.materialCategories.map((c) => [c.key, c.label]));
const builtIn = new Set<string>(CATEGORIES);

/**
 * The categories this camp uses: the built-in ones its packs switch on (plan PR 8), in the fixed
 * order above, then the camp's own (plan PR 11), with "other" always last.
 */
export const CAMP_CATEGORIES: readonly Category[] = [
  ...CATEGORIES.filter((k) => k !== "other" && packCategories.has(k)),
  ...[...packCategories.keys()].filter((k) => !builtIn.has(k)),
  "other",
];
const campSet = new Set(CAMP_CATEGORIES);

/** Whether a key is a category this camp uses (what new and edited items may pick). */
export function isCampCategory(key: string): boolean {
  return campSet.has(key);
}

/**
 * The label for any stored category: the camp's own label, else the built-in one (rows from a
 * pack the camp later dropped), else the key in words.
 */
export function categoryLabel(key: Category): string {
  const own = packCategories.get(key) ?? DEFAULT_LABEL[key as BuiltInCategory];
  if (own) return own;
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
const CONDITIONS: readonly Condition[] = ["good", "needs_repair", "broken", "missing"];

export interface ImportRow {
  name: string;
  category: Category;
  unit: string;
  quantity: number;
  location: string;
  condition: Condition;
}
export interface ImportResult {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
}

function split(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "_");

export function parseImport(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const rows: ImportRow[] = [];
  const errors: ImportResult["errors"] = [];
  const header = split(lines[0] ?? "").map(norm);
  const want = ["name", "category", "unit", "quantity", "location", "condition"];
  if (want.some((w, i) => header[i] !== w)) {
    return { rows, errors: [{ line: 1, message: `The first line must be: ${want.join(",")}` }] };
  }
  for (const [i, raw] of lines.slice(1).entries()) {
    const line = i + 2;
    if (!raw.trim()) continue;
    const [name = "", cat = "", unit = "", qty = "", location = "", cond = ""] = split(raw);
    const quantity = Number(qty);
    const c = norm(cond || "good");
    const problem = !name
      ? "No item name"
      : !location
        ? "No location"
        : qty === "" || !Number.isFinite(quantity) || quantity < 0
          ? `Quantity "${qty}" isn't a number`
          : !CONDITIONS.includes(c as Condition)
            ? `Condition "${cond}" isn't good, needs repair, broken or missing`
            : null;
    if (problem) {
      errors.push({ line, message: problem });
      continue;
    }
    const k = norm(cat);
    rows.push({
      name,
      category: isCampCategory(k) ? k : "other",
      unit: unit || "pcs",
      quantity,
      location,
      condition: c as Condition,
    });
  }
  return { rows, errors };
}
