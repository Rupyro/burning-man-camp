// "Do we already have it?" (docs/specs/procurement.md §3). Pure.
import { campConfig, type OwnerKey } from "@/lib/camp";

export type Condition = "good" | "needs_repair" | "broken" | "missing";
export type OwnerLabel = OwnerKey;

export interface StockLine {
  locationName: string;
  condition: Condition;
  quantity: number;
}

export interface HaveIt {
  usable: number;
  repairable: number;
  unusable: number;
  gap: number;
  suggestion: "have_it" | "buy" | "borrow";
  /** Plain words for a card, e.g. "We own 2 (1 broken) in Container A. Buy 3." */
  text: string;
}

const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0+$/, ""));

export function haveIt(
  needed: number,
  stock: StockLine[],
  owner: OwnerLabel = campConfig.owners.campKey,
): HaveIt {
  const sum = (c: Condition[]) =>
    stock.filter((s) => c.includes(s.condition)).reduce((t, s) => t + s.quantity, 0);
  const usable = sum(["good"]);
  const repairable = sum(["needs_repair"]);
  const unusable = sum(["broken", "missing"]);
  const gap = Math.max(0, needed - usable);
  const suggestion =
    gap === 0 ? "have_it" : owner === "borrowed" || owner === "rented" ? "borrow" : "buy";
  const owned = usable + repairable + unusable;
  const places = [...new Set(stock.filter((s) => s.quantity > 0).map((s) => s.locationName))];
  const extras = [
    repairable ? `${n(repairable)} needs repair` : "",
    unusable ? `${n(unusable)} broken or missing` : "",
  ].filter(Boolean);
  const own =
    owned === 0
      ? "We don't own any."
      : `We own ${n(owned)}${extras.length ? ` (${extras.join(", ")})` : ""}${places.length ? ` in ${places.join(", ")}` : ""}.`;
  const next =
    suggestion === "have_it"
      ? "We have enough."
      : `${suggestion === "buy" ? "Buy" : "Borrow"} ${n(gap)}.`;
  return { usable, repairable, unusable, gap, suggestion, text: `${own} ${next}` };
}
