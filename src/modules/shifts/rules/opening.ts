import { formatCampDay } from "@/lib/dates";

/** The edition anchor date (base anchor_dates) for when members can start picking shifts. */
export const SIGNUPS_OPEN_ANCHOR = "shift_signups_open";

/** What a member reads while the roster isn't published yet: when it opens, and what's next. */
export function notOpenYet(opensAt: Date | null, now: Date): string {
  return opensAt && opensAt > now
    ? `Shift sign-ups open on ${formatCampDay(opensAt)}. We'll send you an alert when they do.`
    : "Shift sign-ups haven't opened yet. We'll send you an alert when they do.";
}
