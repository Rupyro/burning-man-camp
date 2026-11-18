// The alerts job: evaluate the pure base rules over this edition's open tasks, store each
// (rule, task, level, fingerprint) once, and notify its recipients (spec A1–A7, PLAN.md §4.3).
import { and, eq, inArray, isNotNull, isNull, max } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import type { EditionRef } from "../editions/current";
import {
  alertRules,
  alertStates,
  people,
  projects,
  taskComments,
  taskDependencies,
  tasks,
} from "../schema";
import { getAutomationSettings } from "../settings/automation";
import { notify } from "./notify";
import { roleHolderIds, teamLeadIds } from "./recipients";
import {
  type AlertFact,
  type AlertHours,
  alertHours,
  evaluateTaskAlerts,
  parseAlertParams,
  type StalledFact,
  stalledTaskAlerts,
  type TaskAlert,
} from "./rules/alerts";
import { isAtRisk } from "./rules/risk";
import { immediateEscalationKinds, ownDueSoonKinds } from "./shared";

const OPEN = ["todo", "in_progress", "blocked"] as const;

async function loadFacts(db: DbOrTx, edition: EditionRef, now: Date): Promise<AlertFact[]> {
  const rows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      status: tasks.status,
      kind: tasks.kind,
      isCritical: tasks.isCritical,
      dueAt: tasks.dueAt,
      ownerPersonId: tasks.ownerPersonId,
      teamId: projects.teamId,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.editionId, edition.id),
        isNull(tasks.deletedAt),
        inArray(tasks.status, OPEN),
        isNotNull(tasks.dueAt),
      ),
    );
  if (!rows.length) return [];
  const prereqs = await db
    .select({ taskId: taskDependencies.taskId, status: tasks.status, dueAt: tasks.dueAt })
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
    .where(
      inArray(
        taskDependencies.taskId,
        rows.map((r) => r.taskId),
      ),
    );
  const immediate = immediateEscalationKinds();
  const ownDueSoon = ownDueSoonKinds();
  return rows.map((r) => ({
    ...r,
    escalateImmediately: immediate.has(r.kind),
    ownDueSoon: ownDueSoon.has(r.kind),
    prerequisiteRisk: isAtRisk(
      prereqs.filter((p) => p.taskId === r.taskId),
      now,
    ),
  }));
}

/** Rule 5: owned open tasks with when they were last touched (task edit or newest comment). */
async function loadStalled(db: DbOrTx, edition: EditionRef): Promise<StalledFact[]> {
  const lastComment = db
    .select({ taskId: taskComments.taskId, at: max(taskComments.createdAt).as("at") })
    .from(taskComments)
    .groupBy(taskComments.taskId)
    .as("last_comment");
  const rows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      status: tasks.status,
      ownerPersonId: tasks.ownerPersonId,
      ownerName: people.displayName,
      teamId: projects.teamId,
      dueAt: tasks.dueAt,
      updatedAt: tasks.updatedAt,
      commentAt: lastComment.at,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(people, eq(people.id, tasks.ownerPersonId))
    .leftJoin(lastComment, eq(lastComment.taskId, tasks.id))
    .where(
      and(
        eq(tasks.editionId, edition.id),
        isNull(tasks.deletedAt),
        inArray(tasks.status, ["todo", "in_progress"]),
        isNotNull(tasks.ownerPersonId),
        eq(tasks.kind, "task"),
      ),
    );
  return rows.map(({ updatedAt, commentAt, ...r }) => ({
    ...r,
    touchedAt:
      commentAt && new Date(commentAt).getTime() > updatedAt.getTime()
        ? new Date(commentAt)
        : updatedAt,
  }));
}

/** Level 1 = the project team's leads and co-leads; level 2 = camp_lead role holders. */
function recipientsOf(db: DbOrTx, edition: EditionRef, now: Date) {
  const teamLeads = new Map<string, Promise<string[]>>();
  let campLeads: Promise<string[]> | undefined;
  return (alert: TaskAlert): Promise<string[]> => {
    if (alert.to === "owner")
      return Promise.resolve(alert.ownerPersonId ? [alert.ownerPersonId] : []);
    if (alert.to === "team_leads") {
      const cached = teamLeads.get(alert.teamId) ?? teamLeadIds(db, alert.teamId);
      teamLeads.set(alert.teamId, cached);
      return cached;
    }
    campLeads ??= roleHolderIds(db, "camp_lead", edition, now);
    return campLeads;
  };
}

/** A6: open alert states of finished tasks are resolved. */
async function resolveFinished(db: DbOrTx, edition: EditionRef, now: Date) {
  const finished = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.editionId, edition.id), inArray(tasks.status, ["done", "cancelled"])));
  const rows = await db
    .update(alertStates)
    .set({ resolvedAt: now })
    .where(
      and(
        eq(alertStates.entityType, "base.task"),
        isNull(alertStates.resolvedAt),
        inArray(alertStates.entityId, finished),
      ),
    )
    .returning({ id: alertStates.id });
  return rows.length;
}

/** A module rule's hour thresholds from alert_rules (key "<module>.<rule>"), else its defaults. */
export async function loadAlertHours(
  db: DbOrTx,
  key: string,
  defaults: Omit<AlertHours, "enabled">,
): Promise<AlertHours> {
  const [row] = await db.select().from(alertRules).where(eq(alertRules.key, key));
  return alertHours(row, defaults);
}

export async function runAlerts(db: DbOrTx, edition: EditionRef, now: Date) {
  const resolved = await resolveFinished(db, edition, now);
  const params = parseAlertParams(await db.select().from(alertRules));
  const facts = await loadFacts(db, edition, now);
  const recipients = recipientsOf(db, edition, now);
  const quietDays = (await getAutomationSettings(db)).task_quiet_days ?? 7;
  const stalled = stalledTaskAlerts(await loadStalled(db, edition), now, quietDays);
  let fired = 0;
  let notified = 0;
  for (const alert of [...evaluateTaskAlerts(facts, now, params), ...stalled]) {
    const [state] = await db
      .insert(alertStates)
      .values({
        ruleKey: alert.rule,
        entityType: "base.task",
        entityId: alert.taskId,
        level: alert.level,
        fingerprint: alert.fingerprint,
        firstFiredAt: now,
        lastFiredAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: alertStates.id });
    if (!state) continue; // A5: already fired for this rule, level and due date
    fired++;
    for (const personId of await recipients(alert)) {
      const n = await notify(db, {
        recipientPersonId: personId,
        type: `task.${alert.rule}`,
        entityType: "base.task",
        entityId: alert.taskId,
        title: alert.title,
        href: alert.href,
        alertStateId: state.id,
      });
      if (n) notified++;
    }
  }
  return { tasks: facts.length, fired, notified, resolved };
}
