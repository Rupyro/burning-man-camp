const WORDS: Record<string, string> = {
  deposit_paid: "Deposit paid",
  paid_in_full: "Paid in full",
  waived: "No payment needed",
  overdue: "Payment overdue",
};

/** What My profile says about payment, or null to hide it while we don't know yet. */
export function paymentLine(payment: { status: string } | null | undefined): string | null {
  if (!payment || payment.status === "unknown") return null;
  return WORDS[payment.status] ?? payment.status.replaceAll("_", " ");
}
