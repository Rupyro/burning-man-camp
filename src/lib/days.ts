/** Whole days from `from` to `now`, rounded down (negative when `from` is in the future). */
export const daysSince = (from: Date, now: Date) =>
  Math.floor((now.getTime() - from.getTime()) / 86_400_000);

/** The latest stage reached: stages [3, 7, 14] at day 8 → 7; before day 3 → null. */
export function stageReached(days: number, stages: readonly number[]): number | null {
  let hit: number | null = null;
  for (const s of stages) if (days >= s) hit = s;
  return hit;
}
