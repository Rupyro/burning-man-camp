// Need status machine (docs/specs/procurement.md §3). Pure.
export const NEED_STATUSES = [
  "needed",
  "have_it",
  "to_buy",
  "to_borrow",
  "purchase_requested",
  "ordered",
  "received",
  "cancelled",
  "built",
  "not_needed",
] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

const NEXT: Record<NeedStatus, readonly NeedStatus[]> = {
  needed: ["have_it", "to_buy", "to_borrow", "cancelled", "built", "not_needed"],
  have_it: ["needed", "received", "cancelled"],
  to_buy: ["purchase_requested", "ordered", "needed", "cancelled"],
  to_borrow: ["received", "needed", "cancelled"],
  purchase_requested: ["to_buy", "needed", "cancelled"],
  ordered: ["received", "cancelled"],
  received: [],
  cancelled: [],
  built: ["needed"],
  not_needed: ["needed"],
};

/** Moves a lead may make by hand. purchase_requested is set by "turn into a spend request". */
export function canMove(from: NeedStatus, to: NeedStatus): boolean {
  return NEXT[from].includes(to);
}

export function isOpen(s: NeedStatus): boolean {
  return s !== "received" && s !== "cancelled" && s !== "built" && s !== "not_needed";
}

/** What Finance's decision does to a need that asked for money. Anything else: no change. */
export function afterSpendDecision(
  status: NeedStatus,
  decision: "approved" | "rejected",
): NeedStatus | null {
  if (status !== "purchase_requested") return null;
  return decision === "approved" ? "to_buy" : "needed";
}

export const STATUS_LABEL: Record<NeedStatus, string> = {
  needed: "Needed",
  have_it: "We have it",
  to_buy: "To buy",
  to_borrow: "To borrow",
  purchase_requested: "Asked finance",
  ordered: "Ordered",
  received: "Received",
  cancelled: "Cancelled",
  built: "Built",
  not_needed: "Not necessary",
};
