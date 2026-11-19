// The camp-lead year (plan Phase 2): the event pack's calendar, cut to this camp's type and
// grouped by month, with what's done, what's on now and what's next.
import type { CampTypeKey } from "./camp-config";
import { calendarInOrder, type EventCalendarEntry, type EventPack } from "./event-packs";

export type EntryState = "past" | "now" | "next" | "later";

export interface YearEntry extends EventCalendarEntry {
  state: EntryState;
}

export interface YearMonth {
  /** "2027-01" */
  key: string;
  entries: YearEntry[];
}

/** The pack's calendar for one camp type: open camping skips the Placement-only steps. */
export function calendarForCamp(pack: EventPack, type?: CampTypeKey): EventCalendarEntry[] {
  return calendarInOrder(pack).filter((e) => !(type === "open" && e.placedOnly));
}

/** past: over; now: running today; next: the first one still ahead; later: the rest. */
export function withStates(entries: readonly EventCalendarEntry[], today: string): YearEntry[] {
  let nextGiven = false;
  return entries.map((e) => {
    const end = e.until ?? e.date;
    if (end < today) return { ...e, state: "past" };
    if (e.date <= today) return { ...e, state: "now" };
    if (!nextGiven) {
      nextGiven = true;
      return { ...e, state: "next" };
    }
    return { ...e, state: "later" };
  });
}

/** Entries grouped by the month they start in, in date order. */
export function byMonth(entries: readonly YearEntry[]): YearMonth[] {
  const months: YearMonth[] = [];
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    const last = months.at(-1);
    if (last?.key === key) last.entries.push(e);
    else months.push({ key, entries: [e] });
  }
  return months;
}

/** "2027-01" → "January 2027". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 15)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A calendar day (YYYY-MM-DD) as a noon-UTC instant, safe to format in any camp time zone. */
export function dayInstant(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
