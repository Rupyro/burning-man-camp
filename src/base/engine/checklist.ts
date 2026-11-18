// Checklist items on a task (spec K1).
import { and, asc, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { firstRow } from "@/lib/rows";
import { can } from "../authz/permissions";
import { ForbiddenError } from "../errors";
import { taskAssignments, taskChecklistItems } from "../schema";
import { type EngineCtx, inTx, loadTask, nowOf, parse } from "./shared";
import { resourceOf } from "./tasks";

const label = z.string().trim().min(1).max(200);

async function loadItem(ctx: EngineCtx, itemId: string) {
  const [item] = await ctx.db
    .select()
    .from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.id, itemId), isNull(taskChecklistItems.deletedAt)));
  if (!item) throw new ForbiddenError();
  return { item, row: await loadTask(ctx.db, ctx.edition, item.taskId) };
}

/** Owner or a lead adds an item at the end of the list. */
export async function addChecklistItem(ctx: EngineCtx, taskId: string, raw: string) {
  const text = parse(label, raw);
  return inTx(ctx.db, async (tx) => {
    const row = await loadTask(tx, ctx.edition, taskId);
    if (!can(ctx.actor, "task.edit", resourceOf(row))) throw new ForbiddenError();
    const [last] = await tx
      .select({ n: max(taskChecklistItems.position) })
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, taskId));
    return firstRow(
      await tx
        .insert(taskChecklistItems)
        .values({ taskId, label: text, position: (last?.n ?? 0) + 1 })
        .returning({ id: taskChecklistItems.id }),
      "checklist item",
    );
  });
}

/** Spec K1. The owner, an active helper or a lead ticks or unticks an item. */
export async function tickChecklistItem(ctx: EngineCtx, itemId: string, done: boolean) {
  const { item, row } = await loadItem(ctx, itemId);
  let allowed = can(ctx.actor, "task.edit", resourceOf(row));
  if (!allowed && ctx.actor.personId && can(ctx.actor, "task.view")) {
    const [helping] = await ctx.db
      .select({ id: taskAssignments.id })
      .from(taskAssignments)
      .where(
        and(
          eq(taskAssignments.taskId, item.taskId),
          eq(taskAssignments.personId, ctx.actor.personId),
          eq(taskAssignments.status, "active"),
        ),
      );
    allowed = helping !== undefined;
  }
  if (!allowed) throw new ForbiddenError();
  await ctx.db
    .update(taskChecklistItems)
    .set({
      doneAt: done ? nowOf(ctx) : null,
      doneByPersonId: done ? ctx.actor.personId : null,
      updatedAt: nowOf(ctx),
      version: item.version + 1,
    })
    .where(eq(taskChecklistItems.id, itemId));
  return { done };
}

/** Owner or a lead removes an item (kept, marked deleted). */
export async function removeChecklistItem(ctx: EngineCtx, itemId: string) {
  const { row } = await loadItem(ctx, itemId);
  if (!can(ctx.actor, "task.edit", resourceOf(row))) throw new ForbiddenError();
  await ctx.db
    .update(taskChecklistItems)
    .set({ deletedAt: nowOf(ctx) })
    .where(eq(taskChecklistItems.id, itemId));
  return { ok: true };
}

export async function listChecklist(ctx: EngineCtx, taskId: string) {
  if (!can(ctx.actor, "task.view")) throw new ForbiddenError();
  await loadTask(ctx.db, ctx.edition, taskId);
  return ctx.db
    .select({
      id: taskChecklistItems.id,
      label: taskChecklistItems.label,
      doneAt: taskChecklistItems.doneAt,
      doneByPersonId: taskChecklistItems.doneByPersonId,
    })
    .from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.taskId, taskId), isNull(taskChecklistItems.deletedAt)))
    .orderBy(asc(taskChecklistItems.position));
}
