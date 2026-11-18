// Approve / ask / reject as taps (plan-money-taps.md): a fixed reason for every decision and,
// for some reasons, a next step. Pure; the database enforces the same pairs.
import type { Decision } from "./status";

export const DECISION_REASONS = [
  "within_budget",
  "essential",
  "approved_with_condition",
  "need_quote",
  "need_cheaper",
  "purpose_unclear",
  "over_budget",
  "not_needed",
  "wrong_budget",
  "other",
] as const;
export type DecisionReason = (typeof DECISION_REASONS)[number];

export const DECISION_NEXT_STEPS = [
  "receipt_within_7d",
  "cap_amount",
  "use_camp_supplier",
  "resubmit_lower",
  "next_budget_round",
  "ask_camp_lead",
  "already_covered",
  "borrow_kit",
  "move_budget",
  "close",
] as const;
export type DecisionNext = (typeof DECISION_NEXT_STEPS)[number];

/** Step 2: the three reasons per decision, first one pre-selected. "other" is always allowed. */
export const REASONS_FOR: Record<Decision, readonly DecisionReason[]> = {
  approved: ["within_budget", "essential", "approved_with_condition"],
  needs_info: ["need_quote", "need_cheaper", "purpose_unclear"],
  rejected: ["over_budget", "not_needed", "wrong_budget"],
};

/**
 * The reason already picked when a decision is tapped: approving keeps its two-tap default, but
 * asking for info or turning down must be a real choice (QA 21 Oct 2026).
 */
export function defaultReason(d: Decision): DecisionReason | null {
  return d === "approved" ? (REASONS_FOR.approved[0] ?? null) : null;
}

/** Step 3: next steps offered for a reason (empty = no step 3). */
export const NEXT_FOR: Partial<Record<DecisionReason, readonly DecisionNext[]>> = {
  approved_with_condition: ["receipt_within_7d", "cap_amount", "use_camp_supplier"],
  over_budget: ["resubmit_lower", "next_budget_round", "ask_camp_lead"],
  not_needed: ["already_covered", "borrow_kit", "close"],
  wrong_budget: ["move_budget", "ask_camp_lead", "close"],
};

export const REASON_LABEL: Record<DecisionReason, string> = {
  within_budget: "Within budget",
  essential: "Essential for camp",
  approved_with_condition: "Approved, with a condition",
  need_quote: "Need a quote or photo",
  need_cheaper: "Need a cheaper option",
  purpose_unclear: "Purpose unclear",
  over_budget: "Over budget",
  not_needed: "Not needed or duplicate",
  wrong_budget: "Wrong team or budget",
  other: "Other",
};

export const NEXT_LABEL: Record<DecisionNext, string> = {
  receipt_within_7d: "Receipt within 7 days",
  cap_amount: "Spend up to a lower cap",
  use_camp_supplier: "Use the camp supplier",
  resubmit_lower: "Resubmit lower",
  next_budget_round: "Wait for the next budget round",
  ask_camp_lead: "Ask the camp lead",
  already_covered: "Already covered",
  borrow_kit: "Borrow from camp kit",
  move_budget: "Move to the right budget",
  close: "Close it",
};

export interface DecisionInput {
  decision: Decision;
  reason: DecisionReason;
  next?: DecisionNext | null;
  note?: string | null;
  capAmountCents?: number | null;
  moveToBudgetId?: string | null;
}

/** Why a decision can't be saved, in plain words; null = fine. */
export function decisionProblem(d: DecisionInput): string | null {
  if (d.reason !== "other" && !REASONS_FOR[d.decision].includes(d.reason))
    return "That reason doesn't fit this decision";
  if (d.reason === "other" && !d.note?.trim()) return "Add a short note for “Other”";
  const offered = NEXT_FOR[d.reason] ?? [];
  if (d.next && !offered.includes(d.next)) return "That next step doesn't fit this reason";
  if (d.reason === "approved_with_condition" && !d.next) return "Pick the condition";
  if (d.next === "cap_amount" && !(d.capAmountCents && d.capAmountCents > 0))
    return "Pick the cap amount";
  if (d.next === "move_budget" && !d.moveToBudgetId) return "Pick the budget to move it to";
  return null;
}
