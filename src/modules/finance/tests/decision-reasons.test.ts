import { describe, expect, it } from "vitest";
import { decisionProblem, NEXT_FOR, REASONS_FOR } from "../rules/decision-reasons";

describe("decision tree (plan-money-taps.md)", () => {
  it("three reasons per decision, three next steps where offered", () => {
    for (const r of Object.values(REASONS_FOR)) expect(r).toHaveLength(3);
    for (const n of Object.values(NEXT_FOR)) expect(n).toHaveLength(3);
  });
  it("accepts fitting pairs, explains the rest", () => {
    expect(decisionProblem({ decision: "approved", reason: "within_budget" })).toBeNull();
    expect(
      decisionProblem({ decision: "rejected", reason: "over_budget", next: "resubmit_lower" }),
    ).toBeNull();
    expect(decisionProblem({ decision: "approved", reason: "over_budget" })).toMatch(/fit/);
    expect(decisionProblem({ decision: "rejected", reason: "other" })).toMatch(/note/);
    expect(decisionProblem({ decision: "rejected", reason: "other", note: "x" })).toBeNull();
    expect(decisionProblem({ decision: "approved", reason: "approved_with_condition" })).toMatch(
      /condition/,
    );
    expect(
      decisionProblem({
        decision: "approved",
        reason: "approved_with_condition",
        next: "cap_amount",
      }),
    ).toMatch(/cap/);
    expect(
      decisionProblem({ decision: "rejected", reason: "wrong_budget", next: "move_budget" }),
    ).toMatch(/budget/);
    expect(
      decisionProblem({ decision: "approved", reason: "within_budget", next: "close" }),
    ).toMatch(/fit/);
  });
});
