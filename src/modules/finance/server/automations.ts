import "server-only";
// The money daily job (rules 11–12) and the handovers it shows in a lead's Up next.
import { and, asc, eq, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { JobFn, ModuleContext } from "@/base/api";
import { people, roleAssignments, teamMemberships } from "@/base/api/schema";
import { financeAutomations, type WaitingFact } from "../rules/automations";
import { financeExpenses, financeRequestSteps, financeSpendRequests } from "../schema";

const r = financeSpendRequests;
const st = financeRequestSteps;
const prev = alias(financeRequestSteps, "prev");

/** Each submitted request's waiting step, since when, and who may decide it. */
async function waitingSteps(db: ModuleContext["db"], editionId: string): Promise<WaitingFact[]> {
  const rows = await db
    .select({
      requestId: r.id,
      refCode: r.refCode,
      title: r.title,
      estimatedCents: r.estimatedCents,
      requesterPersonId: r.requesterPersonId,
      teamId: r.teamId,
      approverKind: st.approverKind,
      roleId: st.roleId,
      position: st.position,
      waitingSince: sql<Date>`coalesce((${db
        .select({ at: max(prev.decidedAt) })
        .from(prev)
        .where(
          and(eq(prev.spendRequestId, st.spendRequestId), eq(prev.round, st.round)),
        )}), ${st.createdAt})`.mapWith((v: string | Date) => new Date(v)),
    })
    .from(st)
    .innerJoin(r, eq(r.id, st.spendRequestId))
    .where(and(eq(r.editionId, editionId), eq(r.status, "submitted"), eq(st.status, "pending")))
    .orderBy(asc(st.position));
  const first = [...new Map(rows.toReversed().map((x) => [x.requestId, x])).values()];
  if (!first.length) return [];
  const [leads, holders] = await Promise.all([
    db
      .select({ teamId: teamMemberships.teamId, id: teamMemberships.personId })
      .from(teamMemberships)
      .where(
        and(
          inArray(
            teamMemberships.teamId,
            first.map((x) => x.teamId),
          ),
          inArray(teamMemberships.role, ["lead", "co_lead"]),
          isNull(teamMemberships.deletedAt),
        ),
      ),
    db
      .select({ roleId: roleAssignments.roleId, id: roleAssignments.personId })
      .from(roleAssignments)
      .where(
        and(
          isNull(roleAssignments.deletedAt),
          inArray(
            roleAssignments.roleId,
            first.flatMap((x) => (x.roleId ? [x.roleId] : [])),
          ),
        ),
      ),
  ]);
  return first.map((x) => ({
    ...x,
    approverIds: [
      ...new Set(
        (x.approverKind === "team_lead"
          ? leads.filter((l) => l.teamId === x.teamId)
          : holders.filter((h) => h.roleId === x.roleId)
        )
          .map((p) => p.id)
          .filter((id) => id !== x.requesterPersonId),
      ),
    ],
  }));
}

/** Bought (an expense is recorded) but no receipt yet. */
async function missingReceipts(db: ModuleContext["db"], editionId: string) {
  return db
    .select({
      expenseId: financeExpenses.id,
      requestId: r.id,
      refCode: r.refCode,
      amountCents: financeExpenses.amountCents,
      payerPersonId: financeExpenses.payerPersonId,
      payerName: people.displayName,
      boughtAt: financeExpenses.createdAt,
      receiptCondition7d: sql<boolean>`exists (${db
        .select({ one: sql`1` })
        .from(st)
        .where(and(eq(st.spendRequestId, r.id), eq(st.nextStep, "receipt_within_7d")))})`,
    })
    .from(financeExpenses)
    .innerJoin(r, eq(r.id, financeExpenses.spendRequestId))
    .innerJoin(people, eq(people.id, financeExpenses.payerPersonId))
    .where(
      and(
        eq(financeExpenses.editionId, editionId),
        isNull(financeExpenses.receiptUrl),
        isNotNull(financeExpenses.spendRequestId),
      ),
    );
}

export async function collectFinanceAutomations(ctx: ModuleContext) {
  const [waiting, receipts] = await Promise.all([
    waitingSteps(ctx.db, ctx.edition.id),
    missingReceipts(ctx.db, ctx.edition.id),
  ]);
  return financeAutomations(waiting, receipts, ctx.now);
}

const job: JobFn = (ctx) => collectFinanceAutomations(ctx);
export default job;
