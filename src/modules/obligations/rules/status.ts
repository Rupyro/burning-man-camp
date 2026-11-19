// Pure obligation rules (docs/specs/obligations.md §3): no db, no next.
import { formatCampDay } from "@/lib/dates";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type ObligationState = "done" | "cancelled" | "late" | "due_soon" | "no_owner" | "open";

export const DUE_SOON_DAYS = 14;
const DAY = 86_400_000;

export interface DueLabel {
  text: string;
  tentative: boolean;
}

/** "Fri 26 Feb" when confirmed; "TBC (2026: 28 Feb)" when not; "No date yet" without one. */
export function dueLabel(
  dueAt: Date | null,
  confirmed: boolean,
  previousYearDate: string | null,
): DueLabel {
  if (dueAt && confirmed) return { text: formatCampDay(dueAt, "EEE d MMM"), tentative: false };
  const prev = previousYearDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(previousYearDate) : null;
  if (prev) {
    const at = new Date(Date.UTC(Number(prev[1]), Number(prev[2]) - 1, Number(prev[3]), 12));
    return { text: `TBC (${prev[1]}: ${formatCampDay(at)})`, tentative: true };
  }
  if (dueAt) return { text: `TBC (${formatCampDay(dueAt)}?)`, tentative: true };
  return { text: "No date yet", tentative: true };
}

export interface StateInput {
  status: TaskStatus;
  dueAt: Date | null;
  ownerPersonId: string | null;
}

export function obligationState(o: StateInput, now: Date): ObligationState {
  if (o.status === "done") return "done";
  if (o.status === "cancelled") return "cancelled";
  if (o.dueAt && o.dueAt.getTime() < now.getTime()) return "late";
  if (o.dueAt && o.dueAt.getTime() - now.getTime() <= DUE_SOON_DAYS * DAY) return "due_soon";
  if (!o.ownerPersonId) return "no_owner";
  return "open";
}

const RANK: Record<ObligationState, number> = {
  late: 0,
  due_soon: 1,
  no_owner: 2,
  open: 3,
  done: 4,
  cancelled: 5,
};

/** Board order: late → due soon → no owner → open → done → cancelled, then by due date. */
export function sortForBoard<T extends StateInput>(rows: readonly T[], now: Date): T[] {
  const due = (r: T) => r.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...rows].sort(
    (a, b) => RANK[obligationState(a, now)] - RANK[obligationState(b, now)] || due(a) - due(b),
  );
}

export type BoardCounts = Record<"late" | "due_soon" | "no_owner" | "done" | "total", number>;

/** Header counts for the lead board. Cancelled ones don't count towards the total. */
export function boardCounts(rows: readonly StateInput[], now: Date): BoardCounts {
  const c: BoardCounts = { late: 0, due_soon: 0, no_owner: 0, done: 0, total: 0 };
  for (const r of rows) {
    const s = obligationState(r, now);
    if (s === "cancelled") continue;
    c.total += 1;
    if (s === "late" || s === "due_soon" || s === "done") c[s] += 1;
    if (!r.ownerPersonId && s !== "done") c.no_owner += 1;
  }
  return c;
}

export const STATE_LABEL: Record<ObligationState, string> = {
  done: "Submitted",
  cancelled: "Not needed",
  late: "Late",
  due_soon: "Due soon",
  no_owner: "No owner",
  open: "On track",
};

export const AUTHORITY_LABEL = {
  afrikaburn: "AfrikaBurn",
  burning_man: "Burning Man",
  dmv: "DMV",
  fuel_team: "Fuel team",
  sound_team: "Sound team",
  supplier_depot: "Supplier depot",
  quicket: "Quicket",
  internal: "Camp",
} as const;
