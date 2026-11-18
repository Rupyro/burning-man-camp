// Spend request state machine and plain-words labels (docs/specs/finance.md §3).

export type SpendStatus =
  | "draft"
  | "submitted"
  | "needs_info"
  | "approved"
  | "rejected"
  | "cancelled"
  | "purchased"
  | "closed";

export type Decision = "approved" | "rejected" | "needs_info";

/** Where a request goes after a decision on its waiting step. */
export function afterDecision(moreSteps: boolean, decision: Decision): SpendStatus {
  if (decision === "rejected") return "rejected";
  if (decision === "needs_info") return "needs_info";
  return moreSteps ? "submitted" : "approved";
}

export const canEdit = (s: SpendStatus) => s === "draft" || s === "needs_info";
export const canCancel = (s: SpendStatus) =>
  s === "draft" || s === "submitted" || s === "needs_info" || s === "approved";

export const STATUS_LABEL: Record<SpendStatus, string> = {
  draft: "Draft",
  submitted: "Waiting",
  needs_info: "Sent back",
  approved: "Approved",
  rejected: "Turned down",
  cancelled: "Cancelled",
  purchased: "Bought",
  closed: "Done",
};

export function approverText(approver: string | null): string {
  if (approver === "team_lead") return "the team lead";
  if (approver === "role:camp_lead") return "the camp lead";
  if (approver === "role:finance_approver") return "a finance approver";
  return "approval";
}

export function nextStepText(status: SpendStatus, approver: string | null): string {
  switch (status) {
    case "draft":
      return "Draft: not sent yet";
    case "submitted":
      return `Waiting for ${approverText(approver)}`;
    case "needs_info":
      return "Sent back: answer the question and resubmit";
    case "approved":
      return "Approved: buy it, then add what it cost";
    case "purchased":
      return "Bought: waiting for the pay-back";
    case "closed":
      return "Done";
    case "rejected":
      return "Turned down";
    case "cancelled":
      return "Cancelled";
  }
}
