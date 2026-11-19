// Fuel plan (plan Phase 6): how much generator fuel the camp brings, how many cans that takes when
// each is filled to the safe level, and whether it fits the event's storage limit. Pure maths.

export interface FuelInput {
  generators: number;
  hoursPerDay: number;
  /** Burn rate per generator at the camp's usual load, in `unit` per hour (from the manual). */
  perHour: number;
  days: number;
  unit: "gal" | "L";
  /** Spare on top, as a fraction (0.1 = 10%). */
  spare: number;
  /** Fill each can to this fraction of its size (0.8 = 80%, room for heat expansion). */
  maxFill: number;
}

export interface FuelPlan {
  burn: number;
  spare: number;
  total: number;
  /** Cans of `can.size`, each filled to `maxFill`. */
  can: { size: number; holds: number; count: number; label: string };
  /** Over the stored-fuel limit (when the event sets one); fuel already in generators doesn't count. */
  overLimit: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function fuelPlan(i: FuelInput, storageLimit?: number): FuelPlan {
  const burn = i.generators * i.hoursPerDay * i.perHour * i.days;
  const spare = burn * i.spare;
  const total = burn + spare;
  const [size, label] = i.unit === "gal" ? [5, "5-gallon cans"] : [20, "20 L jerry cans"];
  const holds = round1(size * i.maxFill);
  return {
    burn: round1(burn),
    spare: round1(spare),
    total: round1(total),
    can: { size, holds, count: holds > 0 ? Math.ceil(round1(total) / holds) : 0, label },
    overLimit: storageLimit !== undefined && total > storageLimit,
  };
}

/** A decimal from a query value, clamped to 0..max; `fallback` when missing or not a number. */
export function readAmount(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n * 100) / 100));
}
