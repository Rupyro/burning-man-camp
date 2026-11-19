// Water plan (plan Phase 5): how much drinking and cooking water the camp brings, and how it
// packs. Pure maths from people, days and the event's per-person allowance. No database.

export interface WaterInput {
  people: number;
  days: number;
  /** Per person per day, in `unit`. */
  perPersonPerDay: number;
  unit: "gal" | "L";
  /** Extra for the kitchen (washing up, cooking), per day, in `unit`. */
  kitchenPerDay: number;
  /** Showers: how many a day across camp, and how much each uses, in `unit`. */
  showersPerDay: number;
  perShower: number;
  /** Spare on top, as a fraction (0.1 = 10%). */
  spare: number;
}

export interface WaterPlan {
  drinking: number;
  kitchen: number;
  showers: number;
  spare: number;
  total: number;
  /** Containers: 5-gallon jugs and 55-gallon drums, or 25 L jerry cans and 1000 L IBC totes. */
  small: { size: number; count: number; label: string };
  large: { size: number; count: number; label: string };
  /** Gray water to evaporate or haul out (showers and kitchen), same unit. */
  gray: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function waterPlan(i: WaterInput): WaterPlan {
  const drinking = i.people * i.days * i.perPersonPerDay;
  const kitchen = i.days * i.kitchenPerDay;
  const showers = i.days * i.showersPerDay * i.perShower;
  const base = drinking + kitchen + showers;
  const spare = base * i.spare;
  const total = base + spare;
  const [smallSize, smallLabel, largeSize, largeLabel] =
    i.unit === "gal"
      ? [5, "5-gallon jugs", 55, "55-gallon drums"]
      : [25, "25 L jerry cans", 1000, "1000 L totes"];
  return {
    drinking: round1(drinking),
    kitchen: round1(kitchen),
    showers: round1(showers),
    spare: round1(spare),
    total: round1(total),
    small: { size: smallSize, count: Math.ceil(total / smallSize), label: smallLabel },
    large: { size: largeSize, count: Math.ceil(total / largeSize), label: largeLabel },
    gray: round1(kitchen + showers),
  };
}

/** Days from the event's first to last day, inclusive; `fallback` when the pack has no dates. */
export function eventDays(event: { start: string; end: string } | undefined, fallback = 7): number {
  if (!event) return fallback;
  const ms = Date.parse(`${event.end}T00:00:00Z`) - Date.parse(`${event.start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** A whole number from a query value, clamped; `fallback` when missing or not a number. */
export function readCount(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n)));
}
