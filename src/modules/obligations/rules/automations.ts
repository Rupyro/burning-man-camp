// AfrikaBurn deadline reminders (automation plan rule 15). Pure: facts in, reminders out.
// Overdue → camp lead on day 1 and "confirm the date" already exist (base alerts, my-items).
import type { ReminderCandidate } from "@/contracts/automations";
import { daysSince, stageReached } from "@/lib/days";

/** Days before the deadline: the owner at 30, 14 and 7; the team leads at 7 and 2. */
export const OWNER_DAYS_BEFORE = [30, 14, 7] as const;
export const LEAD_DAYS_BEFORE = [7, 2] as const;

export interface DeadlineFact {
  taskId: string;
  title: string;
  dueAt: Date;
  ownerPersonId: string | null;
  /** Documents on the checklist not ticked yet. */
  missingDocuments: readonly string[];
}

/** The closest "days before" stage reached: 30/14/7 with 10 days left → 14. */
const stageBefore = (left: number, stages: readonly number[]) =>
  stageReached(
    -left,
    stages.map((d) => -d),
  );

export function deadlineReminders(
  deadlines: readonly DeadlineFact[],
  leadIds: readonly string[],
  now: Date,
): ReminderCandidate[] {
  const out: ReminderCandidate[] = [];
  for (const d of deadlines) {
    const left = daysSince(now, d.dueAt);
    if (left < 0) continue; // overdue is the base alert's job
    const docs = d.missingDocuments.length
      ? `; still needed: ${d.missingDocuments.join(", ")}`
      : "";
    const base = {
      rule: "obligations.deadline" as const,
      entityType: "obligations.obligation",
      entityId: d.taskId,
      title: `${d.title} is due in ${left} day${left === 1 ? "" : "s"}${docs}`,
      href: `/obligations/${d.taskId}`,
      priority: left <= 7 ? 0 : 2,
    };
    const owner = stageBefore(left, OWNER_DAYS_BEFORE);
    if (owner !== null && d.ownerPersonId)
      out.push({ ...base, personId: d.ownerPersonId, stage: `d-${-owner}` });
    const lead = stageBefore(left, LEAD_DAYS_BEFORE);
    if (lead !== null)
      for (const personId of leadIds.filter((id) => id !== d.ownerPersonId))
        out.push({ ...base, personId, stage: `d-${-lead}` });
  }
  return out;
}
