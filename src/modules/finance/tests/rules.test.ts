// Pure finance rules (docs/specs/finance.md §3).
import { describe, expect, it } from "vitest";
import { persona } from "@/base/api/testing";
import { formatRand, MAX_CENTS, parseRand } from "../rules/money";
import { canDecideStep, PLACEHOLDER_POLICIES, type PolicyLike, pickPolicy } from "../rules/policy";
import { findSpendRef, spendRef } from "../rules/ref";
import {
  afterDecision,
  canCancel,
  canEdit,
  nextStepText,
  type SpendStatus,
  STATUS_LABEL,
} from "../rules/status";
import { budgetSummary, summaryCsv } from "../rules/summary";

const KITCHEN = "01900000-0000-7000-8000-00000000a001";
const OTHER_TEAM = "01900000-0000-7000-8000-00000000a002";
const R = (rand: number) => rand * 100;

describe("money", () => {
  it.each([
    ["4500", 450000],
    ["4 500", 450000],
    ["R4,500", 450000],
    ["r 4,500.50", 450050],
    ["900.5", 90050],
    ["0.99", 99],
    ["1,234,567", 123456700],
  ])("parses %s", (input, cents) => {
    expect(parseRand(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "4.555", "4,5", "12,34", "R", "1e5", "0", "10000000.01"])(
    "rejects %s",
    (input) => {
      expect(parseRand(input)).toBeNull();
    },
  );

  it("caps at R10 million", () => {
    expect(parseRand("10,000,000")).toBe(MAX_CENTS);
  });

  it("formats whole and part rands, and negatives", () => {
    expect(formatRand(450000)).toBe("R4,500");
    expect(formatRand(432050)).toBe("R4,320.50");
    expect(formatRand(5)).toBe("R0.05");
    expect(formatRand(0)).toBe("R0");
    expect(formatRand(-120000)).toBe("−R1,200");
    expect(formatRand(123456700)).toBe("R1,234,567");
  });
});

describe("references", () => {
  it("builds OEA-SR-017 style refs", () => {
    expect(spendRef("OEA", 17)).toBe("OEA-SR-017");
    expect(spendRef("oea", 1234)).toBe("OEA-SR-1234");
  });
  it("rejects bad prefixes and sequences", () => {
    expect(() => spendRef("O", 1)).toThrow();
    expect(() => spendRef("OE-A", 1)).toThrow();
    expect(() => spendRef("OEA", 0)).toThrow();
    expect(() => spendRef("OEA", 1.5)).toThrow();
  });
  it("finds a ref in free text", () => {
    expect(findSpendRef("receipt for oea-sr-017 gas")).toBe("OEA-SR-017");
    expect(findSpendRef("no ref here OEA-DUES-017")).toBeNull();
  });
});

describe("policy pick (placeholders)", () => {
  const policies: PolicyLike[] = PLACEHOLDER_POLICIES.map((p, i) => ({ ...p, id: `p${i}` }));
  it("R900 within budget → team lead", () => {
    expect(pickPolicy(policies, R(900), R(5000))?.requiredSteps).toEqual([
      { approver: "team_lead" },
    ]);
  });
  it("R1,500 exactly within budget → team lead", () => {
    expect(pickPolicy(policies, R(1500), R(1500))?.requiredSteps).toEqual([
      { approver: "team_lead" },
    ]);
  });
  it("R4,500 within budget → finance approver", () => {
    expect(pickPolicy(policies, R(4500), R(60000))?.requiredSteps).toEqual([
      { approver: "role:finance_approver" },
    ]);
  });
  it("R12,000 → finance then camp lead", () => {
    expect(pickPolicy(policies, R(12000), R(60000))?.requiredSteps).toEqual([
      { approver: "role:finance_approver" },
      { approver: "role:camp_lead" },
    ]);
  });
  it("R900 over budget → finance then camp lead", () => {
    expect(pickPolicy(policies, R(900), R(500))?.name).toMatch(/over budget/i);
  });
  it("skips inactive policies and respects sort order", () => {
    const custom: PolicyLike[] = [
      { ...policies[0], id: "x", sortOrder: 9, isActive: true } as PolicyLike,
      { ...policies[1], id: "y", sortOrder: 1, isActive: false } as PolicyLike,
    ];
    expect(pickPolicy(custom, R(100), R(1000))?.id).toBe("x");
    expect(pickPolicy([], R(100), R(1000))).toBeNull();
  });
});

describe("who may decide a step", () => {
  const kitchenLead = persona("team_lead");
  const coLead = persona("member", {
    teams: [{ teamId: KITCHEN, teamKey: "kitchen", role: "co_lead" }],
  });
  const finance = persona("finance_approver");
  const camp = persona("camp_lead");
  const req = (approver: string, requesterId = "someone-else") => ({
    approver,
    requesterId,
    teamId: KITCHEN,
  });

  it("team_lead step: a lead or co-lead of that team, or a camp lead", () => {
    expect(canDecideStep(kitchenLead, req("team_lead"))).toBe(true);
    expect(canDecideStep(coLead, req("team_lead"))).toBe(true);
    expect(canDecideStep(camp, req("team_lead"))).toBe(true);
    expect(canDecideStep(finance, req("team_lead"))).toBe(false);
    expect(canDecideStep(kitchenLead, { ...req("team_lead"), teamId: OTHER_TEAM })).toBe(false);
  });
  it("role step: holders of the role, or a camp lead", () => {
    expect(canDecideStep(finance, req("role:finance_approver"))).toBe(true);
    expect(canDecideStep(camp, req("role:finance_approver"))).toBe(true);
    expect(canDecideStep(kitchenLead, req("role:finance_approver"))).toBe(false);
    expect(canDecideStep(finance, req("role:camp_lead"))).toBe(false);
    expect(canDecideStep(camp, req("role:camp_lead"))).toBe(true);
  });
  it("nobody decides their own request, at any step", () => {
    for (const a of [kitchenLead, finance, camp]) {
      for (const step of ["team_lead", "role:finance_approver", "role:camp_lead"])
        expect(canDecideStep(a, req(step, a.personId ?? ""))).toBe(false);
    }
  });
  it("admins have no money powers; non-members and unknown approvers are refused", () => {
    expect(canDecideStep(persona("admin"), req("role:finance_approver"))).toBe(false);
    expect(
      canDecideStep(
        persona("finance_approver", { memberStatus: "waitlisted" }),
        req("role:finance_approver"),
      ),
    ).toBe(false);
    expect(canDecideStep(persona("member", { personId: null }), req("team_lead"))).toBe(false);
    expect(canDecideStep(finance, req("someone"))).toBe(false);
  });
});

describe("status machine", () => {
  it("approving a middle step moves on; the last step approves", () => {
    expect(afterDecision(true, "approved")).toBe("submitted");
    expect(afterDecision(false, "approved")).toBe("approved");
  });
  it("reject is final; needs_info goes back to the requester", () => {
    expect(afterDecision(true, "rejected")).toBe("rejected");
    expect(afterDecision(true, "needs_info")).toBe("needs_info");
  });
  it("edit only in draft or needs_info; cancel until purchased", () => {
    const all: SpendStatus[] = [
      "draft",
      "submitted",
      "needs_info",
      "approved",
      "rejected",
      "cancelled",
      "purchased",
      "closed",
    ];
    expect(all.filter(canEdit)).toEqual(["draft", "needs_info"]);
    expect(all.filter(canCancel)).toEqual(["draft", "submitted", "needs_info", "approved"]);
    for (const s of all) expect(STATUS_LABEL[s]).toBeTruthy();
  });
  it("says what happens next in plain words", () => {
    expect(nextStepText("submitted", "role:finance_approver")).toBe(
      "Waiting for a finance approver",
    );
    expect(nextStepText("submitted", "team_lead")).toBe("Waiting for the team lead");
    expect(nextStepText("submitted", "role:camp_lead")).toBe("Waiting for the camp lead");
    expect(nextStepText("submitted", null)).toBe("Waiting for approval");
    expect(nextStepText("approved", null)).toBe("Approved: buy it, then add what it cost");
    expect(nextStepText("needs_info", null)).toBe("Sent back: answer the question and resubmit");
    expect(nextStepText("purchased", null)).toBe("Bought: waiting for the pay-back");
    expect(nextStepText("draft", null)).toBe("Draft: not sent yet");
    expect(nextStepText("closed", null)).toBe("Done");
    expect(nextStepText("rejected", null)).toBe("Turned down");
    expect(nextStepText("cancelled", null)).toBe("Cancelled");
  });
});

describe("budget summary", () => {
  const budgets = [
    { teamId: "k", teamName: "Kitchen", amountCents: R(10000) },
    { teamId: "g", teamName: "Gift projects", amountCents: R(2000) },
  ];
  const requests = [
    { teamId: "k", status: "approved" as const, estimatedCents: R(3000), hasExpense: false },
    { teamId: "k", status: "purchased" as const, estimatedCents: R(1000), hasExpense: true },
    { teamId: "k", status: "submitted" as const, estimatedCents: R(500), hasExpense: false },
    { teamId: "g", status: "approved" as const, estimatedCents: R(2500), hasExpense: false },
    { teamId: "g", status: "rejected" as const, estimatedCents: R(999), hasExpense: false },
  ];
  const expenses = [
    { teamId: "k", amountCents: R(950) },
    { teamId: "k", amountCents: 1 },
  ];

  it("computes committed, actual, remaining and pending per team, and camp totals", () => {
    const s = budgetSummary(budgets, requests, expenses);
    expect(s.rows).toEqual([
      {
        teamId: "g",
        teamName: "Gift projects",
        budgetCents: R(2000),
        committedCents: R(2500),
        actualCents: 0,
        pendingCents: 0,
        remainingCents: R(-500),
        overBudget: true,
      },
      {
        teamId: "k",
        teamName: "Kitchen",
        budgetCents: R(10000),
        committedCents: R(3000),
        actualCents: R(950) + 1,
        pendingCents: R(500),
        remainingCents: R(10000) - R(3000) - R(950) - 1,
        overBudget: false,
      },
    ]);
    expect(s.total.budgetCents).toBe(R(12000));
    expect(s.total.remainingCents).toBe(R(12000) - R(5500) - R(950) - 1);
  });

  it("CSV reproduces the summary totals exactly", () => {
    const s = budgetSummary(budgets, requests, expenses);
    const csv = summaryCsv(s).trim().split("\n");
    expect(csv[0]).toBe(
      "Team,Budget (R),Committed (R),Spent (R),Waiting approval (R),Remaining (R)",
    );
    expect(csv[2]).toBe("Kitchen,10000.00,3000.00,950.01,500.00,6049.99");
    expect(csv.at(-1)).toBe("Total,12000.00,5500.00,950.01,500.00,5549.99");
  });

  it("quotes awkward team names", () => {
    const s = budgetSummary([{ teamId: "x", teamName: 'Sound, "lights"', amountCents: 0 }], [], []);
    expect(summaryCsv(s).split("\n")[1]).toBe('"Sound, ""lights""",0.00,0.00,0.00,0.00,0.00');
  });
});
