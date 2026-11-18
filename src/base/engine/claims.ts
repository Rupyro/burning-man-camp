// Helpers on a task: leads add them, members claim open tasks (spec C1–C4, DATA_MODEL.md §3).
import { and, asc, count, eq, inArray, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { z } from "zod";
import { firstRow } from "@/lib/rows";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import { ForbiddenError, ValidationError } from "../errors";
import { claimModeEnum, people, projects, taskAssignments, tasks } from "../schema";
import { notify } from "./notify";
import { isOpen } from "./rules/risk";
import { assertConfirmedMember, type EngineCtx, inTx, loadTask, nowOf, parse } from "./shared";
import { resourceOf } from "./tasks";

const LIVE = ["pending_approval", "active"] as const;
type Tx = EngineCtx["db"];
type TaskRow = Awaited<ReturnType<typeof loadTask>>;

const audit = (
  ctx: EngineCtx,
  tx: Tx,
  action: string,
  taskId: string,
  changes: Record<string, [unknown, unknown]>,
) =>
  recordAudit(
    tx,
    { actor: ctx.actor, editionId: ctx.edition.id },
    { action, entity: { type: "base.task", id: taskId }, changes, significance: "activity" },
  );

/** Load the task and hold its row until commit, so two claims can't both take the last place. */
async function lockTask(ctx: EngineCtx, tx: Tx, taskId: string) {
  const row = await loadTask(tx, ctx.edition, taskId);
  await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).for("update");
  return row;
}

async function hasRoom(tx: Tx, row: TaskRow) {
  if (row.task.claimCapacity === null) return true;
  const [n] = await tx
    .select({ n: count() })
    .from(taskAssignments)
    .where(and(eq(taskAssignments.taskId, row.task.id), eq(taskAssignments.status, "active")));
  return (n?.n ?? 0) < row.task.claimCapacity;
}

async function assertNotOnTask(tx: Tx, row: TaskRow, personId: string, self: boolean) {
  if (row.task.ownerPersonId === personId)
    throw new ValidationError(self ? "You already own this task" : "They already own this task");
  const [live] = await tx
    .select({ id: taskAssignments.id })
    .from(taskAssignments)
    .where(
      and(
        eq(taskAssignments.taskId, row.task.id),
        eq(taskAssignments.personId, personId),
        inArray(taskAssignments.status, LIVE),
      ),
    );
  if (live)
    throw new ValidationError(
      self ? "You're already helping on this task" : "They're already helping on this task",
    );
}

const modeInput = z.strictObject({
  claimMode: z.enum(claimModeEnum.enumValues),
  claimCapacity: z.number().int().min(1).max(50).nullable(),
});

/** A lead opens a task for helpers (optionally with approval and a cap) or closes it. */
export async function setClaimMode(ctx: EngineCtx, taskId: string, raw: z.input<typeof modeInput>) {
  const input = parse(modeInput, raw);
  return inTx(ctx.db, async (tx) => {
    const row = await loadTask(tx, ctx.edition, taskId);
    if (!can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
    await tx
      .update(tasks)
      .set({ ...input, updatedAt: nowOf(ctx), version: row.task.version + 1 })
      .where(eq(tasks.id, taskId));
    await audit(ctx, tx, "task.updated", taskId, {
      claimMode: [row.task.claimMode, input.claimMode],
      claimCapacity: [row.task.claimCapacity, input.claimCapacity],
    });
    return { ok: true };
  });
}

/** Spec C1–C3. Any confirmed member may claim an open task with room. */
export async function claimTask(ctx: EngineCtx, taskId: string) {
  if (!can(ctx.actor, "task.claim") || !ctx.actor.personId) throw new ForbiddenError();
  const me = ctx.actor.personId;
  return inTx(ctx.db, async (tx) => {
    const row = await lockTask(ctx, tx, taskId);
    if (row.task.claimMode === "closed")
      throw new ValidationError("This task isn't open for helpers");
    if (!isOpen(row.task.status)) throw new ValidationError("This task is finished");
    await assertNotOnTask(tx, row, me, true);
    if (!(await hasRoom(tx, row)))
      throw new ValidationError("This task has all the helpers it needs");
    const status = row.task.claimMode === "open" ? "active" : "pending_approval";
    const a = firstRow(
      await tx
        .insert(taskAssignments)
        .values({ taskId, personId: me, source: "claimed", status })
        .returning({ id: taskAssignments.id }),
      "claim",
    );
    await audit(ctx, tx, "task.claimed", taskId, { status: [null, status] });
    return { assignmentId: a.id, status };
  });
}

/** A lead adds a helper directly (no approval step, not limited by the claim cap). */
export async function addHelper(ctx: EngineCtx, taskId: string, personId: string) {
  return inTx(ctx.db, async (tx) => {
    const row = await lockTask(ctx, tx, taskId);
    if (!can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
    await assertConfirmedMember(tx, ctx.edition, personId);
    await assertNotOnTask(tx, row, personId, false);
    await tx.insert(taskAssignments).values({
      taskId,
      personId,
      source: "assigned",
      status: "active",
      decidedByPersonId: ctx.actor.personId,
      decidedAt: nowOf(ctx),
    });
    await audit(ctx, tx, "task.helper_added", taskId, { personId: [null, personId] });
    return { ok: true };
  });
}

async function loadAssignment(ctx: EngineCtx, tx: Tx, assignmentId: string) {
  const [a] = await tx.select().from(taskAssignments).where(eq(taskAssignments.id, assignmentId));
  if (!a) throw new ForbiddenError();
  return { a, row: await lockTask(ctx, tx, a.taskId) };
}

/** Spec C2. A lead approves or declines a pending claim; never their own. */
export async function decideClaim(ctx: EngineCtx, assignmentId: string, approve: boolean) {
  return inTx(ctx.db, async (tx) => {
    const { a, row } = await loadAssignment(ctx, tx, assignmentId);
    if (!can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
    if (a.personId === ctx.actor.personId) throw new ForbiddenError();
    if (a.status !== "pending_approval")
      throw new ValidationError("That claim has already been decided");
    if (approve && !(await hasRoom(tx, row)))
      throw new ValidationError("This task has all the helpers it needs");
    const status = approve ? "active" : "declined";
    await tx
      .update(taskAssignments)
      .set({
        status,
        decidedByPersonId: ctx.actor.personId,
        decidedAt: nowOf(ctx),
        updatedAt: nowOf(ctx),
      })
      .where(eq(taskAssignments.id, assignmentId));
    await audit(ctx, tx, "claim.decided", a.taskId, {
      personId: [null, a.personId],
      status: [a.status, status],
    });
    await notify(tx, {
      recipientPersonId: a.personId,
      type: "claim.decided",
      entityType: "base.task",
      entityId: a.taskId,
      title: `Claim ${approve ? "approved" : "declined"}: ${row.task.title}`,
      href: `/tasks/${a.taskId}`,
    });
    return { status };
  });
}

/** Spec C4. A helper withdraws their own claim or help; a lead removes a helper. */
export async function withdrawClaim(ctx: EngineCtx, assignmentId: string) {
  return inTx(ctx.db, async (tx) => {
    const { a, row } = await loadAssignment(ctx, tx, assignmentId);
    const own = a.personId === ctx.actor.personId;
    if (!own && !can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
    if (a.status !== "pending_approval" && a.status !== "active")
      throw new ValidationError("That help has already ended");
    await tx
      .update(taskAssignments)
      .set({ status: "withdrawn", updatedAt: nowOf(ctx) })
      .where(eq(taskAssignments.id, assignmentId));
    await audit(ctx, tx, own ? "task.helper_withdrew" : "task.helper_removed", a.taskId, {
      personId: [null, a.personId],
      status: [a.status, "withdrawn"],
    });
    return { status: "withdrawn" as const };
  });
}

/** Pending and active helpers on a task, oldest first. */
export async function listHelpers(ctx: EngineCtx, taskId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  await loadTask(ctx.db, ctx.edition, taskId);
  return ctx.db
    .select({
      assignmentId: taskAssignments.id,
      personId: taskAssignments.personId,
      name: people.displayName,
      status: taskAssignments.status,
      source: taskAssignments.source,
    })
    .from(taskAssignments)
    .innerJoin(people, eq(people.id, taskAssignments.personId))
    .where(and(eq(taskAssignments.taskId, taskId), inArray(taskAssignments.status, LIVE)))
    .orderBy(asc(taskAssignments.createdAt), asc(taskAssignments.id));
}

const activeHelpers = sql<number>`(select count(*)::int from ${taskAssignments} where ${taskAssignments.taskId} = ${tasks.id} and ${taskAssignments.status} = 'active')`;

/** Open tasks I could claim: not closed, not finished or blocked, room left, not already mine. */
export async function listAvailableWork(ctx: EngineCtx) {
  if (!can(ctx.actor, "task.claim") || !ctx.actor.personId) throw new ForbiddenError();
  const me = ctx.actor.personId;
  return ctx.db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      claimMode: tasks.claimMode,
      claimCapacity: tasks.claimCapacity,
      helpers: activeHelpers,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.editionId, ctx.edition.id),
        isNull(tasks.deletedAt),
        ne(tasks.claimMode, "closed"),
        inArray(tasks.status, ["todo", "in_progress"]),
        or(isNull(tasks.ownerPersonId), ne(tasks.ownerPersonId, me)),
        or(isNull(tasks.claimCapacity), sql`${activeHelpers} < ${tasks.claimCapacity}`),
        notExists(
          ctx.db
            .select({ id: taskAssignments.id })
            .from(taskAssignments)
            .where(
              and(
                eq(taskAssignments.taskId, tasks.id),
                eq(taskAssignments.personId, me),
                inArray(taskAssignments.status, LIVE),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(tasks.dueAt), asc(tasks.title));
}
