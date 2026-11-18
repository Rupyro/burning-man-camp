// "Resubmit lower" and "Move to the right budget" give the requester a copied draft in one tap.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, getDb } from "@/base/api/testing-db";
import { financeBudgets, financeSpendRequests } from "../schema";
import { createRequest, decideRequest, resubmitCopy } from "../server/requests";
import { financeCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;
const row = async (id: string) =>
  (await getDb().select().from(financeSpendRequests).where(eq(financeSpendRequests.id, id)))[0];

describe("resubmit from a tapped next step", () => {
  beforeEach(async () => {
    p = await financeCamp();
  });

  it("move budget: the copy lands on the other team's budget; only the requester can make it", async () => {
    await actAs(p.member);
    const a = await ok(
      createRequest({
        teamId: p.kitchen,
        title: "Fairy lights",
        amount: "900",
        submit: true,
      }),
    );
    const [gifts] = await getDb()
      .select()
      .from(financeBudgets)
      .where(eq(financeBudgets.teamId, p.gifts));
    await actAs(p.lead);
    await ok(
      decideRequest({
        id: a.id,
        decision: "rejected",
        reason: "wrong_budget",
        next: "move_budget",
        moveToBudgetId: gifts?.id ?? null,
      }),
    );
    await expect(ok(resubmitCopy({ id: a.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.member);
    const copy = await ok(resubmitCopy({ id: a.id }));
    expect(await row(copy.id)).toMatchObject({
      teamId: p.gifts,
      budgetId: gifts?.id,
      title: "Fairy lights",
      status: "draft",
    });
  });

  it("only after resubmit lower / move budget", async () => {
    await actAs(p.member);
    const a = await ok(
      createRequest({ teamId: p.kitchen, title: "Gas", amount: "900", submit: true }),
    );
    await actAs(p.lead);
    await ok(
      decideRequest({ id: a.id, decision: "rejected", reason: "not_needed", next: "close" }),
    );
    await actAs(p.member);
    await expect(ok(resubmitCopy({ id: a.id }))).rejects.toBeInstanceOf(ValidationError);
  });
});
