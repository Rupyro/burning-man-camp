// Event packs: the event a camp goes to (Burning Man in Black Rock City, or AfrikaBurn), with its
// dates, its yearly deadlines and its rules. Plain data files in camp-events/<event>/.
// camp.config.ts picks one with event.pack. Its obligations merge after the camp's packs.

import type { PackItem } from "./camp-packs";

/** "official" = posted by the event for this year; "pattern" = last year's date, until posted. */
export type EventDateStatus = "official" | "pattern";

export interface EventCalendarEntry {
  key: string;
  label: string;
  /** What the camp does about it, in plain words. */
  detail: string;
  /** First day it applies, YYYY-MM-DD in the event's time zone. */
  date: string;
  /** Last day, for windows (e.g. a sale that runs for weeks). */
  until?: string;
  /** Clock time when it matters, e.g. "12:00 PT". */
  time?: string;
  status: EventDateStatus;
  /** Where the date comes from. */
  source: string;
}

export interface EventRule {
  key: string;
  label: string;
  summary: string;
  source: string;
}

export interface EventPack {
  key: "burning-man" | "afrikaburn";
  label: string;
  /** Where it happens, e.g. "Black Rock City, Nevada". */
  place: string;
  /** IANA time zone for every date and deadline. */
  timezone: string;
  /** Currency tickets and fees are in (ISO 4217). */
  currency: string;
  year: number;
  /** The event itself: first and last day, YYYY-MM-DD (left out until known). */
  event?: { start: string; end: string; status: EventDateStatus; source: string };
  calendar: readonly EventCalendarEntry[];
  rules: readonly EventRule[];
  /** Obligation definitions this event switches on (keys into the obligations module's seed). */
  obligations?: readonly PackItem[];
  /** Section labels this event renames, e.g. the obligations tile. */
  sections?: readonly PackItem[];
}

export function defineEventPack<const T extends EventPack>(pack: T): T {
  return pack;
}

/** Calendar entries in date order. */
export function calendarInOrder(pack: EventPack): EventCalendarEntry[] {
  return [...pack.calendar].sort((a, b) => a.date.localeCompare(b.date));
}

/** Entries still ahead of (or running on) `today` (YYYY-MM-DD), soonest first. */
export function upcomingEntries(pack: EventPack, today: string): EventCalendarEntry[] {
  return calendarInOrder(pack).filter((e) => (e.until ?? e.date) >= today);
}
