// Pure shift rules (plan-shifts.md): who may claim, and what counts as contribution.
// Credit only for shifts a lead marked done. Duty minimum in hours, build/strike in DAYS.

export type SignupStatus =
  | "claimed"
  | "confirmed"
  | "completed"
  | "no_show"
  | "released"
  | "swapped_out";
export type Phase = "build" | "burn" | "strike";

export const isLive = (s: SignupStatus) => s !== "released" && s !== "swapped_out";

export interface ClaimFacts {
  now: Date;
  freezeAt: Date;
  startsAt: Date;
  endsAt: Date;
  slotStatus: "open" | "filled" | "cancelled" | "closed_out";
  liveCount: number;
  maxStaff: number;
  /** null = no skill needed. */
  requiredSkillId: string | null;
  mySkillIds: readonly string[];
  alreadyOn: boolean;
  /** My other live shifts, to refuse overlaps. */
  myShifts: readonly { startsAt: Date; endsAt: Date }[];
}

/** Why a member can't claim this shift, in plain words; null = they can. Never auto-assigns. */
export function claimProblem(f: ClaimFacts): string | null {
  if (f.slotStatus === "cancelled" || f.slotStatus === "closed_out") return "This shift is closed";
  if (f.now >= f.freezeAt) return "Sign-ups are frozen. Ask the duty lead";
  if (f.startsAt <= f.now) return "This shift has started";
  if (f.alreadyOn) return "You're already on this shift";
  if (f.liveCount >= f.maxStaff) return "This shift is full";
  if (f.requiredSkillId && !f.mySkillIds.includes(f.requiredSkillId))
    return "This shift needs a qualification you don't have on your profile yet";
  if (f.myShifts.some((s) => s.startsAt < f.endsAt && f.startsAt < s.endsAt))
    return "It overlaps another of your shifts";
  return null;
}

export interface MyShift {
  phase: Phase;
  status: SignupStatus;
  startsAt: Date;
  endsAt: Date;
}

export interface Contribution {
  /** Lead-marked done duty hours (burn phase), plus capped pre-Burn credit. */
  dutyHoursDone: number;
  dutyHoursPlanned: number;
  precreditHours: number;
  /** Distinct camp days with a lead-marked build or strike shift. */
  buildStrikeDaysDone: number;
  buildStrikeDaysPlanned: number;
  minDutyHours: number;
  minBuildStrikeDays: number;
}

const hours = (s: MyShift) => (s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000;

export function contribution(
  shifts: readonly MyShift[],
  settings: { minDutyHours: number; minBuildStrikeDays: number; maxPrecreditPercent: number },
  precreditHours: number,
  campDay: (d: Date) => string,
): Contribution {
  const live = shifts.filter((s) => isLive(s.status) && s.status !== "no_show");
  const duty = live.filter((s) => s.phase === "burn");
  const bs = live.filter((s) => s.phase !== "burn");
  const days = (list: readonly MyShift[]) => new Set(list.map((s) => campDay(s.startsAt))).size;
  const cap = (settings.minDutyHours * settings.maxPrecreditPercent) / 100;
  const sum = (list: readonly MyShift[]) =>
    Math.round(list.reduce((a, s) => a + hours(s), 0) * 10) / 10;
  return {
    dutyHoursDone: sum(duty.filter((s) => s.status === "completed")),
    dutyHoursPlanned: sum(duty),
    precreditHours: Math.min(precreditHours, cap),
    buildStrikeDaysDone: days(bs.filter((s) => s.status === "completed")),
    buildStrikeDaysPlanned: days(bs),
    minDutyHours: settings.minDutyHours,
    minBuildStrikeDays: settings.minBuildStrikeDays,
  };
}

/** Planned shifts plus credit reach the minimums (used before the freeze to nudge sign-up). */
export const plannedEnough = (c: Contribution) =>
  c.dutyHoursPlanned + c.precreditHours >= c.minDutyHours &&
  c.buildStrikeDaysPlanned >= c.minBuildStrikeDays;
