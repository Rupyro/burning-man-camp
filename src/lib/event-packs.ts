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
  /** Only for camps that go through Placement (every camp type except "open" camping). */
  placedOnly?: boolean;
}

export interface EventRule {
  key: string;
  label: string;
  summary: string;
  source: string;
}

export interface EventProject {
  /** The camp pack that shows it, e.g. "mutant-vehicle" or "art". */
  pack: string;
  label: string;
  summary: string;
  steps: readonly { label: string; window: string }[];
  source: string;
}

export interface EventPack {
  key: "burning-man" | "afrikaburn";
  label: string;
  /** Where it happens, e.g. "Black Rock City, Nevada". */
  place: string;
  /** The site, for sunrise and sunset (day/night theme). */
  coords: { lat: number; lon: number };
  /** IANA time zone for every date and deadline. */
  timezone: string;
  /** Short label printed after camp times, e.g. "PT". */
  timezoneLabel: string;
  /** "us" = "Sat, Aug 29, 2027, 9:00 AM"; "day-first" = "Sat 29 Aug 2027, 09:00". */
  dateStyle: "us" | "day-first";
  /** Water planning: what each person needs per day, in the event's usual unit. */
  water?: { perPersonPerDay: number; unit: "gal" | "L"; source?: string };
  /** Fuel storage: the most stored fuel a camp may hold and how full a can may be, with a source. */
  fuel?: { storageLimit: number; maxFill: number; unit: "gal" | "L"; source: string };
  /** Currency tickets and fees are in (ISO 4217). */
  currency: string;
  year: number;
  /** The event itself: first and last day, YYYY-MM-DD (left out until known). */
  event?: { start: string; end: string; status: EventDateStatus; source: string };
  calendar: readonly EventCalendarEntry[];
  rules: readonly EventRule[];
  /** The event's own words, shown wherever the app talks about the event. */
  words: {
    /** "Burning Man" */
    name: string;
    /** Where camp is, e.g. "Black Rock City". */
    site: string;
    principles: { title: string; body: string };
    /** What a new member confirms about tickets. */
    ticketPlan: string;
    /** The early-arrival pass, e.g. "Setup Access Pass". */
    earlyPass: string;
    directions: { label: string; url: string };
  };
  /** Reading for someone going for the first time, in order. */
  firstTimer?: readonly { label: string; url: string }[];
  /**
   * How to bring a project the event licenses or registers (a mutant vehicle, open-playa art),
   * shown to camps with that camp pack. Windows are the event's usual ones, in plain words.
   */
  projects?: readonly EventProject[];
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
