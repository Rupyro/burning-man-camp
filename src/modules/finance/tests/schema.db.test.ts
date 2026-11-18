// The database itself refuses self-approval and non-positive amounts (docs/specs/finance.md §2).
import { beforeEach, describe, expect, it } from "vitest";
import { teams } from "@/base/api/schema";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import { financeBudgets, financeRequestSteps, financeSpendRequests } from "../schema";

let requester: string;
let other: string;
let requestId: string;

describe("finance tables", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    requester = await createPerson({ email: "r@example.test", name: "R" });
    other = await createPerson({ email: "o@example.test", name: "O" });
    const [team] = await getDb().select().from(teams);
    const [budget] = await getDb()
      .insert(financeBudgets)
      .values({ editionId: EDITION.id, teamId: team?.id, name: "Kitchen", amountCents: 100 })
      .returning();
    const [req] = await getDb()
      .insert(financeSpendRequests)
      .values({
        editionId: EDITION.id,
        refSeq: 1,
        refCode: "TST-SR-001",
        budgetId: budget?.id ?? "",
        teamId: team?.id ?? "",
        requesterPersonId: requester,
        title: "Gas",
        estimatedCents: 450000,
      })
      .returning();
    requestId = req?.id ?? "";
  });

  it("refuses a decided step where decider = requester", async () => {
    const row = {
      spendRequestId: requestId,
      round: 1,
      position: 0,
      approverKind: "team_lead" as const,
      requesterPersonId: requester,
      status: "approved" as const,
      reasonCode: "within_budget" as const,
      decidedAt: new Date(),
    };
    await expect(
      getDb()
        .insert(financeRequestSteps)
        .values({ ...row, decidedByPersonId: requester }),
    ).rejects.toThrow();
    await getDb()
      .insert(financeRequestSteps)
      .values({ ...row, decidedByPersonId: other });
    expect(await getDb().select().from(financeRequestSteps)).toHaveLength(1);
  });

  it("a step is pending exactly when undecided; a role step names its role", async () => {
    const row = {
      spendRequestId: requestId,
      round: 1,
      position: 0,
      requesterPersonId: requester,
    };
    await expect(
      getDb()
        .insert(financeRequestSteps)
        .values({ ...row, approverKind: "team_lead", status: "approved" }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(financeRequestSteps)
        .values({ ...row, approverKind: "role" }),
    ).rejects.toThrow();
    await getDb()
      .insert(financeRequestSteps)
      .values({ ...row, approverKind: "team_lead" });
    await expect(
      getDb()
        .insert(financeRequestSteps)
        .values({ ...row, approverKind: "team_lead" }),
    ).rejects.toThrow(); // one step per (request, round, position)
  });

  it("every decision has a reason that fits it, and next steps fit the reason", async () => {
    const row = {
      spendRequestId: requestId,
      round: 1,
      position: 0,
      approverKind: "team_lead" as const,
      requesterPersonId: requester,
      decidedByPersonId: other,
      decidedAt: new Date(),
    };
    const bad = [
      { status: "approved" as const }, // no reason
      { status: "approved" as const, reasonCode: "over_budget" as const }, // wrong decision
      { status: "rejected" as const, reasonCode: "other" as const }, // "other" needs a note
      { status: "approved" as const, reasonCode: "approved_with_condition" as const }, // no condition
      {
        status: "approved" as const,
        reasonCode: "within_budget" as const,
        nextStep: "close" as const,
      },
      {
        status: "approved" as const,
        reasonCode: "approved_with_condition" as const,
        nextStep: "cap_amount" as const,
      }, // cap without an amount
      {
        status: "rejected" as const,
        reasonCode: "wrong_budget" as const,
        nextStep: "move_budget" as const,
      },
    ];
    for (const b of bad)
      await expect(
        getDb()
          .insert(financeRequestSteps)
          .values({ ...row, ...b }),
      ).rejects.toThrow();
    await expect(
      getDb().insert(financeRequestSteps).values({
        spendRequestId: requestId,
        round: 1,
        position: 3,
        approverKind: "team_lead",
        requesterPersonId: requester,
        reasonCode: "within_budget",
      }),
    ).rejects.toThrow(); // a pending step has no reason yet
    await getDb()
      .insert(financeRequestSteps)
      .values({
        ...row,
        status: "approved",
        reasonCode: "approved_with_condition",
        nextStep: "cap_amount",
        capAmountCents: 50_000,
      });
    await getDb()
      .insert(financeRequestSteps)
      .values({ ...row, position: 1, status: "rejected", reasonCode: "other", comment: "Ask Lex" });
    await getDb()
      .insert(financeRequestSteps)
      .values({ ...row, position: 2, status: "rejected", reasonCode: "over_budget" });
  });

  it("refuses zero or negative amounts", async () => {
    await expect(getDb().update(financeSpendRequests).set({ estimatedCents: 0 })).rejects.toThrow();
  });
});
