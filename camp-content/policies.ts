// Placeholder approval-policy names and limits (decision F1: Jory sets the real numbers).
// The matching logic stays in the finance module.
import { MONEY_SYMBOL } from "../src/lib/camp";
import type { PolicyLike } from "../src/modules/finance/rules/policy";

export const PLACEHOLDER_POLICIES: Omit<PolicyLike, "id">[] = [
  {
    name: "Small, within budget",
    minCents: 0,
    maxCents: 150_000,
    withinBudgetOnly: true,
    requiredSteps: [{ approver: "team_lead" }],
    sortOrder: 1,
    isActive: true,
  },
  {
    name: `Up to ${MONEY_SYMBOL}10,000, within budget`,
    minCents: 0,
    maxCents: 1_000_000,
    withinBudgetOnly: true,
    requiredSteps: [{ approver: "role:finance_approver" }],
    sortOrder: 2,
    isActive: true,
  },
  {
    name: "Large or over budget",
    minCents: 0,
    maxCents: null,
    withinBudgetOnly: false,
    requiredSteps: [{ approver: "role:finance_approver" }, { approver: "role:camp_lead" }],
    sortOrder: 3,
    isActive: true,
  },
];
