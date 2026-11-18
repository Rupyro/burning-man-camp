import { and, eq, inArray } from "drizzle-orm";
import {
  can,
  handoverItems,
  type ModuleContext,
  type MyItem,
  type MyItemsProvider,
} from "@/base/api";
import { people, tasks } from "@/base/api/schema";
import { formatRand } from "../rules/money";
import { financeExpenses, financeReimbursements, financeSpendRequests } from "../schema";
import { collectFinanceAutomations } from "./automations";
import { inboxFor } from "./queries";

/**
 * Approvals waiting for me; turned-down requests I haven't put away; pay-backs finance owes
 * (not my own); and the automations' handovers meant for me (rules 11–12). "Buy it and add the
 * receipt" is already a base task, so it isn't repeated here.
 */
export const myFinanceItems: MyItemsProvider = async (ctx) => {
  const me = ctx.actor.personId;
  if (!me || !ctx.actor.isConfirmedMember) return [];
  const items: MyItem[] = (await inboxFor(ctx.db, ctx.edition.id, ctx.actor)).map((x) => ({
    id: `finance:${x.id}:approve`,
    moduleId: "finance" as const,
    kind: "approval" as const,
    title: `Approve ${x.refCode}: ${x.title}, ${formatRand(x.estimatedCents)} (${x.teamName})`,
    urgency: "soon" as const,
    href: `/finance/r/${x.id}`,
  }));
  const r = financeSpendRequests;
  const turnedDown = await ctx.db
    .select({ id: r.id, refCode: r.refCode })
    .from(r)
    .innerJoin(tasks, eq(tasks.id, r.taskId))
    .where(
      and(
        eq(r.editionId, ctx.edition.id),
        eq(r.requesterPersonId, me),
        eq(r.status, "rejected"),
        inArray(tasks.status, ["todo", "in_progress", "blocked"]),
      ),
    );
  for (const x of turnedDown)
    items.push({
      id: `finance:${x.id}:rejected`,
      moduleId: "finance",
      kind: "approval",
      title: `${x.refCode} was turned down`,
      urgency: "soon",
      href: `/finance/r/${x.id}`,
    });
  if (can(ctx.actor, "finance.manage")) {
    const owed = await ctx.db
      .select({
        id: financeReimbursements.id,
        payee: financeReimbursements.payeePersonId,
        name: people.displayName,
        amountCents: financeReimbursements.amountCents,
        requestId: r.id,
        refCode: r.refCode,
      })
      .from(financeReimbursements)
      .innerJoin(people, eq(people.id, financeReimbursements.payeePersonId))
      .innerJoin(financeExpenses, eq(financeExpenses.id, financeReimbursements.expenseId))
      .innerJoin(r, eq(r.id, financeExpenses.spendRequestId))
      .where(
        and(
          eq(financeReimbursements.editionId, ctx.edition.id),
          eq(financeReimbursements.status, "owed"),
        ),
      );
    for (const x of owed.filter((o) => o.payee !== me))
      items.push({
        id: `finance:${x.id}:pay`,
        moduleId: "finance",
        kind: "approval",
        title: `Pay back ${x.name} ${formatRand(x.amountCents)} (${x.refCode})`,
        urgency: "normal",
        href: `/finance/r/${x.requestId}`,
      });
  }
  const { handovers } = await collectFinanceAutomations(ctx);
  return [...items, ...handoverItems("finance", ctx.actor, handovers)];
};

export const financeBadge = async (ctx: ModuleContext) => {
  const n = (await inboxFor(ctx.db, ctx.edition.id, ctx.actor)).length;
  return n || null;
};
