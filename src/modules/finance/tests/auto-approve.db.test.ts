// Automatic rule 3: money requests under the camp's limit are approved straight away, within
// what's left of the budget. The treasurer sees each one in "Approved this week without you".
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { Actor, setAutomationSetting } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { financeSpendRequests } from "../schema";
import { autoApprovedSince, stepsOf } from "../server/queries";
import { createRequest } from "../server/requests";
import { financeCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;
const row = async (id: string) =>
  (await getDb().select().from(financeSpendRequests).where(eq(financeSpendRequests.id, id)))[0];
const limit = (cents: number) =>
  setAutomationSetting(
    { db: getDb(), actor: Actor.system(EDITION.id), edition: EDITION },
    "auto_approve_limit_cents",
    cents,
  );
async function ask(amount: string) {
  await actAs(p.member);
  return ok(createRequest({ teamId: p.kitchen, title: "Spices", amount, submit: true }));
}

describe("small requests approve themselves", () => {
  beforeEach(async () => {
    p = await financeCamp();
  });

  it("under the limit: approved at once, no approver step, audited and announced", async () => {
    const a = await ask("180");
    expect(await row(a.id)).toMatchObject({ status: "approved", autoApproved: true });
    expect(await stepsOf(getDb(), a.id)).toEqual([]);
    const audit = await getDb()
      .select()
      .from(baseTables.auditEvents)
      .where(eq(baseTables.auditEvents.action, "finance.spend.auto_approved"));
    expect(audit).toHaveLength(1);
    const events = await getDb().select().from(baseTables.domainEvents);
    expect(events.map((e) => e.name)).toEqual(["finance.spend.decided"]);
  });

  it("at or over the limit, or with the rule off, it waits for a person as before", async () => {
    const big = await ask("500");
    expect((await row(big.id))?.status).toBe("submitted");
    await limit(0);
    const small = await ask("50");
    expect(await row(small.id)).toMatchObject({ status: "submitted", autoApproved: false });
  });

  it("the treasurer's weekly list shows each one with the total; others can't see it", async () => {
    await ask("180");
    await ask("95");
    await ask("900");
    const since = new Date(Date.now() - 7 * 86_400_000);
    const list = await autoApprovedSince(getDb(), EDITION.id, await actorFor(p.finance), since);
    expect(list.items.map((i) => i.estimatedCents).sort()).toEqual([18_000, 9_500]);
    expect(list.totalCents).toBe(27_500);
    const member = await autoApprovedSince(getDb(), EDITION.id, await actorFor(p.member), since);
    expect(member.items).toEqual([]);
  });
});
