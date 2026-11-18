// Procurement ↔ Finance round trip through the outbox (procurement spec §6, P5; finance README):
// a lead asks finance for a gap → Finance drafts a spend request for them with a soft ref to the
// need → they send it → the decision comes back as finance.spend.decided with that `source` →
// the need moves. Both modules stay unaware of each other's tables.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import {
  actAs,
  baseTables,
  createPerson,
  dispatchPending,
  EDITION,
  getDb,
} from "@/base/api/testing-db";
import { eventContracts } from "@/contracts/events";
import { financeBudgets, financeSpendRequests } from "@/modules/finance/schema";
import { insertPlaceholderPolicies } from "@/modules/finance/server/policies";
import { decideRequest, submitRequest } from "@/modules/finance/server/requests";
import { procurementNeeds } from "@/modules/procurement/schema";
import { askFinance, raiseNeed } from "@/modules/procurement/server/needs";
import { procurementCamp } from "@/modules/procurement/tests/fixtures";

const { domainEvents, domainEventDeliveries } = baseTables;
const fr = financeSpendRequests;
let p: Awaited<ReturnType<typeof procurementCamp>>;

const drafts = (needId: string) =>
  getDb()
    .select()
    .from(fr)
    .where(and(eq(fr.sourceRefType, "procurement.need"), eq(fr.sourceRefId, needId)));
const needRow = async (id: string) =>
  (await getDb().select().from(procurementNeeds).where(eq(procurementNeeds.id, id)))[0];

async function staplerGap(teamId = p.gifts, who = p.member) {
  await actAs(who);
  return ok(raiseNeed({ teamId, itemId: p.item.stapleGun, quantity: "4", neededBy: "2027-04-01" }));
}

describe("procurement asks finance", () => {
  beforeEach(async () => {
    p = await procurementCamp();
    await insertPlaceholderPolicies(getDb(), EDITION.id);
    // Gifts has a budget; Kitchen deliberately doesn't.
    await getDb().insert(financeBudgets).values({
      editionId: EDITION.id,
      teamId: p.gifts,
      name: "Gift projects",
      amountCents: 1_000_000,
    });
  });

  it("drafts a spend request for the lead who asked; the decision moves the need", async () => {
    const { id } = await staplerGap();
    await actAs(p.lead);
    await ok(askFinance({ id, estimate: "1350" }));
    expect(await dispatchPending()).toMatchObject({ failed: 0 });

    const [d] = await drafts(id);
    expect(d).toMatchObject({
      status: "draft",
      requesterPersonId: p.lead,
      teamId: p.gifts,
      title: "Buy 3 pcs Staple gun",
      estimatedCents: 135_000,
      neededBy: "2027-04-01",
      submittedAt: null,
    });

    // A duplicate delivery of the same ask changes nothing.
    const [ask] = (await getDb().select().from(domainEvents)).filter(
      (e) => e.name === "procurement.need.purchase_requested",
    );
    const [dup] = await getDb()
      .insert(domainEvents)
      .values({ ...ask, id: undefined, createdAt: undefined } as typeof domainEvents.$inferInsert)
      .returning();
    await getDb()
      .insert(domainEventDeliveries)
      .values({ eventId: dup?.id ?? "", handlerModule: "finance", nextAttemptAt: new Date(0) });
    expect(await dispatchPending()).toMatchObject({ failed: 0 });
    expect(await drafts(id)).toHaveLength(1);

    // The lead checks it and sends it; the camp lead approves (R1,350 is "small, within budget").
    await ok(submitRequest({ id: d?.id ?? "" }));
    await actAs(p.camp);
    expect(await ok(decideRequest({ id: d?.id ?? "", decision: "approved" }))).toMatchObject({
      status: "approved",
    });
    const [decided] = (await getDb().select().from(domainEvents)).filter(
      (e) => e.name === "finance.spend.decided",
    );
    expect(eventContracts["finance.spend.decided"].parse(decided?.payload)).toMatchObject({
      decision: "approved",
      source: { refType: "procurement.need", refId: id },
    });
    expect(await dispatchPending()).toMatchObject({ failed: 0 });
    expect(await needRow(id)).toMatchObject({ status: "to_buy", spendRequestRefId: d?.id });
  });

  it("turned down: the need goes back to needed, and asking again drafts a fresh request", async () => {
    const { id } = await staplerGap();
    await actAs(p.lead);
    await ok(askFinance({ id, estimate: "1350" }));
    await dispatchPending();
    const [d] = await drafts(id);
    await ok(submitRequest({ id: d?.id ?? "" }));
    await actAs(p.camp);
    await ok(
      decideRequest({
        id: d?.id ?? "",
        decision: "rejected",
        comment: "Borrow them from Khoena",
      }),
    );
    await dispatchPending();
    expect((await needRow(id))?.status).toBe("needed");

    await actAs(p.lead);
    await ok(askFinance({ id }));
    await dispatchPending();
    const all = await drafts(id);
    expect(all.map((x) => x.status).sort()).toEqual(["draft", "rejected"]);
  });

  it("no team budget: no draft, the need waits in 'asked finance' for a lead", async () => {
    const kitchenMember = await createPerson({
      email: "k@example.test",
      name: "Kit",
      teams: [{ key: "kitchen", role: "member" }],
    });
    const { id } = await staplerGap(p.kitchen, kitchenMember);
    await actAs(p.kitchenLead);
    await ok(askFinance({ id, estimate: "900" }));
    expect(await dispatchPending()).toMatchObject({ failed: 0 });
    expect(await drafts(id)).toHaveLength(0);
    expect((await needRow(id))?.status).toBe("purchase_requested");
  });

  it("finance needs a rough amount before it can draft anything", async () => {
    const { id } = await staplerGap();
    await actAs(p.lead);
    await expect(ok(askFinance({ id }))).rejects.toBeInstanceOf(ValidationError);
    expect((await needRow(id))?.status).toBe("needed");
  });
});
