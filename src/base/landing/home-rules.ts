// Pure helpers for the home screen (docs/specs/b3-home.md §3): camp-time day counts and chips.
import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";
import { CAMP_TIMEZONE } from "@/lib/dates";

const camp = (d: Date) => new TZDate(d, CAMP_TIMEZONE);

/** Whole camp-time calendar days from now until `at`; never negative. */
export function daysUntil(at: Date, now: Date): number {
  return Math.max(0, differenceInCalendarDays(camp(at), camp(now)));
}

export interface CountdownPart {
  days: number;
  at: Date;
}

/** Build start and gates (event_start) from the edition's key dates. */
export function countdown(
  anchors: readonly { key: string; startsAt: Date }[],
  now: Date,
): { build: CountdownPart | null; gates: CountdownPart | null } {
  const part = (key: string): CountdownPart | null => {
    const a = anchors.find((x) => x.key === key);
    return a ? { days: daysUntil(a.startsAt, now), at: a.startsAt } : null;
  };
  return { build: part("build_start"), gates: part("event_start") };
}

export type ChipTone = "late" | "soon" | "normal";

/** "2 days late", "Due today", "Due Wed" (within a week), else "Due 3 May". */
export function dueChip(dueAt: Date | null, now: Date): { label: string; tone: ChipTone } | null {
  if (!dueAt) return null;
  const diff = differenceInCalendarDays(camp(dueAt), camp(now));
  if (dueAt.getTime() < now.getTime() && diff < 0) {
    const n = -diff;
    return { label: `${n} day${n === 1 ? "" : "s"} late`, tone: "late" };
  }
  if (diff <= 0) return { label: "Due today", tone: "soon" };
  if (diff < 7) return { label: `Due ${format(camp(dueAt), "EEE")}`, tone: "soon" };
  return { label: `Due ${format(camp(dueAt), "d MMM")}`, tone: "normal" };
}

export function readinessPercent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
