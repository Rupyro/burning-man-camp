// Safety registers (plan Phases 6 and 8): what fuel the camp stores, which flame effects it runs,
// what art the camp burns and how, and how many stakes and lag bolts went into the playa, so every one comes out at strike.

export const KINDS = ["fuel", "flame", "burn", "stake"] as const;
export type RegisterKind = (typeof KINDS)[number];

export const KIND_LABEL: Record<RegisterKind, string> = {
  fuel: "Fuel stored",
  flame: "Flame effects and fire",
  burn: "Art burns (burn plan)",
  stake: "Stakes and lag bolts",
};

export interface RegisterLine {
  kind: RegisterKind;
  label: string;
  quantity: number;
  pulled: number;
}

/** Stored fuel, added up (same unit as the event's limit), and whether it's over the limit. */
export function fuelTotal(rows: readonly RegisterLine[], limit?: number) {
  const total = rows.filter((r) => r.kind === "fuel").reduce((n, r) => n + r.quantity, 0);
  return { total, overLimit: limit !== undefined && total > limit };
}

/** Stakes still in the ground: placed minus pulled, per line and in all. */
export function stakesLeft(rows: readonly RegisterLine[]) {
  const lines = rows
    .filter((r) => r.kind === "stake")
    .map((r) => ({ label: r.label, left: Math.max(0, r.quantity - r.pulled) }));
  return { lines, left: lines.reduce((n, l) => n + l.left, 0) };
}
