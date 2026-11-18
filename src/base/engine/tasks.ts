import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "../audit/audit";
import { can, type TaskResource } from "../authz/permissions";
import { ForbiddenError, ValidationError } from "../errors";
import { people, priorityEnum, projects, taskAssignments, taskStatusEnum, tasks } from "../schema";
import { notify } from "./notify";
import { isOpen, urgencyOf } from "./rules/risk";
import { statusPatch } from "./rules/status";
import {
  allowedTaskKinds,
  assertConfirmedMember,
  type EngineCtx,
  inTx,
  loadProject,
  loadTask,
  nowOf,
  parse,
  rule,
} from "./shared";

const audit =
  (ctx: EngineCtx, tx: EngineCtx["db"]) =>
  (action: string, id: string, changes: Record<string, [unknown, unknown]>) =>
    recordAudit(
      tx,
      { actor: ctx.actor, editionId: ctx.edition.id },
      { action, entity: { type: "base.task", id }, changes, significance: "activity" },
    );

/** Spec T7: tell a new owner, unless they gave the task to themselves. */
async function tellOwner(
  ctx: EngineCtx,
  tx: EngineCtx["db"],
  taskId: string,
  title: string,
  owner: string | null,
) {
  if (!owner || owner === ctx.actor.personId) return;
  await notify(tx, {
    recipientPersonId: owner,
    type: "task.assigned",
    entityType: "base.task",
    entityId: taskId,
    title: `Assigned to you: ${title}`,
    href: `/tasks/${taskId}`,
  });
}

const taskInput = z.strictObject({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(8000).nullable().optional(),
  kind: z.string().max(40).optional(),
  priority: z.enum(priorityEnum.enumValues).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
  isCritical: z.boolean().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  source: z.object({ refType: z.string().max(40), refId: z.string().uuid() }).optional(),
});

/**
 * Spec T2, T6: task.create on the project's team. Setting someone else as owner needs
 * task.manage (a member may take a new task themselves).
 */
export async function createTask(ctx: EngineCtx, raw: z.input<typeof taskInput>) {
  const input = parse(taskInput, raw);
  const kind = input.kind ?? "task";
  if (!allowedTaskKinds().has(kind)) throw new ValidationError(`Unknown task kind "${kind}"`);
  return inTx(ctx.db, async (tx) => {
    const project = await loadProject(tx, ctx.edition, input.projectId);
    const team = { teamId: project.teamId };
    if (!can(ctx.actor, "task.create", team)) throw new ForbiddenError();
    const owner = input.ownerPersonId ?? null;
    if (owner && owner !== ctx.actor.personId && !can(ctx.actor, "task.manage", team))
      throw new ForbiddenError();
    if (owner) await assertConfirmedMember(tx, ctx.edition, owner);
    if (input.parentTaskId) {
      const parent = await loadTask(tx, ctx.edition, input.parentTaskId);
      if (parent.task.projectId !== project.id) throw new ForbiddenError();
    }
    const { source, ...fields } = input;
    const [t] = await tx
      .insert(tasks)
      .values({
        ...fields,
        kind,
        ownerPersonId: owner,
        editionId: ctx.edition.id,
        sourceRefType: source?.refType ?? null,
        sourceRefId: source?.refId ?? null,
      })
      .returning({ id: tasks.id });
    if (!t) throw new Error("task insert returned nothing");
    await audit(ctx, tx)("task.created", t.id, {
      title: [null, input.title],
      ownerPersonId: [null, owner],
    });
    await tellOwner(ctx, tx, t.id, input.title, owner);
    return t;
  });
}

const patchInput = z.strictObject({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(8000).nullable().optional(),
  priority: z.enum(priorityEnum.enumValues).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  status: z.enum(taskStatusEnum.enumValues).optional(),
  blockedReason: z.string().max(500).nullable().optional(),
  isCritical: z.boolean().optional(),
  location: z.string().max(120).nullable().optional(),
});

export const resourceOf = (row: {
  teamId: string;
  task: { ownerPersonId: string | null };
}): TaskResource => ({
  teamId: row.teamId,
  ownerPersonId: row.task.ownerPersonId,
});

/** Spec T3–T5: task.edit (owner or a lead); cancelling and criticality need task.manage. */
export async function updateTask(ctx: EngineCtx, taskId: string, raw: z.input<typeof patchInput>) {
  const input = parse(patchInput, raw);
  return inTx(ctx.db, async (tx) => {
    const row = await loadTask(tx, ctx.edition, taskId);
    const r = resourceOf(row);
    if (!can(ctx.actor, "task.edit", r)) throw new ForbiddenError();
    const managerOnly = input.status === "cancelled" || input.isCritical !== undefined;
    if (managerOnly && !can(ctx.actor, "task.manage", r)) throw new ForbiddenError();
    const before = row.task;
    const { status, blockedReason, ...rest } = input;
    const set: Partial<typeof tasks.$inferInsert> = { ...rest };
    if (status !== undefined || blockedReason !== undefined) {
      Object.assign(
        set,
        rule(() =>
          statusPatch(
            before,
            status ?? before.status,
            blockedReason ?? before.blockedReason,
            nowOf(ctx),
          ),
        ),
      );
    }
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(set)) {
      const was = before[k as keyof typeof before];
      const same =
        was instanceof Date && v instanceof Date ? was.getTime() === v.getTime() : was === v;
      if (!same)
        changes[k] = [
          was instanceof Date ? was.toISOString() : was,
          v instanceof Date ? v.toISOString() : v,
        ];
    }
    if (!Object.keys(changes).length) return { changed: false };
    await tx
      .update(tasks)
      .set({ ...set, updatedAt: nowOf(ctx), version: before.version + 1 })
      .where(eq(tasks.id, taskId));
    await audit(ctx, tx)(changes.status ? "task.status_changed" : "task.updated", taskId, changes);
    return { changed: true };
  });
}

/** Spec T7: task.manage. The new owner must be a confirmed member (null = unowned). */
export async function setTaskOwner(ctx: EngineCtx, taskId: string, ownerPersonId: string | null) {
  return inTx(ctx.db, async (tx) => {
    const row = await loadTask(tx, ctx.edition, taskId);
    if (!can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
    if (row.task.ownerPersonId === ownerPersonId) return { changed: false };
    if (ownerPersonId) await assertConfirmedMember(tx, ctx.edition, ownerPersonId);
    await tx
      .update(tasks)
      .set({ ownerPersonId, updatedAt: nowOf(ctx), version: row.task.version + 1 })
      .where(eq(tasks.id, taskId));
    await audit(ctx, tx)("task.owner_changed", taskId, {
      ownerPersonId: [row.task.ownerPersonId, ownerPersonId],
    });
    await tellOwner(ctx, tx, taskId, row.task.title, ownerPersonId);
    return { changed: true };
  });
}

const listColumns = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  kind: tasks.kind,
  dueAt: tasks.dueAt,
  priority: tasks.priority,
  ownerPersonId: tasks.ownerPersonId,
  ownerName: people.displayName,
  projectId: tasks.projectId,
  projectName: projects.name,
  claimMode: tasks.claimMode,
  isCritical: tasks.isCritical,
};
type ListRow = { [K in keyof typeof listColumns]: (typeof listColumns)[K]["_"]["data"] | null };

function withUrgency<T extends { status: ListRow["status"]; dueAt: Date | null }>(
  rows: T[],
  now: Date,
) {
  return rows.map((r) => ({
    ...r,
    urgency: urgencyOf({ status: r.status ?? "todo", dueAt: r.dueAt }, now),
  }));
}

const RANK = { overdue: 0, soon: 1, normal: 2 } as const;
const byUrgency = (a: { urgency: keyof typeof RANK; dueAt: Date | null }, b: typeof a) =>
  RANK[a.urgency] - RANK[b.urgency] ||
  (a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) -
    (b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY);

function baseList(ctx: EngineCtx) {
  return ctx.db
    .select(listColumns)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(people, eq(people.id, tasks.ownerPersonId));
}

/** Spec S2: a project's live tasks (task.view), by due date. */
export async function listProjectTasks(ctx: EngineCtx, projectId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  await loadProject(ctx.db, ctx.edition, projectId);
  const rows = await baseList(ctx)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.dueAt), asc(tasks.createdAt));
  return withUrgency(rows, nowOf(ctx));
}

/** Spec S1: open tasks I own or help on, overdue first, then by due date. */
export async function listMyTasks(ctx: EngineCtx) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  const me = ctx.actor.personId ?? "";
  const helping = ctx.db
    .select({ id: taskAssignments.taskId })
    .from(taskAssignments)
    .where(and(eq(taskAssignments.personId, me), eq(taskAssignments.status, "active")));
  const rows = await baseList(ctx).where(
    and(
      eq(tasks.editionId, ctx.edition.id),
      isNull(tasks.deletedAt),
      inArray(tasks.status, ["todo", "in_progress", "blocked"]),
      or(eq(tasks.ownerPersonId, me), inArray(tasks.id, helping)),
    ),
  );
  return withUrgency(rows, nowOf(ctx)).sort(byUrgency);
}

/** Spec S3: one task, with what the caller may do (computed here, re-checked by each action). */
export async function getTask(ctx: EngineCtx, taskId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  const row = await loadTask(ctx.db, ctx.edition, taskId);
  const r = resourceOf(row);
  const [owner] = row.task.ownerPersonId
    ? await ctx.db
        .select({ name: people.displayName })
        .from(people)
        .where(eq(people.id, row.task.ownerPersonId))
    : [];
  return {
    ...row.task,
    ownerName: owner?.name ?? null,
    urgency: urgencyOf(row.task, nowOf(ctx)),
    open: isOpen(row.task.status),
    project: { id: row.task.projectId, name: row.projectName, teamId: row.teamId },
    can: {
      edit: can(ctx.actor, "task.edit", r),
      manage: can(ctx.actor, "task.manage", r),
      comment: can(ctx.actor, "task.comment"),
      claim: can(ctx.actor, "task.claim"),
    },
  };
}
