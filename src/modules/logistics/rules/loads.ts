// Loads and critical-kit gaps (docs/specs/logistics.md §3). Pure.
export const LOAD_STATUSES = [
  "planned",
  "packing",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export type LoadStatus = (typeof LOAD_STATUSES)[number];

const NEXT: Record<LoadStatus, readonly LoadStatus[]> = {
  planned: ["packing", "cancelled"],
  packing: ["in_transit", "planned", "cancelled"],
  in_transit: ["delivered", "packing", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canMoveLoad(from: LoadStatus, to: LoadStatus): boolean {
  return NEXT[from].includes(to);
}

export function nextLoadMoves(from: LoadStatus): readonly LoadStatus[] {
  return NEXT[from];
}

export const isLoadOpen = (s: LoadStatus) => s !== "delivered" && s !== "cancelled";

export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  planned: "Planned",
  packing: "Packing",
  in_transit: "On the road",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface GapItem {
  id: string;
  description: string;
  isCritical: boolean;
  neededBy: string | null;
  load: { status: LoadStatus; hasDestination: boolean } | null;
}

export type GapReason = "no_load" | "load_cancelled" | "no_destination";

export const GAP_TEXT: Record<GapReason, string> = {
  no_load: "Not on a load yet",
  load_cancelled: "Its load was cancelled",
  no_destination: "Its load has no destination",
};

/** Why a critical item is a gap, or null if it's covered (L8). Non-critical items are never gaps. */
export function gapReason(i: GapItem): GapReason | null {
  if (!i.isCritical) return null;
  if (!i.load) return "no_load";
  if (i.load.status === "cancelled") return "load_cancelled";
  if (!i.load.hasDestination) return "no_destination";
  return null;
}

/** Critical gaps, soonest needed first (no date last), then by name. */
export function gaps<T extends GapItem>(items: T[]): (T & { reason: GapReason })[] {
  return items
    .map((i) => ({ ...i, reason: gapReason(i) }))
    .filter((i): i is T & { reason: GapReason } => i.reason !== null)
    .sort(
      (a, b) =>
        (a.neededBy ?? "9999").localeCompare(b.neededBy ?? "9999") ||
        a.description.localeCompare(b.description),
    );
}

/** "× 2" for pieces, "6 kg" otherwise; whole numbers without decimals. */
export function qtyText(n: number, unit: string): string {
  const q = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return unit === "pcs" ? `× ${q}` : `${q} ${unit}`;
}
