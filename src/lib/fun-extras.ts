// Fun extras: small, calm surprises (burn clock, milestones, badges, eggs). Pure logic here;
// the overlays are CSS transform/opacity only and stay off under reduced motion or Burn Mode.
import { CAMP_NAME } from "@/lib/camp";
import { CAMP_START_YEAR } from "@/lib/family-years";

export const FUN_KEY = "oe-fun";
export const FUN_CHANGE = "oe-fun-change";
export const BURN_DAYS = 9;

/** Fun extras are on unless the person switched them off on this device. */
export function funEnabled(raw: string | null | undefined): boolean {
  return raw !== "off";
}

/** "183 days to gates", then "Welcome home, day 3" during the burn, then nothing. */
export function burnClockLine(daysToGates: number | null): string | null {
  if (daysToGates === null) return null;
  if (daysToGates > 0) return `${daysToGates} ${daysToGates === 1 ? "day" : "days"} to gates`;
  const day = 1 - daysToGates;
  return day <= BURN_DAYS ? `Welcome home, day ${day}` : null;
}

/** The milestone (10, 20, 30...) reached since the last count this device saw, if any. */
export function milestoneCrossed(before: number | null, now: number): number | null {
  if (before === null || now <= before) return null;
  const m = Math.floor(now / 10) * 10;
  return m > before && m >= 10 ? m : null;
}

export function milestoneText(n: number) {
  const next = n % 100 === 0 ? `That's your ${n}th task!` : `Next celebration at ${n + 10}`;
  return { title: `${n} tasks finished!`, next };
}

export type Badge = { id: string; name: string; about: string; earned: (s: FunStats) => boolean };
/** years = camp years an admin confirmed (Oe-aa-sies Family), when the person has any. */
export type FunStats = { done: number; shifts: number; thanks: number; years?: number };

export const BADGES: readonly Badge[] = [
  {
    id: "first-shift",
    name: "First shift",
    about: "You signed up for your first shift.",
    earned: (s) => s.shifts >= 1,
  },
  {
    id: "tasks-10",
    name: "10 tasks finished",
    about: "You finished 10 tasks for camp.",
    earned: (s) => s.done >= 10,
  },
  {
    id: "tasks-50",
    name: "50 tasks finished",
    about: "You finished 50 tasks for camp.",
    earned: (s) => s.done >= 50,
  },
  {
    id: "tasks-100",
    name: "100 tasks finished",
    about: "You finished 100 tasks for camp.",
    earned: (s) => s.done >= 100,
  },
  {
    id: "first-thanks",
    name: "First thank-you",
    about: "Someone thanked you for your help.",
    earned: (s) => s.thanks >= 1,
  },
  {
    id: "strike",
    name: "Strike helper",
    about: "You helped pack up camp after the burn.",
    earned: () => false,
  },
  {
    id: "sunrise",
    name: "Sunrise crew",
    about: "You did an early morning shift.",
    earned: () => false,
  },
  {
    id: "container",
    name: "Container crew",
    about: "You helped load the container.",
    earned: () => false,
  },
  {
    id: "years-2",
    name: "2 years",
    about: `Two years on the path with ${CAMP_NAME}.`,
    earned: (s) => (s.years ?? 0) >= 2,
  },
  {
    id: "years-3",
    name: "3 years",
    about: `Three years on the path with ${CAMP_NAME}.`,
    earned: (s) => (s.years ?? 0) >= 3,
  },
  {
    id: "founding-family",
    name: "Founding family",
    about: `Four years or more: here since ${CAMP_NAME} began in ${CAMP_START_YEAR}.`,
    earned: (s) => (s.years ?? 0) >= 4,
  },
];

export function earnedBadges(s: FunStats): string[] {
  return BADGES.filter((b) => b.earned(s)).map((b) => b.id);
}

export const isSleepHour = (hour: number) => hour === 3;

/** Five quick taps on the logo (within the window) starts a dust storm. */
export class TapCounter {
  private taps: number[] = [];
  constructor(
    private readonly need: number,
    private readonly windowMs: number,
  ) {}
  tap(ms: number): boolean {
    this.taps = [...this.taps.filter((t) => ms - t < this.windowMs), ms];
    if (this.taps.length < this.need) return false;
    this.taps = [];
    return true;
  }
}

export const badgeLabel = (name: string, got: boolean) => (got ? name : `${name} (not earned yet)`);

/** What plays on this visit: the campfire for a new milestone, then the newest badge drops in. */
export function funPlan(before: string | null, done: number, known: string, earned: string[]) {
  const party = milestoneCrossed(before === null ? null : Number(before), done);
  const seen = known.split(",");
  const drop = before === null ? null : (earned.find((b) => !seen.includes(b)) ?? null);
  const dropAt = party ? 3000 : 0;
  return { party, drop, dropAt, settleAt: dropAt + 1600 };
}

export const funActive = (raw: string | null, reduced: boolean) => funEnabled(raw) && !reduced;
export const stormAllowed = (raw: string | null, burnOn: boolean) => funEnabled(raw) && !burnOn;

type Accel = { x?: number | null; y?: number | null; z?: number | null } | null | undefined;
/** A hard shake (summed acceleration over 40), at most once every 4 seconds. */
export function isShake(a: Accel, last: number, now: number): boolean {
  if (!a || now - last <= 4000) return false;
  return Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0) > 40;
}

/** The playa name rises out of the dust once for each new name. */
export const revealPlaya = (on: boolean, seen: string | null, name: string) => on && seen !== name;

export const flipFun = (enabled: boolean) => ({ next: !enabled, store: enabled ? "off" : null });

export function badgeClass(got: boolean, fresh: boolean, empty: boolean): string {
  return ["fun-badge", got ? "" : "is-locked", fresh ? "is-fresh" : "", empty ? "is-empty" : ""]
    .filter(Boolean)
    .join(" ");
}

/** The demo member is kept at 9 finished tasks, so finishing one more shows the campfire. */
export const DEMO_DONE_TARGET = 9;
export const demoDoneTopUp = (current: number) => Math.max(0, DEMO_DONE_TARGET - current);

/** In demo mode the badge row sits just under the demo strip, so "Viewing as" stays readable. */
export const badgeRowTop = (demo: boolean) => (demo ? "1.5rem" : "0");

/** Where the falling badge lands: the same top edge as the badge row, so it settles in its slot. */
export const dropTarget = (demo: boolean) => ({ "--fun-top": demo ? badgeRowTop(true) : "0px" });

/** How many slots the top row shows before the rest go behind a "+N" slot. */
export const ROW_MAX = 8;
export type BadgeRowView = { ids: string[]; more: number };

/** The badges the row shows: earned (and the one dropping in) first, then locked, then "+N". */
export function badgeRow(earned: readonly string[], drop: string | null): BadgeRowView {
  const all = BADGES.map((b) => b.id);
  if (all.length <= ROW_MAX) return { ids: all, more: 0 };
  const keep = ROW_MAX - 1;
  const want = new Set(earned);
  const picked = all.filter((id) => want.has(id)).slice(0, keep);
  if (drop && all.includes(drop) && !picked.includes(drop)) {
    if (picked.length >= keep) picked.pop();
    picked.push(drop);
  }
  for (const id of all) if (picked.length < keep && !picked.includes(id)) picked.push(id);
  const ids = all.filter((id) => picked.includes(id));
  const lit = ids.filter((id) => want.has(id) || id === drop);
  return { ids: [...lit, ...ids.filter((id) => !lit.includes(id))], more: all.length - keep };
}

/** Sideways offset from the row's centre to a badge's slot (22px slots, 4px gap, +N counts). */
export function dropSlotX(id: string, row: BadgeRowView): string {
  const i = row.ids.indexOf(id);
  if (i < 0) return "0px";
  const slots = row.ids.length + (row.more ? 1 : 0);
  return `${(i - (slots - 1) / 2) * 26}px`;
}
