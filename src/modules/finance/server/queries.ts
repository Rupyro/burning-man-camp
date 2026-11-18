import { and, asc, desc, eq, gte, inArray, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Actor, can, type ReadOnlyDb } from "@/base/api";
import { people, projects, roles, teams } from "@/base/api/schema";
import { canDecideStep, type PolicyLike, type Step } from "../rules/policy";
import { budgetSummary } from "../rules/summary";
import {
  financeApprovalPolicies,
  financeBudgets,
  financeExpenses,
  financePolicySteps,
  financeReimbursements,
  financeRequestSteps,
  financeSpendRequests,
} from "../schema";

const requester = alias(people, "requester");
const r = financeSpendRequests;
const st = financeRequestSteps;
const decider = alias(people, "decider");

/** "team_lead" or "role:<key>": what rules/policy.ts and the labels read. */
const approverKey = (kind: typeof st.approverKind | typeof financePolicySteps.approverKind) =>
  sql<string>`case when ${kind} = 'team_lead' then 'team_lead' else 'role:' || ${roles.key} end`;

/** The approver of the first pending step (pending steps exist only while submitted). */
const waitingOn = sql<string | null>`(
  select ${approverKey(st.approverKind)} from ${st} left join ${roles} on ${roles.id} = ${st.roleId}
  where ${st.spendRequestId} = ${r.id} and ${st.status} = 'pending'
  order by ${st.round} desc, ${st.position} limit 1)`;

const requestColumns = {
  id: r.id,
  refCode: r.refCode,
  teamId: r.teamId,
  teamName: teams.name,
  requesterPersonId: r.requesterPersonId,
  requesterName: requester.displayName,
  title: r.title,
  justification: r.justification,
  estimatedCents: r.estimatedCents,
  supplierName: r.supplierName,
  neededBy: r.neededBy,
  status: r.status,
  waitingOn,
  submittedAt: r.submittedAt,
  decidedAt: r.decidedAt,
  taskId: r.taskId,
  budgetId: r.budgetId,
  sourceRefType: r.sourceRefType,
  sourceRefId: r.sourceRefId,
  version: r.version,
  autoApproved: r.autoApproved,
  createdAt: r.createdAt,
};

function requests(db: ReadOnlyDb) {
  return db
    .select(requestColumns)
    .from(r)
    .innerJoin(teams, eq(teams.id, r.teamId))
    .innerJoin(requester, eq(requester.id, r.requesterPersonId))
    .$dynamic();
}

export type RequestRow = Awaited<ReturnType<typeof getRequest>> & {};

export async function getRequest(db: ReadOnlyDb, editionId: string, id: string) {
  const [row] = await requests(db).where(and(eq(r.editionId, editionId), eq(r.id, id)));
  return row ?? null;
}

/** What the capability checks need about one request (null = no such request this edition). */
export async function requestResource(db: ReadOnlyDb, editionId: string, id: string) {
  const row = await getRequest(db, editionId, id);
  if (!row) return null;
  return {
    requesterId: row.requesterPersonId,
    teamId: row.teamId,
    approver: row.waitingOn ?? "none",
  };
}

/** Every request this person may see, newest first (finance.spend.view per row). */
export async function visibleRequests(db: ReadOnlyDb, editionId: string, actor: Actor) {
  const rows = await requests(db).where(eq(r.editionId, editionId)).orderBy(desc(r.createdAt));
  return rows.filter((x) =>
    can(actor, "finance.spend.view", { requesterId: x.requesterPersonId, teamId: x.teamId }),
  );
}

/** Requests waiting on a step this person may decide. */
export async function inboxFor(db: ReadOnlyDb, editionId: string, actor: Actor) {
  const rows = await requests(db)
    .where(and(eq(r.editionId, editionId), eq(r.status, "submitted")))
    .orderBy(asc(r.submittedAt));
  return rows.filter((x) =>
    canDecideStep(actor, {
      approver: x.waitingOn ?? "none",
      requesterId: x.requesterPersonId,
      teamId: x.teamId,
    }),
  );
}

/** Every step of every round, oldest round first, with who decided it. */
export async function stepsOf(db: ReadOnlyDb, requestId: string) {
  return db
    .select({
      id: st.id,
      round: st.round,
      position: st.position,
      approver: approverKey(st.approverKind),
      status: st.status,
      comment: st.comment,
      reasonCode: st.reasonCode,
      nextStep: st.nextStep,
      capAmountCents: st.capAmountCents,
      movedToBudgetId: st.movedToBudgetId,
      decidedAt: st.decidedAt,
      deciderName: decider.displayName,
    })
    .from(st)
    .leftJoin(roles, eq(roles.id, st.roleId))
    .leftJoin(decider, eq(decider.id, st.decidedByPersonId))
    .where(eq(st.spendRequestId, requestId))
    .orderBy(asc(st.round), asc(st.position));
}

/** The step waiting for a decision (null when nothing is pending). */
export async function pendingStepOf(db: ReadOnlyDb, requestId: string) {
  const [row] = await db
    .select({ id: st.id, round: st.round, position: st.position })
    .from(st)
    .where(and(eq(st.spendRequestId, requestId), eq(st.status, "pending")))
    .orderBy(asc(st.position))
    .limit(1);
  return row ?? null;
}

/** Rounds so far on a request (0 before the first submit). */
export async function lastRoundOf(db: ReadOnlyDb, requestId: string) {
  const [row] = await db
    .select({ round: max(st.round) })
    .from(st)
    .where(eq(st.spendRequestId, requestId));
  return row?.round ?? 0;
}

export type PolicyStep = Step &
  Pick<typeof financePolicySteps.$inferSelect, "approverKind" | "roleId">;
export type Policy = Omit<PolicyLike, "requiredSteps"> & { requiredSteps: PolicyStep[] };

/** This edition's policies, each with its steps in order. */
export async function listPolicies(db: ReadOnlyDb, editionId: string): Promise<Policy[]> {
  const ps = financePolicySteps;
  const [policies, steps] = await Promise.all([
    db
      .select()
      .from(financeApprovalPolicies)
      .where(eq(financeApprovalPolicies.editionId, editionId)),
    db
      .select({
        policyId: ps.policyId,
        approverKind: ps.approverKind,
        roleId: ps.roleId,
        approver: approverKey(ps.approverKind),
      })
      .from(ps)
      .innerJoin(financeApprovalPolicies, eq(financeApprovalPolicies.id, ps.policyId))
      .leftJoin(roles, eq(roles.id, ps.roleId))
      .where(eq(financeApprovalPolicies.editionId, editionId))
      .orderBy(asc(ps.position)),
  ]);
  return policies.map((p) => ({
    ...p,
    requiredSteps: steps
      .filter((x) => x.policyId === p.id)
      .map(({ approver, approverKind, roleId }) => ({ approver, approverKind, roleId })),
  }));
}

export async function budgetOf(db: ReadOnlyDb, editionId: string, teamId: string) {
  const [b] = await db
    .select()
    .from(financeBudgets)
    .where(and(eq(financeBudgets.editionId, editionId), eq(financeBudgets.teamId, teamId)));
  return b ?? null;
}

/** Budget / committed / actual / remaining per team (rules/summary.ts), for team budgets. */
export async function summaryFor(db: ReadOnlyDb, editionId: string, teamIds?: string[]) {
  if (teamIds && !teamIds.length) return budgetSummary([], [], []);
  const budgets = await db
    .select({ teamId: teams.id, teamName: teams.name, amountCents: financeBudgets.amountCents })
    .from(financeBudgets)
    .innerJoin(teams, eq(teams.id, financeBudgets.teamId))
    .where(
      and(
        eq(financeBudgets.editionId, editionId),
        teamIds ? inArray(financeBudgets.teamId, teamIds) : undefined,
      ),
    );
  const reqs = await db
    .select({
      teamId: r.teamId,
      status: r.status,
      estimatedCents: r.estimatedCents,
      expenseId: financeExpenses.id,
    })
    .from(r)
    .leftJoin(financeExpenses, eq(financeExpenses.spendRequestId, r.id))
    .where(eq(r.editionId, editionId));
  const expenses = await db
    .select({ teamId: financeExpenses.teamId, amountCents: financeExpenses.amountCents })
    .from(financeExpenses)
    .where(eq(financeExpenses.editionId, editionId));
  return budgetSummary(
    budgets,
    reqs.map((x) => ({ ...x, hasExpense: x.expenseId !== null })),
    expenses,
  );
}

export async function expenseOf(db: ReadOnlyDb, requestId: string) {
  const [e] = await db
    .select({
      expense: financeExpenses,
      reimbursement: financeReimbursements,
    })
    .from(financeExpenses)
    .leftJoin(financeReimbursements, eq(financeReimbursements.expenseId, financeExpenses.id))
    .where(eq(financeExpenses.spendRequestId, requestId));
  return e ?? null;
}

/** Teams this person is on, with names (for the new-request form). */
export async function teamsOf(db: ReadOnlyDb, actor: Actor) {
  const ids = actor.teams.map((t) => t.teamId);
  if (!ids.length) return [];
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, ids))
    .orderBy(asc(teams.name));
}

export const spendingProject = (year: number) => `Spending ${year}`;

/** The team's live "Spending <year>" project, if there is one. */
export async function spendingProjectOf(
  db: ReadOnlyDb,
  editionId: string,
  teamId: string,
  year: number,
) {
  const [p] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.editionId, editionId),
        eq(projects.teamId, teamId),
        eq(projects.name, spendingProject(year)),
        isNull(projects.deletedAt),
      ),
    );
  return p ?? null;
}

/** Budgets a request can be moved to (step 3 "Move to the right budget"), by team name. */
export async function budgetChoices(db: ReadOnlyDb, editionId: string) {
  return db
    .select({ id: financeBudgets.id, name: financeBudgets.name, teamName: teams.name })
    .from(financeBudgets)
    .leftJoin(teams, eq(teams.id, financeBudgets.teamId))
    .where(and(eq(financeBudgets.editionId, editionId), eq(financeBudgets.status, "approved")))
    .orderBy(asc(teams.name), asc(financeBudgets.name));
}

/** Decisions this year by reason, so finance can spot patterns ("5 turned down: over budget"). */
export async function reasonCounts(db: ReadOnlyDb, editionId: string) {
  return db
    .select({ status: st.status, reasonCode: st.reasonCode, count: sql<number>`count(*)::int` })
    .from(st)
    .innerJoin(r, eq(r.id, st.spendRequestId))
    .where(and(eq(r.editionId, editionId), sql`${st.reasonCode} is not null`))
    .groupBy(st.status, st.reasonCode)
    .orderBy(desc(sql`count(*)`));
}

/** Rule 3: requests approved by the small-request limit since a date, for finance approvers and
 * the camp lead only (everyone else gets an empty list). */
export async function autoApprovedSince(
  db: ReadOnlyDb,
  editionId: string,
  actor: Actor,
  since: Date,
) {
  if (!actor.hasRole("finance_approver") && !actor.hasRole("camp_lead"))
    return { items: [], totalCents: 0 };
  const items = await requests(db)
    .where(and(eq(r.editionId, editionId), eq(r.autoApproved, true), gte(r.decidedAt, since)))
    .orderBy(desc(r.decidedAt));
  return { items, totalCents: items.reduce((sum, i) => sum + i.estimatedCents, 0) };
}
