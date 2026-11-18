"use server";
// Spend requests: save, submit, decide, cancel (docs/specs/finance.md §3, §6).
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionContext,
  can,
  ForbiddenError,
  getAutomationSettings,
  moduleAction,
  ValidationError,
} from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { autoApprovable } from "../rules/automations";
import { DECISION_NEXT_STEPS, DECISION_REASONS, decisionProblem } from "../rules/decision-reasons";
import { parseRand } from "../rules/money";
import { canDecideStep, pickPolicy } from "../rules/policy";
import { afterDecision, canCancel, canEdit } from "../rules/status";
import { financeBudgets, financeRequestSteps, financeSpendRequests } from "../schema";
import { nextRef } from "./next-ref";
import {
  budgetOf,
  getRequest,
  lastRoundOf,
  listPolicies,
  pendingStepOf,
  requestResource,
  spendingProject,
  spendingProjectOf,
  summaryFor,
} from "./queries";

const r = financeSpendRequests;
const st = financeRequestSteps;

/** Undecided steps of a round that ended (sent back, turned down, cancelled) never happen. */
const dropPending = (ctx: ActionContext, requestId: string) =>
  ctx.tx.delete(st).where(and(eq(st.spendRequestId, requestId), eq(st.status, "pending")));
const id = z.object({ id: z.string().uuid() });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-01");
const rand = z.string().max(40);

/** Rand text → cents, or a friendly validation error. */
function cents(amount: string): number {
  const c = parseRand(amount);
  if (c === null) throw new ValidationError("Use an amount like 4500 or R4,500.50");
  return c;
}

async function load(ctx: ActionContext, requestId: string) {
  await ctx.tx.execute(sql`select 1 from ${r} where ${r.id} = ${requestId} for update`);
  const row = await getRequest(ctx.tx, ctx.edition.id, requestId);
  if (!row) throw new ForbiddenError();
  return row;
}

function mine(ctx: ActionContext, row: { requesterPersonId: string }) {
  if (row.requesterPersonId !== ctx.actor.personId) throw new ForbiddenError();
}

/** The requester's "buy it and add the receipt" base task, in their team's spending project. */
async function ensureTask(
  ctx: ActionContext,
  row: {
    id: string;
    teamId: string;
    refCode: string;
    title: string;
    neededBy: string | null;
    taskId: string | null;
  },
) {
  if (row.taskId) return row.taskId;
  let project = await spendingProjectOf(ctx.tx, ctx.edition.id, row.teamId, ctx.edition.year);
  if (!project && can(ctx.actor, "project.manage", { teamId: row.teamId })) {
    const [team] = ctx.actor.teams.filter((t) => t.teamId === row.teamId);
    project = await ctx.tasks.ensureProject({
      teamKey: team?.teamKey ?? "",
      name: spendingProject(ctx.edition.year),
      description: "Approved spending: buy it and add the receipt (Money module).",
    });
  }
  if (!project) return null;
  const task = await ctx.tasks.create({
    projectId: project.id,
    title: `${row.refCode}: buy “${row.title}” and add the receipt`,
    kind: "finance.purchase",
    dueAt: row.neededBy ? campInputToInstant(row.neededBy, "12:00") : null,
    ownerPersonId: ctx.actor.personId,
    source: { refType: "finance.spend_request", refId: row.id },
  });
  return task.id;
}

/**
 * Close the requester's task when the request ends without a purchase. The base lets only team
 * leads cancel tasks, so for everyone else it's marked done (nothing left to do).
 */
async function closeTask(ctx: ActionContext, row: { taskId: string | null; teamId: string }) {
  if (!row.taskId) return;
  const lead = can(ctx.actor, "task.manage", { teamId: row.teamId, ownerPersonId: null });
  await ctx.tasks.update(row.taskId, { status: lead ? "cancelled" : "done" });
}

async function submit(ctx: ActionContext, requestId: string) {
  const row = await load(ctx, requestId);
  mine(ctx, row);
  if (!canEdit(row.status)) throw new ValidationError("This request was already sent");
  const summary = await summaryFor(ctx.tx, ctx.edition.id, [row.teamId]);
  const remaining = summary.rows[0]?.remainingCents ?? 0;
  const policy = pickPolicy(
    await listPolicies(ctx.tx, ctx.edition.id),
    row.estimatedCents,
    remaining,
  );
  if (!policy?.requiredSteps.length)
    throw new ValidationError("No approval rule fits this amount. Ask finance.");
  const taskId = await ensureTask(ctx, row);
  const limit = (await getAutomationSettings(ctx.tx)).auto_approve_limit_cents ?? 0;
  // "Under" the limit, so the limit itself still waits for a person. 0 turns the rule off.
  if (
    limit > 0 &&
    row.estimatedCents < limit &&
    autoApprovable(row.estimatedCents, remaining, limit)
  )
    return approveSmall(ctx, row, policy.id, taskId);
  const round = (await lastRoundOf(ctx.tx, row.id)) + 1;
  await ctx.tx.insert(st).values(
    policy.requiredSteps.map((p, position) => ({
      spendRequestId: row.id,
      round,
      position,
      approverKind: p.approverKind,
      roleId: p.roleId,
      requesterPersonId: row.requesterPersonId,
      createdAt: ctx.now,
    })),
  );
  await ctx.tx
    .update(r)
    .set({
      status: "submitted",
      policyId: policy.id,
      submittedAt: ctx.now,
      taskId,
      updatedAt: ctx.now,
      version: row.version + 1,
    })
    .where(eq(r.id, row.id));
  await ctx.audit.record({
    action: "finance.spend.submitted",
    entity: { type: "finance.spend_request", id: row.id },
    changes: { status: [row.status, "submitted"], policy: [null, policy.name] },
    significance: "significant",
  });
  return { ok: true as const, id: row.id, refCode: row.refCode };
}

/** Rule 3: under the camp's limit and within budget, so no approver step. Audited and announced
 * like any other decision; the treasurer sees it in "Approved this week without you". */
async function approveSmall(
  ctx: ActionContext,
  row: Awaited<ReturnType<typeof load>>,
  policyId: string,
  taskId: string | null,
) {
  await ctx.tx
    .update(r)
    .set({
      status: "approved",
      autoApproved: true,
      policyId,
      submittedAt: ctx.now,
      decidedAt: ctx.now,
      taskId,
      updatedAt: ctx.now,
      version: row.version + 1,
    })
    .where(eq(r.id, row.id));
  await ctx.audit.record({
    action: "finance.spend.auto_approved",
    entity: { type: "finance.spend_request", id: row.id },
    changes: { status: [row.status, "approved"], estimatedCents: [null, row.estimatedCents] },
    significance: "significant",
  });
  await ctx.events.emit("finance.spend.decided", {
    v: 1,
    spendRequestId: row.id,
    refCode: row.refCode,
    decision: "approved",
    editionId: ctx.edition.id,
    ...(row.sourceRefType && row.sourceRefId
      ? { source: { refType: row.sourceRefType, refId: row.sourceRefId } }
      : {}),
  });
  return { ok: true as const, id: row.id, refCode: row.refCode };
}

const fields = z.object({
  teamId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  amount: rand,
  justification: z.string().trim().max(2000).nullable().optional(),
  supplierName: z.string().trim().max(120).nullable().optional(),
  neededBy: dateOnly.nullable().optional(),
  submit: z.boolean().optional(),
});

/** New request (draft, or straight to approval with submit: true). */
export const createRequest = moduleAction(
  "finance",
  {
    input: fields,
    capability: "finance.spend.request",
    resource: (i) => Promise.resolve({ teamId: i.teamId }),
  },
  async (ctx, input) => {
    const amount = cents(input.amount);
    const budget = await budgetOf(ctx.tx, ctx.edition.id, input.teamId);
    if (!budget) throw new ValidationError("This team has no budget yet. Ask finance to set one.");
    const ref = await nextRef(ctx);
    const [row] = await ctx.tx
      .insert(r)
      .values({
        editionId: ctx.edition.id,
        ...ref,
        budgetId: budget.id,
        teamId: input.teamId,
        requesterPersonId: ctx.actor.personId ?? "",
        title: input.title,
        justification: input.justification || null,
        estimatedCents: amount,
        supplierName: input.supplierName || null,
        neededBy: input.neededBy || null,
      })
      .returning({ id: r.id });
    const newId = row?.id ?? "";
    await ctx.audit.record({
      action: "finance.spend.created",
      entity: { type: "finance.spend_request", id: newId },
      changes: { refCode: [null, ref.refCode], estimatedCents: [null, amount] },
      significance: "significant",
    });
    if (input.submit) return submit(ctx, newId);
    return { ok: true as const, id: newId, refCode: ref.refCode };
  },
);

/** Edit a draft or a sent-back request (requester only); optionally resubmit. */
export const editRequest = moduleAction(
  "finance",
  {
    input: fields.omit({ teamId: true }).extend({ id: z.string().uuid() }),
    capability: "finance.spend.view",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    mine(ctx, row);
    if (!canEdit(row.status))
      throw new ValidationError("Only drafts and sent-back requests can change");
    const next = {
      title: input.title,
      justification: input.justification || null,
      estimatedCents: cents(input.amount),
      supplierName: input.supplierName || null,
      neededBy: input.neededBy || null,
    };
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(next)) {
      const before = row[k as keyof typeof next];
      if (before !== v) changes[k] = [before, v];
    }
    await ctx.tx
      .update(r)
      .set({ ...next, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(r.id, row.id));
    if (Object.keys(changes).length)
      await ctx.audit.record({
        action: "finance.spend.edited",
        entity: { type: "finance.spend_request", id: row.id },
        changes,
        significance: "significant",
      });
    if (input.submit) return submit(ctx, row.id);
    return { ok: true as const, id: row.id, refCode: row.refCode };
  },
);

export const submitRequest = moduleAction(
  "finance",
  {
    input: id,
    capability: "finance.spend.view",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  (ctx, input) => submit(ctx, input.id),
);

/** Approve, send back or turn down the current step. Never your own (capability + DB check). */
export const decideRequest = moduleAction(
  "finance",
  {
    input: id.extend({
      decision: z.enum(["approved", "rejected", "needs_info"]),
      /** Step 2. Omitted = the first reason for approve; ask / reject without one = "other". */
      reason: z.enum(DECISION_REASONS).optional(),
      /** Step 3, only for some reasons. */
      next: z.enum(DECISION_NEXT_STEPS).nullable().optional(),
      capAmount: rand.nullable().optional(),
      moveToBudgetId: z.string().uuid().nullable().optional(),
      comment: z.string().trim().max(1000).nullable().optional(),
    }),
    capability: "finance.spend.approve",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    const step = {
      approver: row.waitingOn ?? "none",
      requesterId: row.requesterPersonId,
      teamId: row.teamId,
    };
    if (!canDecideStep(ctx.actor, step)) throw new ForbiddenError();
    const pending = await pendingStepOf(ctx.tx, row.id);
    if (row.status !== "submitted" || !pending)
      throw new ValidationError("This request isn't waiting for a decision");
    const reason = input.reason ?? (input.decision === "approved" ? "within_budget" : "other");
    const next = input.next ?? null;
    const capAmountCents = next === "cap_amount" && input.capAmount ? cents(input.capAmount) : null;
    const moveToBudgetId = next === "move_budget" ? (input.moveToBudgetId ?? null) : null;
    const problem = decisionProblem({
      decision: input.decision,
      reason,
      next,
      note: input.comment,
      capAmountCents,
      moveToBudgetId,
    });
    if (problem)
      throw new ValidationError(
        reason === "other" && input.decision !== "approved"
          ? "Pick a reason, or say why, so the requester knows what to do"
          : problem,
      );
    if (moveToBudgetId) {
      const [b] = await ctx.tx
        .select({ id: financeBudgets.id })
        .from(financeBudgets)
        .where(
          and(eq(financeBudgets.id, moveToBudgetId), eq(financeBudgets.editionId, ctx.edition.id)),
        );
      if (!b) throw new ValidationError("Pick a budget from this year");
    }
    await ctx.tx
      .update(st)
      .set({
        status: input.decision,
        decidedByPersonId: ctx.actor.personId ?? "",
        comment: input.comment || null,
        reasonCode: reason,
        nextStep: next,
        capAmountCents,
        movedToBudgetId: moveToBudgetId,
        decidedAt: ctx.now,
      })
      .where(and(eq(st.id, pending.id), eq(st.status, "pending")));
    const status = afterDecision((await pendingStepOf(ctx.tx, row.id)) !== null, input.decision);
    if (status !== "submitted") await dropPending(ctx, row.id);
    const final = status === "approved" || status === "rejected";
    await ctx.tx
      .update(r)
      .set({
        status,
        decidedAt: final ? ctx.now : null,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(and(eq(r.id, row.id), eq(r.version, row.version)));
    await ctx.audit.record({
      action: "finance.spend.decided",
      entity: { type: "finance.spend_request", id: row.id },
      changes: {
        status: [row.status, status],
        step: [null, pending.position],
        decision: [null, input.decision],
        reason: [null, reason],
        next: [null, next],
      },
      significance: "significant",
    });
    if (final)
      await ctx.events.emit("finance.spend.decided", {
        v: 1,
        spendRequestId: row.id,
        refCode: row.refCode,
        decision: status,
        editionId: ctx.edition.id,
        ...(row.sourceRefType && row.sourceRefId
          ? { source: { refType: row.sourceRefType, refId: row.sourceRefId } }
          : {}),
      });
    return { ok: true as const, status };
  },
);

/** Requester, after "Resubmit lower" or "Move to the right budget": a new draft, copied so
 * nothing is retyped (moved budget's team, and the cap as the amount when one was set). */
export const resubmitCopy = moduleAction(
  "finance",
  {
    input: id,
    capability: "finance.spend.request",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    if (row.requesterPersonId !== ctx.actor.personId) throw new ForbiddenError();
    if (row.status !== "rejected")
      throw new ValidationError("Only a turned-down request can be resubmitted");
    const [last] = await ctx.tx
      .select()
      .from(st)
      .where(and(eq(st.spendRequestId, row.id), eq(st.status, "rejected")))
      .orderBy(sql`${st.decidedAt} desc`)
      .limit(1);
    if (!last || (last.nextStep !== "resubmit_lower" && last.nextStep !== "move_budget"))
      throw new ValidationError("This one wasn't sent back for resubmitting");
    let budgetId = row.budgetId;
    let teamId = row.teamId;
    if (last.nextStep === "move_budget" && last.movedToBudgetId) {
      const [b] = await ctx.tx
        .select({ id: financeBudgets.id, teamId: financeBudgets.teamId })
        .from(financeBudgets)
        .where(eq(financeBudgets.id, last.movedToBudgetId));
      if (!b?.teamId) throw new ValidationError("That budget isn't a team budget");
      budgetId = b.id;
      teamId = b.teamId;
    }
    const ref = await nextRef(ctx);
    const [copy] = await ctx.tx
      .insert(r)
      .values({
        editionId: ctx.edition.id,
        ...ref,
        budgetId,
        teamId,
        requesterPersonId: row.requesterPersonId,
        title: row.title,
        justification: row.justification,
        estimatedCents: row.estimatedCents,
        supplierName: row.supplierName,
        neededBy: row.neededBy,
      })
      .returning({ id: r.id });
    const newId = copy?.id ?? "";
    await ctx.audit.record({
      action: "finance.spend.created",
      entity: { type: "finance.spend_request", id: newId },
      changes: { refCode: [null, ref.refCode], copiedFrom: [null, row.refCode] },
      significance: "significant",
    });
    return { ok: true as const, id: newId, refCode: ref.refCode };
  },
);

/** Requester: cancel (until bought), or put away a turned-down one. Closes their task. */
export const cancelRequest = moduleAction(
  "finance",
  {
    input: id,
    capability: "finance.spend.view",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  async (ctx, input) => {
    const row = await load(ctx, input.id);
    mine(ctx, row);
    if (row.status === "rejected") {
      await closeTask(ctx, row);
      return { ok: true as const, status: row.status };
    }
    if (!canCancel(row.status)) throw new ValidationError("It's already bought or closed");
    await ctx.tx
      .update(r)
      .set({ status: "cancelled", updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(r.id, row.id));
    await dropPending(ctx, row.id);
    await closeTask(ctx, row);
    await ctx.audit.record({
      action: "finance.spend.cancelled",
      entity: { type: "finance.spend_request", id: row.id },
      changes: { status: [row.status, "cancelled"] },
      significance: "significant",
    });
    return { ok: true as const, status: "cancelled" as const };
  },
);
