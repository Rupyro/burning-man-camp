// The packing checklist's shape and helpers. The list itself is camp content: camp-content/packing.ts.
import { PACKING_LIST } from "../../camp-content/packing";

export type PackingItem = { key: string; label: string; note: string };
export type PackingSection = { title: string; items: PackingItem[] };

export {
  CAMP_PROVIDES,
  PACKING_LIST,
  PACKING_SOURCES,
  PLEASE_DONT_BRING,
} from "../../camp-content/packing";

const KEYS = new Set(PACKING_LIST.flatMap((s) => s.items.map((i) => i.key)));
export const PACKING_TOTAL = KEYS.size;
export function isPackingKey(key: string): boolean {
  return KEYS.has(key);
}
/** How many real list items are ticked (ignores keys that left the list). */
export function packedCount(ticked: readonly string[]): number {
  return new Set(ticked.filter(isPackingKey)).size;
}
