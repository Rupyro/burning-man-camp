// Team reminders (option A, 27 Oct 2026): what's due per person in a team the actor leads, and a
// nudge that is a normal alert (type task.nudge) through the shared notification engine.
import { and, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import { ForbiddenError, ValidationError } from "../errors";
import { notifications, people, projects, tasks, teams } from "../schema";
import { notify } from "./notify";
import { groupReminders, isLate, nudgeAgainAt, nudgeTitle, type ReminderTask } from "./rules/nudge";
import { type EngineCtx, inTx, nowOf, parse } from "./shared";

const OPEN = ["todo", "in_progress", "blocked"] as const;

async function teamOf(ctx: EngineCtx, teamId: string) {
  const [team] = await ctx.db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.editionId, ctx.edition.id)));
  if (!team || !can(ctx.actor, "task.manage", { teamId: team.id })) throw new ForbiddenError();
  return team;
}

async function openTasks(db: EngineCtx["db"], teamId: string, personId?: string) {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      status: tasks.status,
      ownerPersonId: tasks.ownerPersonId,
      ownerName: people.displayName,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(people, eq(people.id, tasks.ownerPersonId))
    .where(
      and(
        eq(projects.teamId, teamId),
        inArray(tasks.status, [...OPEN]),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
        personId ? eq(tasks.ownerPersonId, personId) : undefined,
      ),
    );
  return rows.flatMap((r): ReminderTask[] =>
    r.ownerPersonId ? [{ ...r, ownerPersonId: r.ownerPersonId }] : [],
  );
}

async function lastNudges(db: EngineCtx["db"], teamId: string) {
  const rows = await db
    .select({ to: notifications.recipientPersonId, at: max(notifications.createdAt) })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, "task.nudge"),
        eq(notifications.entityType, "base.team"),
        eq(notifications.entityId, teamId),
      ),
    )
    .groupBy(notifications.recipientPersonId);
  return new Map(rows.flatMap((r) => (r.at ? [[r.to, r.at] as const] : [])));
}

/** Teams the actor may send reminders for (leads: theirs; camp leads and admins: all). */
export async function reminderTeams(ctx: EngineCtx) {
  const all = await ctx.db
    .select({ id: teams.id, key: teams.key, name: teams.name })
    .from(teams)
    .where(eq(teams.editionId, ctx.edition.id))
    .orderBy(teams.name);
  return all.filter((t) => can(ctx.actor, "task.manage", { teamId: t.id }));
}

export async function teamReminders(ctx: EngineCtx, teamId: string) {
  const team = await teamOf(ctx, teamId);
  const [rows, nudged] = await Promise.all([
    openTasks(ctx.db, team.id),
    lastNudges(ctx.db, team.id),
  ]);
  return { team, people: groupReminders(rows, nudged, nowOf(ctx)) };
}

const NudgeInput = z.object({ teamId: z.string().uuid(), personId: z.string().uuid() });

/** One alert to the person about their late tasks in this team. Refused within 2 days of the last. */
export async function nudgePerson(ctx: EngineCtx, raw: unknown) {
  const input = parse(NudgeInput, raw);
  const now = nowOf(ctx);
  if (input.personId === ctx.actor.personId) throw new ValidationError("You can't nudge yourself");
  return inTx(ctx.db, async (tx) => {
    const team = await teamOf({ ...ctx, db: tx }, input.teamId);
    const late = (await openTasks(tx, team.id, input.personId)).filter((t) => isLate(t, now));
    if (!late.length) throw new ValidationError("Nothing of theirs is late in this team");
    const again = nudgeAgainAt((await lastNudges(tx, team.id)).get(input.personId) ?? null, now);
    if (again) throw new ValidationError("Already nudged in the last 2 days");
    const lead = ctx.actor.displayName.replace(/ \(demo.*\)$/, "");
    await notify(tx, {
      recipientPersonId: input.personId,
      type: "task.nudge",
      entityType: "base.team",
      entityId: team.id,
      title: nudgeTitle(lead, team.name, late.length),
      body: late.map((t) => `• ${t.title}`).join("\n"),
      href: "/tasks",
      createdAt: now,
    });
    await recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      {
        action: "task.nudged",
        entity: { type: "base.team", id: team.id },
        changes: { personId: [null, input.personId], late: [null, late.length] },
        significance: "activity",
      },
    );
    return { late: late.length };
  });
}
