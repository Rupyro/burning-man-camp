// Receipt-within-7-days condition hands over to finance on day 8, not day 15.
import { describe, expect, it } from "vitest";
import { financeAutomations, type ReceiptFact } from "../rules/automations";

const NOW = new Date("2027-03-20T08:00:00Z");
const receipt = (days: number, receiptCondition7d: boolean): ReceiptFact => ({
  expenseId: "e1",
  requestId: "r1",
  refCode: "OEA-SR-002",
  amountCents: 115_050,
  payerPersonId: "sam",
  payerName: "Sam",
  boughtAt: new Date(NOW.getTime() - days * 86_400_000),
  receiptCondition7d,
});

describe("approved with the condition: receipt within 7 days", () => {
  it("finance gets it on day 8", () => {
    expect(financeAutomations([], [receipt(7, true)], NOW).handovers).toEqual([]);
    expect(financeAutomations([], [receipt(8, true)], NOW).handovers[0]).toMatchObject({
      to: { role: "finance_approver" },
      why: "approved on condition of a receipt within 7 days",
    });
    expect(financeAutomations([], [receipt(8, false)], NOW).handovers).toEqual([]);
  });
});
