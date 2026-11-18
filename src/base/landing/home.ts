// Home screen data (docs/specs/b3-home.md §3–4). Every list is filtered on the server.
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { can } from "../authz/permissions";
import { listAnchorDates } from "../editions/settings";
import { type EngineCtx, nowOf } from "../engine/shared";
import { notifications, people, projects, taskAssignments, tasks, teams } from "../schema";
import type { TeamPulse } from "./home-queue";
import { countdown, readinessPercent } from "./home-rules";

/** Offers to help that wait on me: pending claims on tasks I may manage, never my own. */
export async function listHelpRequests(ctx: EngineCtx) {
  const rows = await ctx.db
    .select({
      assignmentId: taskAssignments.id,
      taskId: tasks.id,
      taskTitle: tasks.title,
      ownerPersonId: tasks.ownerPersonId,
      teamId: projects.teamId,
      personId: taskAssignments.personId,
      personName: people.displayName,
    })
    .from(taskAssignments)
    .innerJoin(tasks, eq(tasks.id, taskAssignments.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(people, eq(people.id, taskAssignments.personId))
    .where(
      and(
        eq(tasks.editionId, ctx.edition.id),
        isNull(tasks.deletedAt),
        eq(taskAssignments.status, "pending_approval"),
      ),
    )
    .orderBy(taskAssignments.createdAt);
  return rows
    .filter(
      (r) =>
        r.personId !== ctx.actor.personId &&
        can(ctx.actor, "task.manage", { teamId: r.teamId, ownerPersonId: r.ownerPersonId }),
    )
    .map(({ assignmentId, taskId, taskTitle, personName }) => ({
      assignmentId,
      taskId,
      taskTitle,
      personName,
    }));
}

/** My unread notifications, newest first, and how many there are in total. */
export async function listUnread(ctx: EngineCtx, limit = 3) {
  const me = ctx.actor.personId;
  if (!me) return { items: [], count: 0 };
  const where = and(eq(notifications.recipientPersonId, me), isNull(notifications.readAt));
  const items = await ctx.db
    .select({
      id: notifications.id,
      title: notifications.title,
      href: notifications.href,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
  const [n] = await ctx.db.select({ n: count() }).from(notifications).where(where);
  return { items, count: n?.n ?? 0 };
}

export async function getCountdown(ctx: EngineCtx) {
  return countdown(await listAnchorDates(ctx.db, ctx.edition.id), nowOf(ctx));
}

/** Leads' "My team" block: late or blocked work and readiness, only for teams they may view. */
export async function getTeamBoard(ctx: EngineCtx, limit = 8) {
  if (!can(ctx.actor, "readiness.view")) return null;
  const allTeams = await ctx.db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.editionId, ctx.edition.id));
  const mine = allTeams.filter((t) => can(ctx.actor, "readiness.view", { teamId: t.id }));
  if (mine.length === 0) return null;
  const teamIds = mine.map((t) => t.id);
  const now = nowOf(ctx);
  const live = and(
    eq(tasks.editionId, ctx.edition.id),
    isNull(tasks.deletedAt),
    inArray(projects.teamId, teamIds),
  );

  const problems = await ctx.db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      blockedReason: tasks.blockedReason,
      dueAt: tasks.dueAt,
      ownerName: people.displayName,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(people, eq(people.id, tasks.ownerPersonId))
    .where(
      and(
        live,
        or(
          eq(tasks.status, "blocked"),
          and(inArray(tasks.status, ["todo", "in_progress"]), lt(tasks.dueAt, now)),
        ),
      ),
    )
    .orderBy(tasks.dueAt)
    .limit(limit);

  const counts = await ctx.db
    .select({
      id: projects.id,
      name: projects.name,
      done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(Number),
      total: sql<number>`count(*) filter (where ${tasks.status} <> 'cancelled')`.mapWith(Number),
    })
    .from(projects)
    .innerJoin(tasks, and(eq(tasks.projectId, projects.id), isNull(tasks.deletedAt)))
    .where(and(eq(projects.editionId, ctx.edition.id), inArray(projects.teamId, teamIds)))
    .groupBy(projects.id, projects.name)
    .orderBy(projects.name);

  return {
    teams: mine.map((t) => t.name),
    problems,
    projects: counts.map((p) => ({ ...p, percent: readinessPercent(p.done, p.total) })),
  };
}

/**
 * Per team I may view (camp leads: all): readiness (done / live tasks) and my team's late and
 * blocked work, for the lead home's summary rows and readiness panel (spec B3.1 §2).
 * Counts are exact; each team's task list is capped at `taskCap`. null for non-leads.
 */
export async function getTeamPulse(ctx: EngineCtx, taskCap = 20): Promise<TeamPulse[] | null> {
  if (!can(ctx.actor, "readiness.view")) return null;
  const allTeams = await ctx.db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.editionId, ctx.edition.id), isNull(teams.deletedAt)))
    .orderBy(teams.name);
  const mine = allTeams.filter((t) => can(ctx.actor, "readiness.view", { teamId: t.id }));
  if (mine.length === 0) return null;
  const teamIds = mine.map((t) => t.id);
  const now = nowOf(ctx);
  const live = and(
    eq(tasks.editionId, ctx.edition.id),
    isNull(tasks.deletedAt),
    inArray(projects.teamId, teamIds),
  );
  const isLate = and(inArray(tasks.status, ["todo", "in_progress"]), lt(tasks.dueAt, now));

  const [problems, counts] = await Promise.all([
    ctx.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        ownerName: people.displayName,
        projectName: projects.name,
        teamId: projects.teamId,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(people, eq(people.id, tasks.ownerPersonId))
      .where(and(live, or(eq(tasks.status, "blocked"), isLate)))
      .orderBy(sql`${tasks.status} = 'blocked'`, tasks.dueAt, tasks.title),
    ctx.db
      .select({
        teamId: projects.teamId,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(Number),
        total: sql<number>`count(*) filter (where ${tasks.status} <> 'cancelled')`.mapWith(Number),
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(live)
      .groupBy(projects.teamId),
  ]);

  return mine.map((t) => {
    const list = problems.filter((p) => p.teamId === t.id);
    const c = counts.find((x) => x.teamId === t.id);
    const done = c?.done ?? 0;
    const total = c?.total ?? 0;
    return {
      teamId: t.id,
      name: t.name,
      done,
      total,
      percent: readinessPercent(done, total),
      late: list.filter((p) => p.status !== "blocked").length,
      blocked: list.filter((p) => p.status === "blocked").length,
      tasks: list.slice(0, taskCap).map(({ teamId: _team, ...task }) => task),
    };
  });
}

/** How many tasks I own that are done (for the fun extras milestones and badges). */
export async function countMyFinished(ctx: EngineCtx): Promise<number> {
  if (!ctx.actor.personId) return 0;
  const [row] = await ctx.db
    .select({ n: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.editionId, ctx.edition.id),
        eq(tasks.ownerPersonId, ctx.actor.personId),
        eq(tasks.status, "done"),
        isNull(tasks.deletedAt),
      ),
    );
  return row?.n ?? 0;
}
