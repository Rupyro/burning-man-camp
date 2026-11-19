import type { Tile } from "@/base/landing/landing";
import { EVENT_NAME } from "@/lib/event";
import type { Category } from "./up-next";

const MODULE_CARDS: { id: string; name: string; icon: string; member: string; lead: string }[] = [
  {
    id: "finance",
    name: "Money",
    icon: "wallet",
    member: "Requests and receipts",
    lead: "Approvals, budgets, spend",
  },
  {
    id: "procurement",
    name: "Kit and stock",
    icon: "package",
    member: "What we have and need",
    lead: "What we have and need",
  },
  {
    id: "logistics",
    name: "Travel and loads",
    icon: "truck",
    member: "Your trip and rides",
    lead: "Loads, vehicles, arrivals",
  },
  {
    id: "applicants",
    name: "Applications",
    icon: "user-plus",
    member: "Open applications",
    lead: "Review applicants, book interviews",
  },
  {
    id: "obligations",
    name: "Obligations",
    icon: "calendar-check",
    member: `${EVENT_NAME} deadlines`,
    lead: `${EVENT_NAME} deadlines`,
  },
];

/**
 * The home category cards (spec B3.1 §1): Shifts (new, placeholder), the visible modules, Camp
 * info. Tiles without a card come back as `others` so no visible module drops off home.
 */
export function homeCards(tiles: readonly Tile[], lead: boolean) {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const cards: Category[] = [
    {
      id: "shifts",
      name: "Shifts",
      icon: "calendar-clock",
      href: "/shifts",
      line: "Sign up for shifts, see your contribution",
      isNew: true,
    },
  ];
  for (const c of MODULE_CARDS) {
    const tile = byId.get(c.id);
    if (!tile) continue;
    cards.push({
      id: c.id,
      name: c.name,
      icon: c.icon,
      href: tile.route,
      line: lead ? c.lead : c.member,
      badge: tile.badge,
    });
  }
  cards.push({
    id: "camp",
    name: "Camp info",
    icon: "tent",
    href: "/camp",
    line: "Guide, packing, rules, dates, leads",
  });
  const known = new Set(MODULE_CARDS.map((c) => c.id));
  return { cards, others: tiles.filter((t) => !known.has(t.id)) };
}
