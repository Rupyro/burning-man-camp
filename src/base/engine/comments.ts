// Comments and watchers on a task (spec K2, K3).
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { firstRow } from "@/lib/rows";
import { can } from "../authz/permissions";
import { ForbiddenError } from "../errors";
import { people, taskComments, taskWatchers } from "../schema";
import { notify } from "./notify";
import { type EngineCtx, inTx, loadTask, nowOf, parse } from "./shared";
import { resourceOf } from "./tasks";

const body = z.string().trim().min(1).max(4000);

function me(ctx: EngineCtx, cap: "task.view" | "task.comment") {
  if (!can(ctx.actor, cap) || !ctx.actor.personId) throw new ForbiddenError();
  return ctx.actor.personId;
}

/**
 * Spec K2. Any confirmed member comments. The author and the task's owner become watchers;
 * every other watcher gets a "New comment" notification (digest by default).
 */
export async function addComment(ctx: EngineCtx, taskId: string, raw: string) {
  const author = me(ctx, "task.comment");
  const text = parse(body, raw);
  return inTx(ctx.db, async (tx) => {
    const row = await loadTask(tx, ctx.edition, taskId);
    const comment = firstRow(
      await tx
        .insert(taskComments)
        .values({ taskId, authorPersonId: author, body: text })
        .returning({ id: taskComments.id }),
      "comment",
    );
    const watchers = [author, row.task.ownerPersonId].filter((p): p is string => p !== null);
    await tx
      .insert(taskWatchers)
      .values(watchers.map((personId) => ({ taskId, personId })))
      .onConflictDoNothing();
    const others = await tx
      .select({ personId: taskWatchers.personId })
      .from(taskWatchers)
      .where(and(eq(taskWatchers.taskId, taskId), ne(taskWatchers.personId, author)));
    for (const w of others)
      await notify(tx, {
        recipientPersonId: w.personId,
        type: "task.comment",
        entityType: "base.task",
        entityId: taskId,
        title: `New comment: ${row.task.title}`,
        href: `/tasks/${taskId}`,
      });
    return comment;
  });
}

/** The author or a lead removes a comment (kept, marked deleted). */
export async function deleteComment(ctx: EngineCtx, commentId: string) {
  const [c] = await ctx.db
    .select()
    .from(taskComments)
    .where(and(eq(taskComments.id, commentId), isNull(taskComments.deletedAt)));
  if (!c) throw new ForbiddenError();
  const row = await loadTask(ctx.db, ctx.edition, c.taskId);
  const own = c.authorPersonId === ctx.actor.personId;
  if (!own && !can(ctx.actor, "task.manage", resourceOf(row))) throw new ForbiddenError();
  await ctx.db
    .update(taskComments)
    .set({ deletedAt: nowOf(ctx) })
    .where(eq(taskComments.id, commentId));
  return { ok: true };
}

export async function listComments(ctx: EngineCtx, taskId: string) {
  me(ctx, "task.view");
  await loadTask(ctx.db, ctx.edition, taskId);
  return ctx.db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      authorPersonId: taskComments.authorPersonId,
      authorName: people.displayName,
      createdAt: taskComments.createdAt,
    })
    .from(taskComments)
    .innerJoin(people, eq(people.id, taskComments.authorPersonId))
    .where(and(eq(taskComments.taskId, taskId), isNull(taskComments.deletedAt)))
    .orderBy(asc(taskComments.createdAt), asc(taskComments.id));
}

/** Spec K3. */
export async function watchTask(ctx: EngineCtx, taskId: string) {
  const personId = me(ctx, "task.view");
  await loadTask(ctx.db, ctx.edition, taskId);
  await ctx.db.insert(taskWatchers).values({ taskId, personId }).onConflictDoNothing();
  return { watching: true };
}

export async function unwatchTask(ctx: EngineCtx, taskId: string) {
  const personId = me(ctx, "task.view");
  await loadTask(ctx.db, ctx.edition, taskId);
  await ctx.db
    .delete(taskWatchers)
    .where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.personId, personId)));
  return { watching: false };
}

export async function listWatchers(ctx: EngineCtx, taskId: string) {
  me(ctx, "task.view");
  await loadTask(ctx.db, ctx.edition, taskId);
  const rows = await ctx.db
    .select({ personId: taskWatchers.personId })
    .from(taskWatchers)
    .where(eq(taskWatchers.taskId, taskId));
  return rows.map((r) => r.personId);
}
