"use server";
// Needs: raise, move, flag critical, ask finance for the money (docs/specs/procurement.md §3, §6).
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionContext,
  can,
  ForbiddenError,
  type ModuleContext,
  moduleAction,
  ValidationError,
} from "@/base/api";
import { projects } from "@/base/api/schema";
import { campInputToInstant } from "@/lib/dates";
import { haveIt } from "../rules/have-it";
import { canMove, isOpen, NEED_STATUSES, type NeedStatus } from "../rules/status";
import { procurementItems as items, procurementNeeds as needs } from "../schema";
import { getNeed, needResource, stockFor } from "./queries";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-01");
const id = z.object({ id: z.string().uuid() });
const buyingProject = (year: number) => `Kit and buying ${year}`;

function quantity(text: string): number {
  const n = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 99_999_999 || text.trim() === "")
    throw new ValidationError("Use a number more than 0, like 4");
  return Math.round(n * 100) / 100;
}

function randCents(text: string | undefined): number | null {
  if (text === undefined || text.trim() === "") return null;
  const clean = text.trim().replace(/^R\s?/i, "").replaceAll(",", "").replaceAll(" ", "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean))
    throw new ValidationError("Use an amount like 4500 or R4,500");
  const c = Math.round(Number(clean) * 100);
  if (c <= 0 || c > 100_000_000_00) throw new ValidationError("Use an amount more than R0");
  return c;
}

const needRes = (input: { id: string }, ctx: ModuleContext) =>
  needResource(ctx.db, ctx.edition.id, input.id);

async function load(ctx: ActionContext, needId: string) {
  await ctx.tx.execute(sql`select 1 from ${needs} where ${needs.id} = ${needId} for update`);
  const row = await getNeed(ctx.tx, ctx.edition.id, needId);
  if (!row) throw new ForbiddenError();
  return row;
}

async function usableNow(ctx: ActionContext, itemId: string) {
  const [item] = await ctx.tx.select().from(items).where(eq(items.id, itemId));
  if (!item || item.deletedAt) throw new ValidationError("Pick an item from the catalogue");
  const lines = (await stockFor(ctx.tx, [itemId])).get(itemId) ?? [];
  return { item, lines };
}

/** The converter's "buy it" base task, on the team's "Kit and buying <year>" project. */
async function ensureBuyTask(
  ctx: ActionContext,
  row: {
    id: string;
    teamId: string;
    itemName: string;
    quantityNeeded: number;
    unit: string;
    neededBy: string | null;
    taskId: string | null;
  },
  gap: number,
) {
  if (row.taskId) return row.taskId;
  const [existing] = await ctx.tx
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.editionId, ctx.edition.id),
        eq(projects.teamId, row.teamId),
        eq(projects.name, buyingProject(ctx.edition.year)),
        isNull(projects.deletedAt),
      ),
    );
  let projectId = existing?.id ?? null;
  if (!projectId && can(ctx.actor, "project.manage", { teamId: row.teamId })) {
    const team = ctx.actor.teams.find((t) => t.teamId === row.teamId);
    if (team)
      projectId = (
        await ctx.tasks.ensureProject({
          teamKey: team.teamKey,
          name: buyingProject(ctx.edition.year),
          description: "Kit the team has to buy or borrow (Kit and stock module).",
        })
      ).id;
  }
  if (!projectId) return null;
  const task = await ctx.tasks.create({
    projectId,
    title: `Buy ${gap} ${row.unit} ${row.itemName}`,
    kind: "procurement.buy",
    dueAt: row.neededBy ? campInputToInstant(row.neededBy, "12:00") : null,
    ownerPersonId: ctx.actor.personId,
    source: { refType: "procurement.need", refId: row.id },
  });
  return task.id;
}

async function closeTask(
  ctx: ActionContext,
  row: { taskId: string | null; teamId: string },
  done: boolean,
) {
  if (!row.taskId) return;
  const lead = can(ctx.actor, "task.manage", { teamId: row.teamId, ownerPersonId: null });
  await ctx.tasks.update(row.taskId, { status: done || !lead ? "done" : "cancelled" });
}

/** A team member raises a need for their team. The have-it check is snapshotted. */
export const raiseNeed = moduleAction(
  "procurement",
  {
    input: z.object({
      teamId: z.string().uuid(),
      itemId: z.string().uuid(),
      quantity: z.string().max(20),
      neededBy: dateOnly.optional(),
      notes: z.string().max(1000).optional(),
    }),
    capability: "procurement.need.raise",
    resource: async (input) => ({ teamId: input.teamId }),
  },
  async (ctx, input) => {
    const q = quantity(input.quantity);
    const { item, lines } = await usableNow(ctx, input.itemId);
    const check = haveIt(q, lines, item.ownerLabel);
    const [row] = await ctx.tx
      .insert(needs)
      .values({
        editionId: ctx.edition.id,
        teamId: input.teamId,
        itemId: input.itemId,
        quantityNeeded: q,
        quantityOnHandSnapshot: check.usable,
        neededBy: input.neededBy ?? null,
        notes: input.notes ?? null,
        raisedByPersonId: ctx.actor.personId,
        ownerPersonId: ctx.actor.personId,
      })
      .returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "procurement.need.raised",
      entity: { type: "procurement.need", id: row.id },
      changes: { status: [null, "needed"], quantity: [null, q] },
    });
    return { ok: true as const, id: row.id, check };
  },
);

/** Leads move a need by hand (have it, to buy, to borrow, ordered, received, cancelled). */
export const moveNeed = moduleAction(
  "procurement",
  {
    input: id.extend({ to: z.enum(NEED_STATUSES) }),
    capability: "procurement.need.manage",
    resource: needRes,
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    if (input.to === "purchase_requested")
      throw new ValidationError("Use “Ask finance for the money” for that");
    if (!canMove(row.status, input.to))
      throw new ValidationError(`Can't go from ${row.status} to ${input.to}`);
    await ctx.tx
      .update(needs)
      .set({ status: input.to, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(needs.id, row.id));
    if (!isOpen(input.to)) await closeTask(ctx, row, input.to === "received");
    await ctx.audit.record({
      action: "procurement.need.moved",
      entity: { type: "procurement.need", id: row.id },
      changes: { status: [row.status, input.to] },
      significance: input.to === "received" || input.to === "cancelled" ? "significant" : undefined,
    });
    return { ok: true as const, status: input.to as NeedStatus };
  },
);

/** Leads flag a need critical (P6). Turning it on tells logistics (an unassigned load item). */
export const setCritical = moduleAction(
  "procurement",
  {
    input: id.extend({ critical: z.boolean() }),
    capability: "procurement.need.manage",
    resource: needRes,
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    if (row.isCritical === input.critical) return { ok: true as const, changed: false };
    if (!isOpen(row.status)) throw new ValidationError("This need is closed");
    await ctx.tx
      .update(needs)
      .set({ isCritical: input.critical, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(needs.id, row.id));
    await ctx.audit.record({
      action: "procurement.need.critical_changed",
      entity: { type: "procurement.need", id: row.id },
      changes: { isCritical: [row.isCritical, input.critical] },
      significance: "significant",
    });
    if (input.critical)
      await ctx.events.emit("procurement.need.marked_critical", {
        v: 1,
        needId: row.id,
        teamId: row.teamId,
        itemName: row.itemName,
        quantity: row.quantityNeeded,
        unit: row.unit,
        neededBy: row.neededBy,
        editionId: ctx.edition.id,
      });
    return { ok: true as const, changed: true };
  },
);

/**
 * Turn the gap into a spend request (P5): the need goes to "asked finance", the converter gets a
 * "buy it" task, and Finance drafts a request for them from the event. With Finance off the
 * need just waits there for a lead to handle by hand.
 */
export const askFinance = moduleAction(
  "procurement",
  {
    input: id.extend({ estimate: z.string().max(40).optional() }),
    capability: "procurement.need.manage",
    resource: needRes,
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    if (row.status !== "needed" && row.status !== "to_buy")
      throw new ValidationError("Only a need that's still to buy can go to finance");
    if (row.check.gap <= 0) throw new ValidationError("We already have enough of this");
    const estimateCents = randCents(input.estimate) ?? row.estimateCents;
    if (!estimateCents) throw new ValidationError("Add a rough amount so finance can draft it");
    const taskId = await ensureBuyTask(ctx, row, row.check.gap);
    await ctx.tx
      .update(needs)
      .set({
        status: "purchase_requested",
        estimateCents,
        taskId,
        ownerPersonId: row.ownerPersonId ?? ctx.actor.personId,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(needs.id, row.id));
    await ctx.audit.record({
      action: "procurement.need.purchase_requested",
      entity: { type: "procurement.need", id: row.id },
      changes: {
        status: [row.status, "purchase_requested"],
        estimateCents: [row.estimateCents, estimateCents],
      },
      significance: "significant",
    });
    await ctx.events.emit("procurement.need.purchase_requested", {
      v: 1,
      needId: row.id,
      teamId: row.teamId,
      itemName: row.itemName,
      quantity: row.check.gap,
      unit: row.unit,
      estimateCents,
      requesterPersonId: ctx.actor.personId ?? "",
      neededBy: row.neededBy,
      editionId: ctx.edition.id,
    });
    return { ok: true as const, taskId };
  },
);

/** The raiser (while it's still "needed") or a lead edits quantity, date, supplier, estimate, notes. */
export const editNeed = moduleAction(
  "procurement",
  {
    input: id.extend({
      quantity: z.string().max(20).optional(),
      neededBy: dateOnly.nullable().optional(),
      supplierId: z.string().uuid().nullable().optional(),
      estimate: z.string().max(40).optional(),
      notes: z.string().max(1000).nullable().optional(),
    }),
    capability: "procurement.view",
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    const lead = can(ctx.actor, "procurement.need.manage", { teamId: row.teamId });
    const raiser = row.raisedByPersonId === ctx.actor.personId && row.status === "needed";
    if (!lead && !raiser) throw new ForbiddenError();
    if (!isOpen(row.status)) throw new ValidationError("This need is closed");
    const patch: Partial<typeof needs.$inferInsert> = {};
    if (input.quantity !== undefined) patch.quantityNeeded = quantity(input.quantity);
    if (input.neededBy !== undefined) patch.neededBy = input.neededBy;
    if (input.supplierId !== undefined) patch.supplierId = input.supplierId;
    if (input.estimate !== undefined) patch.estimateCents = randCents(input.estimate);
    if (input.notes !== undefined) patch.notes = input.notes;
    const changes: Record<string, [unknown, unknown]> = {};
    const before: Record<string, unknown> = {
      quantityNeeded: row.quantityNeeded,
      neededBy: row.neededBy,
      estimateCents: row.estimateCents,
      notes: row.notes,
    };
    for (const [k, v] of Object.entries(patch))
      if (before[k] !== v) changes[k] = [before[k] ?? null, v];
    await ctx.tx
      .update(needs)
      .set({ ...patch, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(needs.id, row.id));
    await ctx.audit.record({
      action: "procurement.need.edited",
      entity: { type: "procurement.need", id: row.id },
      changes,
    });
    return { ok: true as const };
  },
);
