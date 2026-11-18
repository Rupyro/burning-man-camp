// Budget, committed, actual and remaining (docs/specs/finance.md §2). Computed, never stored.
import { csvRand } from "./money";
import type { SpendStatus } from "./status";

export interface BudgetIn {
  teamId: string;
  teamName: string;
  amountCents: number;
}
export interface RequestIn {
  teamId: string;
  status: SpendStatus;
  estimatedCents: number;
  hasExpense: boolean;
}
export interface ExpenseIn {
  teamId: string;
  amountCents: number;
}

export interface SummaryRow {
  teamId: string;
  teamName: string;
  budgetCents: number;
  /** Approved, not bought yet */
  committedCents: number;
  /** Recorded expenses */
  actualCents: number;
  /** Submitted or sent back: not counted against the budget yet */
  pendingCents: number;
  remainingCents: number;
  overBudget: boolean;
}

export function budgetSummary(
  budgets: readonly BudgetIn[],
  requests: readonly RequestIn[],
  expenses: readonly ExpenseIn[],
) {
  const rows: SummaryRow[] = budgets.map((b) => {
    const mine = requests.filter((r) => r.teamId === b.teamId);
    const sum = (xs: readonly { cents: number }[]) => xs.reduce((n, x) => n + x.cents, 0);
    const committedCents = sum(
      mine
        .filter((r) => r.status === "approved" && !r.hasExpense)
        .map((r) => ({ cents: r.estimatedCents })),
    );
    const pendingCents = sum(
      mine
        .filter((r) => r.status === "submitted" || r.status === "needs_info")
        .map((r) => ({ cents: r.estimatedCents })),
    );
    const actualCents = sum(
      expenses.filter((e) => e.teamId === b.teamId).map((e) => ({ cents: e.amountCents })),
    );
    const remainingCents = b.amountCents - committedCents - actualCents;
    return {
      teamId: b.teamId,
      teamName: b.teamName,
      budgetCents: b.amountCents,
      committedCents,
      actualCents,
      pendingCents,
      remainingCents,
      overBudget: remainingCents < 0,
    };
  });
  rows.sort((a, b) => a.teamName.localeCompare(b.teamName));
  const add = (k: keyof SummaryRow) => rows.reduce((n, r) => n + (r[k] as number), 0);
  const total = {
    budgetCents: add("budgetCents"),
    committedCents: add("committedCents"),
    actualCents: add("actualCents"),
    pendingCents: add("pendingCents"),
    remainingCents: add("remainingCents"),
  };
  return { rows, total };
}

export type BudgetSummary = ReturnType<typeof budgetSummary>;

const cell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The summary as CSV; the Total line is the same sums the screen shows. */
export function summaryCsv(s: BudgetSummary): string {
  const line = (name: string, r: Omit<SummaryRow, "teamId" | "teamName" | "overBudget">) =>
    [
      cell(name),
      ...[r.budgetCents, r.committedCents, r.actualCents, r.pendingCents, r.remainingCents].map(
        csvRand,
      ),
    ].join(",");
  return [
    "Team,Budget (R),Committed (R),Spent (R),Waiting approval (R),Remaining (R)",
    ...s.rows.map((r) => line(r.teamName, r)),
    line("Total", s.total),
    "",
  ].join("\n");
}
