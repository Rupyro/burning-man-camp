// Fake, deterministic, idempotent demo money (docs/specs/finance.md §7). Writes only finance
// tables; tasks go through the base task engine (as the seed admin).
import { and, eq, gt, inArray } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { campSettings, roleAssignments, roles, teamMemberships, teams } from "@/base/api/schema";
import { campInputToInstant } from "@/lib/dates";
import { PLACEHOLDER_POLICIES, type Step } from "./rules/policy";
import { spendRef } from "./rules/ref";
import type { SpendStatus } from "./rules/status";
import {
  financeBudgets,
  financeExpenses,
  financeReimbursements,
  financeRequestSteps,
  financeSpendRequests,
} from "./schema";
import { insertPlaceholderPolicies } from "./server/policies";
import { spendingProject } from "./server/queries";

const BUDGETS: [team: string, amount: number][] = [
  ["camp_infra", 85_000],
  ["kitchen", 60_000],
  ["gift_projects", 40_000],
  ["logistics", 30_000],
  ["programming", 15_000],
  ["community", 5_000],
  ["duties", 3_000],
  ["moop", 4_000],
  ["marketing", 2_500],
];

const LEAD: Step[] = [{ approver: "team_lead" }];
const FIN: Step[] = [{ approver: "role:finance_approver" }];
const BIG: Step[] = [{ approver: "role:finance_approver" }, { approver: "role:camp_lead" }];

type Who = "member" | "lead" | "admin" | "kitchenLead";
type Seed = {
  team: string;
  by: Who;
  title: string;
  amount: number;
  status: SpendStatus;
  steps: Step[];
  why?: string;
  supplier?: string;
  /** Decisions so far, one per step in order: [approver, decision, comment?] */
  decisions?: [Who | "finance" | "camp", "approved" | "rejected" | "needs_info", string?][];
  spent?: { amount: number; paidWith: "personal" | "camp_card"; owed?: boolean };
  task?: boolean;
};

/** About ten requests in every state, including the plan's 4,500 propane demo. */
const REQUESTS: Seed[] = [
  {
    team: "kitchen",
    by: "member",
    title: "Propane tanks (4 × 20 lb)",
    amount: 4500,
    status: "submitted",
    steps: FIN,
    why: "Cooking propane for build week and the burn.",
    supplier: "Propane supplier (demo), Reno",
    task: true,
  },
  {
    team: "kitchen",
    by: "member",
    title: "Ice for build week",
    amount: 900,
    status: "approved",
    steps: LEAD,
    decisions: [["kitchenLead", "approved"]],
    task: true,
  },
  {
    team: "kitchen",
    by: "member",
    title: "Spices, oil and salt",
    amount: 1200,
    status: "purchased",
    steps: LEAD,
    decisions: [["kitchenLead", "approved"]],
    spent: { amount: 1150.5, paidWith: "personal", owed: true },
  },
  {
    team: "kitchen",
    by: "kitchenLead",
    title: "Stove regulator",
    amount: 650,
    status: "closed",
    steps: FIN,
    decisions: [["finance", "approved"]],
    spent: { amount: 640, paidWith: "camp_card" },
  },
  {
    team: "kitchen",
    by: "member",
    title: "Second chest fridge",
    amount: 12000,
    status: "submitted",
    steps: BIG,
    decisions: [["finance", "approved", "Fine by budget; camp lead to confirm."]],
    why: "Food for 70 for 9 days doesn't fit one fridge.",
  },
  {
    team: "kitchen",
    by: "member",
    title: "Coffee plungers",
    amount: 450,
    status: "draft",
    steps: [],
  },
  {
    team: "gift_projects",
    by: "lead",
    title: "LED strips for the dome",
    amount: 3800,
    status: "needs_info",
    steps: FIN,
    decisions: [["finance", "needs_info", "Which supplier, and how many metres?"]],
  },
  {
    team: "gift_projects",
    by: "lead",
    title: "Fire extinguishers",
    amount: 2400,
    status: "rejected",
    steps: FIN,
    decisions: [["finance", "rejected", "Camp infrastructure already bought these."]],
  },
  {
    team: "camp_infra",
    by: "admin",
    title: "Shade cloth, 50 m roll",
    amount: 18500,
    status: "submitted",
    steps: BIG,
    why: "Replaces the torn 2026 shade over the kitchen.",
  },
];

/** Demo decisions get the first reason for their decision (plan-money-taps.md). */
const SEED_REASON = {
  approved: "within_budget",
  needs_info: "need_quote",
  rejected: "over_budget",
} as const;

export async function seed({ db, edition, people, tasks }: ModuleSeedContext) {
  const [done] = await db
    .select({ id: financeBudgets.id })
    .from(financeBudgets)
    .where(eq(financeBudgets.editionId, edition.id));
  if (done) return tidyDemoRequests({ db, edition, tasks });
  const teamRows = await db
    .select({ id: teams.id, key: teams.key, name: teams.name })
    .from(teams)
    .where(eq(teams.editionId, edition.id));
  const team = (key: string) => teamRows.find((t) => t.key === key);
  const leadOf = async (key: string) =>
    (
      await db
        .select({ id: teamMemberships.personId })
        .from(teamMemberships)
        .where(
          and(eq(teamMemberships.teamId, team(key)?.id ?? ""), eq(teamMemberships.role, "lead")),
        )
    )[0]?.id;
  const holder = async (role: string) =>
    (
      await db
        .select({ id: roleAssignments.personId })
        .from(roleAssignments)
        .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
        .where(eq(roles.key, role))
        .orderBy(roleAssignments.personId)
        .limit(1)
    )[0]?.id;
  const who: Record<string, string | undefined> = {
    ...people,
    kitchenLead: await leadOf("kitchen"),
    finance: await holder("finance_approver"),
    camp: await holder("camp_lead"),
  };

  const policies = await insertPlaceholderPolicies(db, edition.id);
  const roleRows = await db.select({ id: roles.id, key: roles.key }).from(roles);
  const roleOf = (approver: string) => roleRows.find((x) => `role:${x.key}` === approver)?.id;
  const budgetIds = new Map<string, string>();
  for (const [key, amount] of BUDGETS) {
    const t = team(key);
    if (!t) continue;
    const [b] = await db
      .insert(financeBudgets)
      .values({
        editionId: edition.id,
        teamId: t.id,
        name: `${t.name} ${edition.year}`,
        amountCents: amount * 100,
      })
      .returning({ id: financeBudgets.id });
    if (b) budgetIds.set(key, b.id);
  }
  const [camp] = await db.select({ prefix: campSettings.refPrefix }).from(campSettings);
  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  let seq = 0;
  for (const s of REQUESTS) {
    const t = team(s.team);
    const budgetId = budgetIds.get(s.team);
    const requester = who[s.by];
    if (!t || !budgetId || !requester) continue;
    seq += 1;
    const policyName = PLACEHOLDER_POLICIES.find(
      (p) => JSON.stringify(p.requiredSteps) === JSON.stringify(s.steps),
    )?.name;
    const policy = policies.find((p) => p.name === policyName);
    let taskId: string | null = null;
    if (s.task) {
      const project = await tasks.ensureProject({
        teamKey: s.team,
        name: spendingProject(edition.year),
        description: "Approved spending: buy it and add the receipt (Money module).",
      });
      taskId = (
        await tasks.create({
          projectId: project.id,
          title: `${spendRef(camp?.prefix ?? "OEA", seq)}: buy “${s.title}” and add the receipt`,
          kind: "finance.purchase",
          dueAt: campInputToInstant(`${edition.year}-03-15`, "12:00"),
          ownerPersonId: requester,
        })
      ).id;
    }
    const sent = s.status !== "draft";
    const final = ["approved", "rejected", "purchased", "closed"].includes(s.status);
    const [row] = await db
      .insert(financeSpendRequests)
      .values({
        editionId: edition.id,
        refSeq: seq,
        refCode: spendRef(camp?.prefix ?? "OEA", seq),
        budgetId,
        teamId: t.id,
        requesterPersonId: requester,
        title: s.title,
        justification: s.why ?? null,
        estimatedCents: Math.round(s.amount * 100),
        supplierName: s.supplier ?? null,
        status: s.status,
        policyId: sent ? (policy?.id ?? null) : null,
        submittedAt: sent ? day(-10 + seq) : null,
        decidedAt: final ? day(-5 + seq / 2) : null,
        taskId,
      })
      .returning({ id: financeSpendRequests.id });
    if (!row) continue;
    const decided = (s.decisions ?? []).map(([by, decision, comment]) => ({
      by: who[by],
      decision,
      comment,
    }));
    const steps = s.steps.flatMap((step, position) => {
      const d = decided[position];
      const kind = step.approver === "team_lead" ? ("team_lead" as const) : ("role" as const);
      const base = {
        spendRequestId: row.id,
        round: 1,
        position,
        approverKind: kind,
        roleId: kind === "role" ? (roleOf(step.approver) ?? null) : null,
        requesterPersonId: requester,
      };
      if (d?.by && d.by !== requester)
        return [
          {
            ...base,
            status: d.decision,
            decidedByPersonId: d.by,
            comment: d.comment ?? null,
            reasonCode: SEED_REASON[d.decision],
            decidedAt: day(-6 + position),
          },
        ];
      return s.status === "submitted" ? [base] : [];
    });
    if (steps.length) await db.insert(financeRequestSteps).values(steps);
    if (s.spent) {
      const [e] = await db
        .insert(financeExpenses)
        .values({
          editionId: edition.id,
          spendRequestId: row.id,
          teamId: t.id,
          payerPersonId: requester,
          paidWith: s.spent.paidWith,
          amountCents: Math.round(s.spent.amount * 100),
          spentOn: `${edition.year}-03-01`,
          description: s.title,
          receiptUrl: "https://example.test/receipts/demo.jpg",
        })
        .returning({ id: financeExpenses.id });
      if (e && s.spent.owed)
        await db.insert(financeReimbursements).values({
          editionId: edition.id,
          expenseId: e.id,
          payeePersonId: requester,
          amountCents: Math.round(s.spent.amount * 100),
        });
    }
  }
}

/**
 * A re-seed of a seeded demo removes requests made while click-testing it (anything past the
 * seeded refs), with their steps, expenses and reimbursements, and cancels their buy-it tasks,
 * so the story reads as seeded. Fake demo data only.
 */
async function tidyDemoRequests({
  db,
  edition,
  tasks,
}: Pick<ModuleSeedContext, "db" | "edition" | "tasks">) {
  const extra = await db
    .select({
      id: financeSpendRequests.id,
      ref: financeSpendRequests.refCode,
      taskId: financeSpendRequests.taskId,
      status: financeSpendRequests.status,
    })
    .from(financeSpendRequests)
    .where(
      and(
        eq(financeSpendRequests.editionId, edition.id),
        gt(financeSpendRequests.refSeq, REQUESTS.length),
      ),
    );
  if (!extra.length) return;
  const ids = extra.map((r) => r.id);
  const expenses = await db
    .select({ id: financeExpenses.id })
    .from(financeExpenses)
    .where(inArray(financeExpenses.spendRequestId, ids));
  if (expenses.length)
    await db.delete(financeReimbursements).where(
      inArray(
        financeReimbursements.expenseId,
        expenses.map((e) => e.id),
      ),
    );
  await db.delete(financeExpenses).where(inArray(financeExpenses.spendRequestId, ids));
  await db.delete(financeRequestSteps).where(inArray(financeRequestSteps.spendRequestId, ids));
  await db.delete(financeSpendRequests).where(inArray(financeSpendRequests.id, ids));
  for (const r of extra) if (r.taskId) await tasks.update(r.taskId, { status: "cancelled" });
  console.log(`Removed demo test requests: ${extra.map((r) => r.ref).join(", ")}`);
}
