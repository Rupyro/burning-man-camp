// Pure: team reminders (Ruchir picked option A, 27 Oct 2026). A lead sees what's due per person
// and can nudge someone about their late tasks; one nudge per person per team every 2 days.

export const NUDGE_WAIT_MS = 2 * 86_400_000;

export interface ReminderTask {
  id: string;
  title: string;
  dueAt: Date | null;
  status: string;
  ownerPersonId: string;
  ownerName: string;
}

export interface PersonReminders {
  personId: string;
  name: string;
  tasks: (ReminderTask & { late: boolean })[];
  lateCount: number;
  lastNudgedAt: Date | null;
  /** When the lead may nudge again; null = now (or nothing late to nudge about). */
  nudgeAgainAt: Date | null;
}

export const isLate = (t: { dueAt: Date | null }, now: Date) =>
  t.dueAt !== null && t.dueAt.getTime() < now.getTime();

/** Group by person, most late first, then most open, then name. Tasks: late first, then by due. */
export function groupReminders(
  tasks: readonly ReminderTask[],
  lastNudged: ReadonlyMap<string, Date>,
  now: Date,
): PersonReminders[] {
  const by = new Map<string, PersonReminders>();
  for (const t of tasks) {
    const p = by.get(t.ownerPersonId) ?? {
      personId: t.ownerPersonId,
      name: t.ownerName,
      tasks: [],
      lateCount: 0,
      lastNudgedAt: lastNudged.get(t.ownerPersonId) ?? null,
      nudgeAgainAt: null,
    };
    const late = isLate(t, now);
    p.tasks.push({ ...t, late });
    if (late) p.lateCount += 1;
    by.set(t.ownerPersonId, p);
  }
  const due = (t: { dueAt: Date | null }) => t.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...by.values()]
    .map((p) => ({
      ...p,
      tasks: p.tasks.sort((a, b) => Number(b.late) - Number(a.late) || due(a) - due(b)),
      nudgeAgainAt: nudgeAgainAt(p.lastNudgedAt, now),
    }))
    .sort(
      (a, b) =>
        b.lateCount - a.lateCount ||
        b.tasks.length - a.tasks.length ||
        a.name.localeCompare(b.name),
    );
}

/** null = may nudge now. */
export function nudgeAgainAt(lastNudgedAt: Date | null, now: Date): Date | null {
  if (!lastNudgedAt) return null;
  const at = new Date(lastNudgedAt.getTime() + NUDGE_WAIT_MS);
  return at.getTime() > now.getTime() ? at : null;
}

export const nudgeTitle = (lead: string, team: string, late: number) =>
  `${lead} nudged you: ${late} late ${late === 1 ? "task" : "tasks"} in ${team}`;
