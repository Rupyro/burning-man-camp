"use server";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ForbiddenError, moduleAction } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { obligationDetails, obligationDocuments } from "../schema";
import { getObligation, listDocuments, obligationOwner } from "./queries";

const id = z.object({ taskId: z.string().uuid() });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-26");
/** Deadlines are noon camp time on the day, so the date reads the same everywhere. */
const toDue = (d: string) => campInputToInstant(d, "12:00");

async function load(ctx: Parameters<Parameters<typeof moduleAction>[2]>[0], taskId: string) {
  const row = await getObligation(ctx.tx, ctx.edition.id, taskId);
  if (!row) throw new ForbiddenError();
  return row;
}

/** Make the checklist exactly `names`, in order; documents that stay keep their ticks. */
async function syncDocuments(
  ctx: Parameters<Parameters<typeof moduleAction>[2]>[0],
  taskId: string,
  names: string[],
) {
  const d = obligationDocuments;
  await ctx.tx
    .delete(d)
    .where(
      names.length ? and(eq(d.taskId, taskId), notInArray(d.name, names)) : eq(d.taskId, taskId),
    );
  if (!names.length) return;
  await ctx.tx
    .insert(d)
    .values(names.map((name, position) => ({ taskId, position, name })))
    .onConflictDoUpdate({ target: [d.taskId, d.name], set: { position: sql`excluded.position` } });
}

export const updateObligation = moduleAction(
  "obligations",
  {
    input: id.extend({
      dueDate: dateOnly.nullable().optional(),
      dateConfirmed: z.boolean().optional(),
      ownerPersonId: z.string().uuid().nullable().optional(),
      sourceUrl: z.string().url().max(500).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      requiredDocuments: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    }),
    capability: "obligations.manage",
  },
  async (ctx, input) => {
    const before = await load(ctx, input.taskId);
    if (input.dueDate !== undefined)
      await ctx.tasks.update(input.taskId, { dueAt: input.dueDate ? toDue(input.dueDate) : null });
    if (input.ownerPersonId !== undefined)
      await ctx.tasks.setOwner(input.taskId, input.ownerPersonId);
    const set: Partial<typeof obligationDetails.$inferInsert> = {};
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of ["dateConfirmed", "sourceUrl", "notes"] as const) {
      const v = input[k];
      if (v === undefined || v === before[k]) continue;
      Object.assign(set, { [k]: v });
      changes[k] = [before[k], v];
    }
    if (input.requiredDocuments) {
      const was = (await listDocuments(ctx.tx, input.taskId)).map((d) => d.name);
      const next = [...new Set(input.requiredDocuments)];
      if (was.join("\n") !== next.join("\n")) {
        await syncDocuments(ctx, input.taskId, next);
        changes.requiredDocuments = [was, next];
      }
    }
    if (Object.keys(changes).length) {
      await ctx.tx
        .update(obligationDetails)
        .set({ ...set, updatedAt: ctx.now, version: before.version + 1 })
        .where(eq(obligationDetails.taskId, input.taskId));
      await ctx.audit.record({
        action: "obligations.obligation.updated",
        entity: { type: "obligations.obligation", id: input.taskId },
        changes,
        significance: "significant",
      });
    }
    return { ok: true as const };
  },
);

export const markSubmitted = moduleAction(
  "obligations",
  {
    input: id.extend({ confirmationRef: z.string().trim().max(80).nullable().optional() }),
    capability: "obligations.submit",
    resource: (input, mctx) => obligationOwner(mctx.db, mctx.edition.id, input.taskId),
  },
  async (ctx, { taskId, confirmationRef }) => {
    const before = await load(ctx, taskId);
    if (before.status === "done") return { ok: true as const, changed: false };
    const ref = confirmationRef || null;
    await ctx.tx
      .update(obligationDetails)
      .set({
        submittedAt: ctx.now,
        confirmationRef: ref,
        updatedAt: ctx.now,
        version: before.version + 1,
      })
      .where(eq(obligationDetails.taskId, taskId));
    await ctx.tasks.update(taskId, { status: "done" });
    await ctx.audit.record({
      action: "obligations.obligation.submitted",
      entity: { type: "obligations.obligation", id: taskId },
      changes: { submittedAt: [null, ctx.now.toISOString()], confirmationRef: [null, ref] },
      significance: "significant",
    });
    await ctx.events.emit("obligations.obligation.submitted", {
      v: 1,
      taskId,
      editionId: ctx.edition.id,
      confirmationRef: ref,
    });
    return { ok: true as const, changed: true };
  },
);

export const reopenObligation = moduleAction(
  "obligations",
  { input: id, capability: "obligations.manage" },
  async (ctx, { taskId }) => {
    const before = await load(ctx, taskId);
    if (before.status !== "done") return { ok: true as const, changed: false };
    await ctx.tasks.update(taskId, { status: "todo" });
    await ctx.tx
      .update(obligationDetails)
      .set({ submittedAt: null, updatedAt: ctx.now, version: before.version + 1 })
      .where(eq(obligationDetails.taskId, taskId));
    await ctx.audit.record({
      action: "obligations.obligation.reopened",
      entity: { type: "obligations.obligation", id: taskId },
      changes: { submittedAt: [before.submittedAt?.toISOString() ?? null, null] },
      significance: "significant",
    });
    return { ok: true as const, changed: true };
  },
);
