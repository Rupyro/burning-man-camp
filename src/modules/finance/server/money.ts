"use server";
// What it cost, pay-backs, budgets and the CSV (docs/specs/finance.md §2, §5, §6).
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ForbiddenError, moduleAction, type ReadOnlyDb, ValidationError } from "@/base/api";
import { parseRand } from "../rules/money";
import { summaryCsv } from "../rules/summary";
import {
  financeBudgets,
  financeExpenses,
  financeReimbursements,
  financeSpendRequests,
} from "../schema";
import { budgetOf, getRequest, requestResource, summaryFor } from "./queries";

const r = financeSpendRequests;
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-03-01");

function cents(amount: string): number {
  const c = parseRand(amount);
  if (c === null) throw new ValidationError("Use an amount like 4500 or R4,500.50");
  return c;
}

/** The requester records what it actually cost. Out of pocket → a pay-back is owed. */
export const recordExpense = moduleAction(
  "finance",
  {
    input: z.object({
      id: z.string().uuid(),
      amount: z.string().max(40),
      spentOn: dateOnly,
      paidWith: z.enum(["personal", "camp_card", "camp_cash", "supplier_invoice"]),
      description: z.string().trim().min(2).max(500),
      receiptUrl: z.string().url().max(500).nullable().optional(),
    }),
    capability: "finance.spend.view",
    resource: (i, m) => requestResource(m.db, m.edition.id, i.id),
  },
  async (ctx, input) => {
    await ctx.tx.execute(sql`select 1 from ${r} where ${r.id} = ${input.id} for update`);
    const row = await getRequest(ctx.tx, ctx.edition.id, input.id);
    if (!row || row.requesterPersonId !== ctx.actor.personId) throw new ForbiddenError();
    if (row.status !== "approved")
      throw new ValidationError("Only approved requests can be bought");
    const amount = cents(input.amount);
    const [expense] = await ctx.tx
      .insert(financeExpenses)
      .values({
        editionId: ctx.edition.id,
        spendRequestId: row.id,
        teamId: row.teamId,
        payerPersonId: row.requesterPersonId,
        paidWith: input.paidWith,
        amountCents: amount,
        spentOn: input.spentOn,
        description: input.description,
        receiptUrl: input.receiptUrl || null,
      })
      .returning({ id: financeExpenses.id });
    const owed = input.paidWith === "personal";
    if (owed)
      await ctx.tx.insert(financeReimbursements).values({
        editionId: ctx.edition.id,
        expenseId: expense?.id ?? "",
        payeePersonId: row.requesterPersonId,
        amountCents: amount,
      });
    const status = owed ? "purchased" : "closed";
    await ctx.tx
      .update(r)
      .set({ status, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(r.id, row.id));
    if (row.taskId) await ctx.tasks.update(row.taskId, { status: "done" });
    await ctx.audit.record({
      action: "finance.expense.recorded",
      entity: { type: "finance.spend_request", id: row.id },
      changes: {
        status: [row.status, status],
        amountCents: [null, amount],
        paidWith: [null, input.paidWith],
      },
      significance: "significant",
    });
    return { ok: true as const, status };
  },
);

async function reimbursementPayee(db: ReadOnlyDb, editionId: string, id: string) {
  const [x] = await db
    .select({ payeeId: financeReimbursements.payeePersonId })
    .from(financeReimbursements)
    .where(and(eq(financeReimbursements.editionId, editionId), eq(financeReimbursements.id, id)));
  return x ?? null;
}

/** Finance marks a pay-back paid (or declined). Never their own. No bank details, ever. */
export const settleReimbursement = moduleAction(
  "finance",
  {
    input: z.object({
      reimbursementId: z.string().uuid(),
      outcome: z.enum(["paid", "declined"]),
      methodNote: z.string().trim().max(80).nullable().optional(),
    }),
    capability: "finance.manage",
    resource: (i, m) => reimbursementPayee(m.db, m.edition.id, i.reimbursementId),
  },
  async (ctx, input) => {
    const [x] = await ctx.tx
      .select()
      .from(financeReimbursements)
      .where(eq(financeReimbursements.id, input.reimbursementId))
      .for("update");
    if (!x || x.payeePersonId === ctx.actor.personId) throw new ForbiddenError();
    if (x.status !== "owed") throw new ValidationError("Already settled");
    await ctx.tx
      .update(financeReimbursements)
      .set({
        status: input.outcome,
        paidAt: input.outcome === "paid" ? ctx.now : null,
        paidByPersonId: ctx.actor.personId,
        methodNote: input.methodNote || null,
        updatedAt: ctx.now,
        version: x.version + 1,
      })
      .where(eq(financeReimbursements.id, x.id));
    const [e] = await ctx.tx
      .select({ requestId: financeExpenses.spendRequestId })
      .from(financeExpenses)
      .where(eq(financeExpenses.id, x.expenseId));
    if (e?.requestId)
      await ctx.tx
        .update(r)
        .set({ status: "closed", updatedAt: ctx.now })
        .where(eq(r.id, e.requestId));
    await ctx.audit.record({
      action: `finance.reimbursement.${input.outcome}`,
      entity: { type: "finance.reimbursement", id: x.id },
      changes: { status: [x.status, input.outcome], methodNote: [null, input.methodNote || null] },
      significance: "significant",
    });
    return { ok: true as const };
  },
);

/** Set (or create) a team's budget for this edition. */
export const setBudget = moduleAction(
  "finance",
  {
    input: z.object({ teamId: z.string().uuid(), amount: z.string().max(40) }),
    capability: "finance.manage",
  },
  async (ctx, input) => {
    const amount = cents(input.amount);
    const before = await budgetOf(ctx.tx, ctx.edition.id, input.teamId);
    if (before) {
      if (before.amountCents === amount) return { ok: true as const };
      await ctx.tx
        .update(financeBudgets)
        .set({ amountCents: amount, updatedAt: ctx.now, version: before.version + 1 })
        .where(eq(financeBudgets.id, before.id));
    } else {
      await ctx.tx.insert(financeBudgets).values({
        editionId: ctx.edition.id,
        teamId: input.teamId,
        name: "Team budget",
        amountCents: amount,
      });
    }
    await ctx.audit.record({
      action: "finance.budget.updated",
      entity: { type: "finance.budget", id: before?.id ?? input.teamId },
      changes: { amountCents: [before?.amountCents ?? null, amount] },
      significance: "significant",
    });
    return { ok: true as const };
  },
);

/** The camp summary as CSV (finance approvers and camp leads). Same sums as the screen. */
export const exportSummaryCsv = moduleAction(
  "finance",
  { input: z.object({}), capability: "finance.manage" },
  async (ctx) => summaryCsv(await summaryFor(ctx.tx, ctx.edition.id)),
);
