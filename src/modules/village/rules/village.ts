// Village or HUB (plan Phase 7): what the camp lends to and borrows from partner camps (water,
// power, tools, transport), so everything goes home with its owner at Exodus. Pure rules.

export const DIRECTIONS = ["lend", "borrow"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const RESOURCES = ["water", "power", "tools", "transport", "shade", "other"] as const;
export type Resource = (typeof RESOURCES)[number];

export const RESOURCE_LABEL: Record<Resource, string> = {
  water: "Water",
  power: "Power",
  tools: "Tools",
  transport: "Transport",
  shade: "Shade and structures",
  other: "Other",
};

export interface Share {
  partner: string;
  direction: Direction;
  returned: boolean;
}

/** Open shares per partner camp: what we still have of theirs, and what they have of ours. */
export function openByPartner(rows: readonly Share[]) {
  const out = new Map<string, { theirs: number; ours: number }>();
  for (const r of rows) {
    if (r.returned) continue;
    const p = out.get(r.partner) ?? { theirs: 0, ours: 0 };
    if (r.direction === "borrow") p.theirs += 1;
    else p.ours += 1;
    out.set(r.partner, p);
  }
  return [...out]
    .map(([partner, n]) => ({ partner, ...n }))
    .sort((a, b) => a.partner.localeCompare(b.partner));
}
