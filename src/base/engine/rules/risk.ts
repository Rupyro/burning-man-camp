// Pure: overdue / soon / at risk, from a task's status and due date (spec D4, S1).

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export const OPEN_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "blocked"];
const DAY = 86_400_000;
export const SOON_DAYS = 3;

export const isOpen = (status: TaskStatus) => OPEN_STATUSES.includes(status);

export function isOverdue(t: { status: TaskStatus; dueAt: Date | null }, now: Date): boolean {
  return isOpen(t.status) && t.dueAt !== null && t.dueAt.getTime() < now.getTime();
}

export function urgencyOf(
  t: { status: TaskStatus; dueAt: Date | null },
  now: Date,
): "overdue" | "soon" | "normal" {
  if (!isOpen(t.status) || !t.dueAt) return "normal";
  if (isOverdue(t, now)) return "overdue";
  return t.dueAt.getTime() - now.getTime() <= SOON_DAYS * DAY ? "soon" : "normal";
}

/** A task is at risk when any prerequisite isn't done and is overdue or blocked (PLAN §4.2). */
export function isAtRisk(
  prerequisites: readonly { status: TaskStatus; dueAt: Date | null }[],
  now: Date,
): boolean {
  return prerequisites.some((p) => p.status === "blocked" || isOverdue(p, now));
}
