// Money automations, rules 10–12 (automation plan).
import { describe, expect, it } from "vitest";
import {
  AUTO_APPROVE_LIMIT_CENTS,
  autoApprovable,
  financeAutomations,
  type ReceiptFact,
  type WaitingFact,
} from "../rules/automations";

const NOW = new Date("2027-03-01T08:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const waiting = (days: number): WaitingFact => ({
  requestId: "r1",
  refCode: "OEA-SR-001",
  title: "Gas",
  estimatedCents: 450_000,
  waitingSince: ago(days),
  approverIds: ["fin1", "fin2"],
});
const receipt = (days: number): ReceiptFact => ({
  expenseId: "e1",
  requestId: "r1",
  refCode: "OEA-SR-002",
  amountCents: 115_050,
  payerPersonId: "sam",
  payerName: "Sam",
  boughtAt: ago(days),
});

describe("rule 10: auto-approve (off)", () => {
  it("has no limits set, so nothing qualifies", () => {
    expect(AUTO_APPROVE_LIMIT_CENTS).toEqual({});
    expect(autoApprovable(100, 1_000_000, AUTO_APPROVE_LIMIT_CENTS.kitchen)).toBe(false);
  });
  it("with a limit: under it and within the remaining budget only", () => {
    expect(autoApprovable(50_000, 60_000, 100_000)).toBe(true);
    expect(autoApprovable(150_000, 900_000, 100_000)).toBe(false);
    expect(autoApprovable(50_000, 40_000, 100_000)).toBe(false);
  });
});

describe("rule 11: approval waiting", () => {
  it("reminds every approver at 3 days and hands to the camp lead at 6", () => {
    expect(financeAutomations([waiting(2)], [], NOW)).toEqual({ reminders: [], handovers: [] });
    const at3 = financeAutomations([waiting(3)], [], NOW);
    expect(at3.reminders.map((r) => [r.personId, r.stage])).toEqual([
      ["fin1", "d3"],
      ["fin2", "d3"],
    ]);
    expect(at3.handovers).toEqual([]);
    expect(financeAutomations([waiting(6)], [], NOW).handovers[0]).toMatchObject({
      what: "Request waiting 6 days",
      about: "OEA-SR-001 Gas",
      to: { role: "camp_lead" },
    });
  });
});

describe("rule 12: receipt chasing", () => {
  it("reminds the buyer on days 3, 7 and 14, then finance", () => {
    expect(financeAutomations([], [receipt(2)], NOW).reminders).toEqual([]);
    expect(financeAutomations([], [receipt(7)], NOW).reminders[0]).toMatchObject({
      personId: "sam",
      stage: "d7",
      title: "Add the receipt for OEA-SR-002 (R1,150.50)",
    });
    expect(financeAutomations([], [receipt(14)], NOW).handovers).toEqual([]);
    expect(financeAutomations([], [receipt(15)], NOW).handovers[0]).toMatchObject({
      what: "No receipt: R1,150.50",
      about: "Sam",
      to: { role: "finance_approver" },
    });
  });
});
