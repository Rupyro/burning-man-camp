// A team's shopping list (docs/specs/procurement.md §3). Pure.
import type { Category } from "./csv";
import type { NeedStatus } from "./status";

export interface ListNeed {
  itemName: string;
  category: Category;
  unit: string;
  quantityNeeded: number;
  gap: number;
  status: NeedStatus;
  neededBy: string | null;
  supplierName: string | null;
}

const ON_LIST: readonly NeedStatus[] = ["to_buy", "purchase_requested", "ordered"];

export function shoppingList(needs: ListNeed[]): { category: Category; lines: ListNeed[] }[] {
  const by = new Map<Category, ListNeed[]>();
  for (const x of needs.filter((n) => ON_LIST.includes(n.status) && n.gap > 0)) {
    by.set(x.category, [...(by.get(x.category) ?? []), x]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, lines]) => ({
      category,
      lines: lines.sort(
        (a, b) =>
          (a.neededBy ?? "9999").localeCompare(b.neededBy ?? "9999") ||
          a.itemName.localeCompare(b.itemName),
      ),
    }));
}
