// Approval policies and who may decide a step (docs/specs/finance.md §3, decisions F1, F3, F4).

export interface Step {
  /** "team_lead" or "role:<role key>" */
  approver: string;
}

export interface PolicyLike {
  id: string;
  name: string;
  minCents: number;
  maxCents: number | null;
  withinBudgetOnly: boolean;
  requiredSteps: Step[];
  sortOrder: number;
  isActive: boolean;
}

// The placeholder names and limits are camp content: camp-content/policies.ts.
export { PLACEHOLDER_POLICIES } from "../../../../camp-content/policies";

/** First active policy (by sort order) whose range holds the amount and whose budget rule passes. */
export function pickPolicy<P extends PolicyLike>(
  policies: readonly P[],
  amountCents: number,
  remainingCents: number,
): P | null {
  const ordered = [...policies].filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    ordered.find(
      (p) =>
        amountCents >= p.minCents &&
        (p.maxCents === null || amountCents <= p.maxCents) &&
        (!p.withinBudgetOnly || remainingCents >= amountCents),
    ) ?? null
  );
}

export interface StepResource {
  approver: string;
  requesterId: string;
  teamId: string;
}

/** The parts of the base Actor this rule needs (rules may not import the base). */
export interface Decider {
  personId: string | null;
  isConfirmedMember: boolean;
  hasRole(role: string): boolean;
  isLeadOf(team: string): boolean;
}

/**
 * Team lead step: a lead or co-lead of the request's team. Role step: a holder of that role.
 * A camp lead may stand in for any step. Nobody decides their own request. Admin is not a
 * money power.
 */
export function canDecideStep(a: Decider, r: StepResource): boolean {
  if (!a.personId || !a.isConfirmedMember || a.personId === r.requesterId) return false;
  if (a.hasRole("camp_lead")) return true;
  if (r.approver === "team_lead") return a.isLeadOf(r.teamId);
  if (r.approver.startsWith("role:")) return a.hasRole(r.approver.slice(5));
  return false;
}
