// "B can't start until A is done" links between tasks (spec D1–D4, DATA_MODEL.md §3).
import { and, eq, inArray, sql } from "drizzle-orm";
import { recordAudit } from "../audit/audit";
import { can } from "../authz/permissions";
import { ForbiddenError, ValidationError } from "../errors";
import { taskDependencies, tasks } from "../schema";
import { findCycle } from "./rules/dependencies";
import { isAtRisk } from "./rules/risk";
import { type EngineCtx, inTx, loadTask, nowOf } from "./shared";
import { resourceOf } from "./tasks";

export interface DependencyInput {
  /** The task that waits. */
  taskId: string;
  /** The task it waits on. */
  dependsOnTaskId: string;
}

async function loadPair(ctx: EngineCtx, tx: EngineCtx["db"], input: DependencyInput) {
  const row = await loadTask(tx, ctx.edition, input.taskId);
  if (!can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
  const prereq = await loadTask(tx, ctx.edition, input.dependsOnTaskId);
  return { row, prereq };
}

const audit = (ctx: EngineCtx, tx: EngineCtx["db"], action: string, input: DependencyInput) =>
  recordAudit(
    tx,
    { actor: ctx.actor, editionId: ctx.edition.id },
    {
      action,
      entity: { type: "base.task", id: input.taskId },
      changes: { dependsOnTaskId: [null, input.dependsOnTaskId] },
      significance: "activity",
    },
  );

/**
 * Spec D1–D3. A lead of the waiting task's team links it; the prerequisite may belong to any
 * team. Loops are refused, naming them. The edition's links are checked inside the insert
 * transaction under a per-edition lock, so two people can't close a loop at the same time.
 * (Same result as the recursive query sketched in DATA_MODEL.md §3, done in TypeScript.)
 */
export async function addDependency(ctx: EngineCtx, input: DependencyInput) {
  return inTx(ctx.db, async (tx) => {
    const { row, prereq } = await loadPair(ctx, tx, input);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`task_deps:${ctx.edition.id}`}))`);
    const edges = await tx
      .select({
        taskId: taskDependencies.taskId,
        dependsOnTaskId: taskDependencies.dependsOnTaskId,
      })
      .from(taskDependencies)
      .innerJoin(tasks, eq(tasks.id, taskDependencies.taskId))
      .where(eq(tasks.editionId, ctx.edition.id));
    if (edges.some((e) => e.taskId === input.taskId && e.dependsOnTaskId === input.dependsOnTaskId))
      return { added: false };
    const loop = findCycle(edges, input);
    if (loop) {
      const titles = await tx
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.id, loop));
      const name = new Map(titles.map((t) => [t.id, t.title]));
      throw new ValidationError(
        `That would create a loop: ${loop.map((id) => name.get(id) ?? "?").join(" → ")}`,
        [{ path: "dependsOnTaskId", message: "That would create a loop" }],
      );
    }
    await tx
      .insert(taskDependencies)
      .values({ taskId: row.task.id, dependsOnTaskId: prereq.task.id });
    await audit(ctx, tx, "task.dependency_added", input);
    return { added: true };
  });
}

export async function removeDependency(ctx: EngineCtx, input: DependencyInput) {
  return inTx(ctx.db, async (tx) => {
    await loadPair(ctx, tx, input);
    const gone = await tx
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, input.taskId),
          eq(taskDependencies.dependsOnTaskId, input.dependsOnTaskId),
        ),
      )
      .returning({ id: taskDependencies.id });
    if (gone.length === 0) return { removed: false };
    await audit(ctx, tx, "task.dependency_removed", input);
    return { removed: true };
  });
}

const linked = {
  id: tasks.id,
  title: tasks.title,
  status: tasks.status,
  dueAt: tasks.dueAt,
  ownerPersonId: tasks.ownerPersonId,
};

/** Spec D4. What a task waits on, what waits on it, and whether it's at risk. */
export async function listDependencies(ctx: EngineCtx, taskId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  await loadTask(ctx.db, ctx.edition, taskId);
  const prerequisites = await ctx.db
    .select(linked)
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnTaskId))
    .where(eq(taskDependencies.taskId, taskId))
    .orderBy(tasks.dueAt);
  const dependents = await ctx.db
    .select(linked)
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.taskId))
    .where(eq(taskDependencies.dependsOnTaskId, taskId))
    .orderBy(tasks.dueAt);
  return { prerequisites, dependents, atRisk: isAtRisk(prerequisites, nowOf(ctx)) };
}
