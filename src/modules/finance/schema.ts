import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions, people, roles, tasks, teams } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { DECISION_NEXT_STEPS, DECISION_REASONS } from "./rules/decision-reasons";

// Every table and enum starts with "finance_" (DATA_MODEL.md §7). FKs only to base tables.
// Money is integer cents (bigint, read as a JS number: safe far beyond the R10m cap).

const money = (name: string) => bigint(name, { mode: "number" });
const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
};

export const financeBudgetStatusEnum = pgEnum("finance_budget_status", [
  "draft",
  "approved",
  "closed",
]);
export const financeSpendStatusEnum = pgEnum("finance_spend_status", [
  "draft",
  "submitted",
  "needs_info",
  "approved",
  "rejected",
  "cancelled",
  "purchased",
  "closed",
]);
export const financeApproverKindEnum = pgEnum("finance_approver_kind", ["team_lead", "role"]);
export const financeStepStatusEnum = pgEnum("finance_step_status", [
  "pending",
  "approved",
  "rejected",
  "needs_info",
]);
export const financeDecisionReasonEnum = pgEnum("finance_decision_reason", DECISION_REASONS);
export const financeDecisionNextEnum = pgEnum("finance_decision_next", DECISION_NEXT_STEPS);
export const financePaidWithEnum = pgEnum("finance_paid_with", [
  "personal",
  "camp_card",
  "camp_cash",
  "supplier_invoice",
]);
export const financeReimbursementStatusEnum = pgEnum("finance_reimbursement_status", [
  "owed",
  "paid",
  "declined",
]);

export const financeBudgets = pgTable(
  "finance_budgets",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    amountCents: money("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    status: financeBudgetStatusEnum("status").notNull().default("approved"),
    notes: text("notes"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("finance_budgets_edition_team_uq").on(t.editionId, t.teamId),
    check("finance_budgets_amount_ck", sql`${t.amountCents} >= 0`),
  ],
);

export const financeApprovalPolicies = pgTable("finance_approval_policies", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  editionId: uuid("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  minCents: money("min_cents").notNull().default(0),
  maxCents: money("max_cents"),
  withinBudgetOnly: boolean("within_budget_only").notNull().default(false),
  sortOrder: smallint("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...stamps,
});

export const financeSpendRequests = pgTable(
  "finance_spend_requests",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    refSeq: integer("ref_seq").notNull(),
    refCode: varchar("ref_code", { length: 20 }).notNull(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => financeBudgets.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    requesterPersonId: uuid("requester_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    justification: text("justification"),
    estimatedCents: money("estimated_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    supplierName: text("supplier_name"),
    neededBy: date("needed_by"),
    status: financeSpendStatusEnum("status").notNull().default("draft"),
    policyId: uuid("policy_id").references(() => financeApprovalPolicies.id, {
      onDelete: "restrict",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "restrict" }),
    sourceRefType: varchar("source_ref_type", { length: 40 }),
    sourceRefId: uuid("source_ref_id"),
    /** Approved on submit by the camp's small-request limit, with no approver step. */
    autoApproved: boolean("auto_approved").notNull().default(false),
    ...stamps,
  },
  (t) => [
    uniqueIndex("finance_spend_requests_ref_uq").on(t.refCode),
    uniqueIndex("finance_spend_requests_seq_uq").on(t.editionId, t.refSeq),
    index("finance_spend_requests_status_idx").on(t.editionId, t.status),
    index("finance_spend_requests_team_idx").on(t.teamId),
    index("finance_spend_requests_requester_idx").on(t.requesterPersonId),
    check("finance_spend_requests_amount_ck", sql`${t.estimatedCents} > 0`),
  ],
);

/** Who says yes under a policy, in order. A role step names a base role; a team lead step doesn't. */
export const financePolicySteps = pgTable(
  "finance_policy_steps",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => financeApprovalPolicies.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    approverKind: financeApproverKindEnum("approver_kind").notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "restrict" }),
  },
  (t) => [
    uniqueIndex("finance_policy_steps_position_uq").on(t.policyId, t.position),
    check(
      "finance_policy_steps_role_ck",
      sql`(${t.approverKind} = 'role') = (${t.roleId} is not null)`,
    ),
  ],
);

/**
 * The policy's steps, copied at each submit (a "round") so later policy edits don't move the
 * goalposts, plus each step's decision. Sending back (needs_info) ends a round; resubmitting
 * starts the next. The waiting step is the first pending one of the latest round. The requester
 * is copied in so the database itself refuses self-approval.
 */
export const financeRequestSteps = pgTable(
  "finance_request_steps",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    spendRequestId: uuid("spend_request_id")
      .notNull()
      .references(() => financeSpendRequests.id, { onDelete: "restrict" }),
    round: smallint("round").notNull(),
    position: smallint("position").notNull(),
    approverKind: financeApproverKindEnum("approver_kind").notNull(),
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "restrict" }),
    status: financeStepStatusEnum("status").notNull().default("pending"),
    requesterPersonId: uuid("requester_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    decidedByPersonId: uuid("decided_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    /** The optional note (required for reason "other"). */
    comment: text("comment"),
    reasonCode: financeDecisionReasonEnum("reason_code"),
    nextStep: financeDecisionNextEnum("next_step"),
    capAmountCents: money("cap_amount_cents"),
    movedToBudgetId: uuid("moved_to_budget_id").references(() => financeBudgets.id, {
      onDelete: "restrict",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("finance_request_steps_position_uq").on(t.spendRequestId, t.round, t.position),
    index("finance_request_steps_pending_idx").on(t.status, t.createdAt),
    check(
      "finance_request_steps_role_ck",
      sql`(${t.approverKind} = 'role') = (${t.roleId} is not null)`,
    ),
    check(
      "finance_request_steps_decided_ck",
      sql`(${t.status} = 'pending') = (${t.decidedByPersonId} is null and ${t.decidedAt} is null)`,
    ),
    check(
      "finance_request_steps_reason_ck",
      sql`(${t.status} = 'pending') = (${t.reasonCode} is null) and (${t.reasonCode} is distinct from 'other' or coalesce(btrim(${t.comment}), '') <> '') and (${t.reasonCode} is null or ${t.reasonCode} = 'other' or (${t.status} = 'approved' and ${t.reasonCode} in ('within_budget', 'essential', 'approved_with_condition')) or (${t.status} = 'needs_info' and ${t.reasonCode} in ('need_quote', 'need_cheaper', 'purpose_unclear')) or (${t.status} = 'rejected' and ${t.reasonCode} in ('over_budget', 'not_needed', 'wrong_budget')))`,
    ),
    check(
      "finance_request_steps_next_ck",
      sql`coalesce((${t.nextStep} is null and ${t.reasonCode} is distinct from 'approved_with_condition') or (${t.reasonCode} = 'approved_with_condition' and ${t.nextStep} in ('receipt_within_7d', 'cap_amount', 'use_camp_supplier')) or (${t.reasonCode} = 'over_budget' and ${t.nextStep} in ('resubmit_lower', 'next_budget_round', 'ask_camp_lead')) or (${t.reasonCode} = 'not_needed' and ${t.nextStep} in ('already_covered', 'borrow_kit', 'close')) or (${t.reasonCode} = 'wrong_budget' and ${t.nextStep} in ('move_budget', 'ask_camp_lead', 'close')), false)`,
    ),
    check(
      "finance_request_steps_next_detail_ck",
      sql`(${t.nextStep} = 'cap_amount') = (${t.capAmountCents} is not null and ${t.capAmountCents} > 0) and (${t.nextStep} = 'move_budget') = (${t.movedToBudgetId} is not null)`,
    ),
    check(
      "finance_request_steps_not_self_ck",
      sql`${t.decidedByPersonId} is null or ${t.decidedByPersonId} <> ${t.requesterPersonId}`,
    ),
  ],
);

export const financeExpenses = pgTable(
  "finance_expenses",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    spendRequestId: uuid("spend_request_id").references(() => financeSpendRequests.id, {
      onDelete: "restrict",
    }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    payerPersonId: uuid("payer_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    paidWith: financePaidWithEnum("paid_with").notNull(),
    amountCents: money("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    spentOn: date("spent_on").notNull(),
    description: text("description").notNull(),
    /** A link to the receipt photo (decision F6: no file storage yet). */
    receiptUrl: text("receipt_url"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("finance_expenses_request_uq").on(t.spendRequestId),
    index("finance_expenses_team_idx").on(t.editionId, t.teamId),
    check("finance_expenses_amount_ck", sql`${t.amountCents} > 0`),
  ],
);

/** One per out-of-pocket expense. Never bank details: method_note is "EFT 12 Mar" at most. */
export const financeReimbursements = pgTable(
  "finance_reimbursements",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => financeExpenses.id, { onDelete: "restrict" }),
    payeePersonId: uuid("payee_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amountCents: money("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    status: financeReimbursementStatusEnum("status").notNull().default("owed"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidByPersonId: uuid("paid_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    methodNote: varchar("method_note", { length: 80 }),
    ...stamps,
  },
  (t) => [
    uniqueIndex("finance_reimbursements_expense_uq").on(t.expenseId),
    index("finance_reimbursements_status_idx").on(t.editionId, t.status),
  ],
);

// Camp fees (applicants spec §6): what an accepted applicant owes, and whether Finance has
// recorded it as paid. Demo only: the app never takes money; payment happens outside (Howler).
export const financeFeeStatusEnum = pgEnum("finance_fee_status", ["due", "paid", "waived"]);

export const financeCampFees = pgTable(
  "finance_camp_fees",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amountCents: money("amount_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    status: financeFeeStatusEnum("status").notNull().default("due"),
    /** What asked for the fee (soft ref, e.g. applicants.application). */
    sourceRefType: varchar("source_ref_type", { length: 40 }).notNull(),
    sourceRefId: uuid("source_ref_id").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    recordedByPersonId: uuid("recorded_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    ...stamps,
  },
  (t) => [
    uniqueIndex("finance_camp_fees_source_uq").on(t.sourceRefType, t.sourceRefId),
    index("finance_camp_fees_edition_idx").on(t.editionId, t.status),
    check("finance_camp_fees_amount_ck", sql`${t.amountCents} > 0`),
  ],
);
