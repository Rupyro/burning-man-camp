// Who sees which requests, and the budget sums (docs/specs/finance.md §2, §4).
import { beforeEach, describe, expect, it } from "vitest";
import { actorFor, EDITION, getDb } from "@/base/api/testing-db";
import {
  financeBudgets,
  financeExpenses,
  financeRequestSteps,
  financeSpendRequests,
} from "../schema";
import { inboxFor, summaryFor, teamsOf, visibleRequests } from "../server/queries";
import { financeCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;

async function request(
  seq: number,
  by: string,
  teamId: string,
  status: "submitted" | "approved" | "purchased",
  cents: number,
) {
  const [budget] = await getDb().select().from(financeBudgets);
  const [row] = await getDb()
    .insert(financeSpendRequests)
    .values({
      editionId: EDITION.id,
      refSeq: seq,
      refCode: `TST-SR-00${seq}`,
      budgetId: budget?.id ?? "",
      teamId,
      requesterPersonId: by,
      title: `Request ${seq}`,
      estimatedCents: cents,
      status,
      submittedAt: new Date(),
    })
    .returning();
  await getDb()
    .insert(financeRequestSteps)
    .values({
      spendRequestId: row?.id ?? "",
      round: 1,
      position: 0,
      approverKind: "team_lead",
      requesterPersonId: by,
      ...(status === "submitted"
        ? {}
        : {
            status: "approved",
            reasonCode: "within_budget",
            decidedByPersonId: p.camp,
            decidedAt: new Date(),
          }),
    });
  return row?.id ?? "";
}

describe("finance queries", () => {
  beforeEach(async () => {
    p = await financeCamp();
  });

  it("each person sees only the requests they may (own, their team as lead, finance)", async () => {
    const k = await request(1, p.member, p.kitchen, "submitted", 90_000);
    const g = await request(2, p.giftLead, p.gifts, "submitted", 50_000);
    const ids = async (who: string) =>
      (await visibleRequests(getDb(), EDITION.id, await actorFor(who))).map((x) => x.id).sort();
    expect(await ids(p.member)).toEqual([k]);
    expect(await ids(p.lead)).toEqual([k]);
    expect(await ids(p.giftLead)).toEqual([g]);
    expect(await ids(p.finance)).toEqual([k, g].sort());
    expect(await ids(p.outsider)).toEqual([]);
    const inbox = async (who: string) =>
      (await inboxFor(getDb(), EDITION.id, await actorFor(who))).map((x) => x.id);
    expect(await inbox(p.lead)).toEqual([k]);
    expect(await inbox(p.member)).toEqual([]);
    expect(await inbox(p.giftLead)).toEqual([]); // can't decide their own
    expect(await inbox(p.camp)).toEqual([k, g]); // camp lead stands in for any step
  });

  it("sums budget, committed, actual and remaining per team", async () => {
    await request(1, p.member, p.kitchen, "approved", 300_000);
    const bought = await request(2, p.member, p.kitchen, "purchased", 100_000);
    await request(3, p.member, p.kitchen, "submitted", 50_000);
    await getDb().insert(financeExpenses).values({
      editionId: EDITION.id,
      spendRequestId: bought,
      teamId: p.kitchen,
      payerPersonId: p.member,
      paidWith: "personal",
      amountCents: 95_001,
      spentOn: "2027-03-01",
      description: "Gas",
    });
    const s = await summaryFor(getDb(), EDITION.id);
    expect(
      s.rows.map((r) => [
        r.teamName,
        r.committedCents,
        r.actualCents,
        r.pendingCents,
        r.remainingCents,
      ]),
    ).toEqual([
      ["Gift projects", 0, 0, 0, 100_000],
      ["Kitchen", 300_000, 95_001, 50_000, 6_000_000 - 300_000 - 95_001],
    ]);
    expect((await summaryFor(getDb(), EDITION.id, [p.gifts])).rows).toHaveLength(1);
    expect((await summaryFor(getDb(), EDITION.id, [])).rows).toEqual([]);
  });

  it("lists the teams a person is on", async () => {
    expect(await teamsOf(getDb(), await actorFor(p.member))).toEqual([
      { id: p.kitchen, name: "Kitchen" },
    ]);
    expect(await teamsOf(getDb(), await actorFor(p.outsider))).toEqual([]);
  });
});
