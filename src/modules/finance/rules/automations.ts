// Money automations (automation plan rules 10–12). Pure: facts in, reminders and handovers out.
import type { JobResult } from "@/contracts/automations";
import { daysSince, stageReached } from "@/lib/days";
import { formatRand } from "./money";

/** Rule 11: the approver is reminded at 3 days; the camp lead gets it at 6. */
export const APPROVAL_REMIND_DAYS = 3;
export const APPROVAL_HANDOVER_DAYS = 6;
/** Rule 12: receipt reminders on these days after buying; finance gets it the day after. */
export const RECEIPT_DAYS = [3, 7, 14] as const;
/** Approved with the condition "receipt within 7 days": finance gets it on day 8. */
export const CONDITION_RECEIPT_DAYS = 7;

/**
 * Rule 10, OFF: per-team auto-approve limits in cents, by team key. Empty until the treasurer sets them,
 * so nothing is ever auto-approved. See autoApprovable.
 */
export const AUTO_APPROVE_LIMIT_CENTS: Readonly<Record<string, number>> = {};

/** Rule 10: under the team's limit and within what's left of its budget. No limit = never. */
export function autoApprovable(
  amountCents: number,
  remainingCents: number,
  limitCents: number | undefined,
): boolean {
  return limitCents !== undefined && amountCents <= limitCents && amountCents <= remainingCents;
}

export interface WaitingFact {
  requestId: string;
  refCode: string;
  title: string;
  estimatedCents: number;
  /** When the waiting step became current. */
  waitingSince: Date;
  /** Who may decide the waiting step (never the requester). */
  approverIds: readonly string[];
}

export interface ReceiptFact {
  expenseId: string;
  requestId: string;
  refCode: string;
  amountCents: number;
  payerPersonId: string;
  payerName: string;
  boughtAt: Date;
  /** The approver tapped "Receipt within 7 days" as the condition. */
  receiptCondition7d?: boolean;
}

type Out = Required<Pick<JobResult, "reminders" | "handovers">>;

export function financeAutomations(
  waiting: readonly WaitingFact[],
  receipts: readonly ReceiptFact[],
  now: Date,
): Out {
  const out: Out = { reminders: [], handovers: [] };
  for (const w of waiting) {
    const days = daysSince(w.waitingSince, now);
    const entity = { entityType: "finance.spend_request", entityId: w.requestId };
    const href = `/finance/r/${w.requestId}`;
    if (days >= APPROVAL_REMIND_DAYS)
      for (const personId of w.approverIds)
        out.reminders.push({
          rule: "finance.approval_waiting",
          ...entity,
          personId,
          stage: `d${APPROVAL_REMIND_DAYS}`,
          priority: 1,
          title: `${w.refCode} is waiting for your decision: ${w.title}, ${formatRand(w.estimatedCents)}`,
          href,
        });
    if (days >= APPROVAL_HANDOVER_DAYS)
      out.handovers.push({
        rule: "finance.approval_waiting",
        ...entity,
        to: { role: "camp_lead" },
        what: `Request waiting ${days} days`,
        about: `${w.refCode} ${w.title}`,
        why: "approver reminded, no decision",
        href,
      });
  }
  for (const r of receipts) {
    const days = daysSince(r.boughtAt, now);
    const entity = { entityType: "finance.expense", entityId: r.expenseId };
    const href = `/finance/r/${r.requestId}`;
    const stage = stageReached(days, RECEIPT_DAYS);
    if (stage !== null)
      out.reminders.push({
        rule: "finance.receipt_missing",
        ...entity,
        personId: r.payerPersonId,
        stage: `d${stage}`,
        priority: 2,
        title: `Add the receipt for ${r.refCode} (${formatRand(r.amountCents)})`,
        href,
      });
    const handoverDay = r.receiptCondition7d ? CONDITION_RECEIPT_DAYS : (RECEIPT_DAYS.at(-1) ?? 0);
    if (days >= handoverDay + 1)
      out.handovers.push({
        rule: "finance.receipt_missing",
        ...entity,
        to: { role: "finance_approver" },
        what: `No receipt: ${formatRand(r.amountCents)}`,
        about: r.payerName,
        why: r.receiptCondition7d
          ? "approved on condition of a receipt within 7 days"
          : "3 reminders, no receipt",
        href,
      });
  }
  return out;
}
