// Needs through the guard: have-it check, status moves, critical flag, asking finance, and
// Finance's decision coming back as an event (spec §3, §6, P4-P6; PLAN "Done when").
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { tasks } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, baseTables, dispatchPending, EDITION, getDb } from "@/base/api/testing-db";
import { eventContracts } from "@/contracts/events";
import { procurementNeeds } from "../schema";
import { askFinance, editNeed, moveNeed, raiseNeed, setCritical } from "../server/needs";
import { getNeed, listNeeds, needResource } from "../server/queries";
import { procurementCamp } from "./fixtures";

const { domainEvents, domainEventDeliveries, auditEvents } = baseTables;
let p: Awaited<ReturnType<typeof procurementCamp>>;
const need = async (id: string) => getNeed(getDb(), EDITION.id, id);

async function raise(who = p.member, q = "4", item = p.item.stapleGun) {
  await actAs(who);
  return ok(raiseNeed({ teamId: p.gifts, itemId: item, quantity: q, neededBy: "2027-04-01" }));
}

/** What Finance does when it decides: emit finance.spend.decided (with our need as the source). */
async function financeDecides(needId: string, decision: "approved" | "rejected") {
  const payload = {
    v: 1 as const,
    spendRequestId: "01900000-0000-7000-8000-0000000000f1",
    refCode: "TST-SR-001",
    decision,
    editionId: EDITION.id,
    source: { refType: "procurement.need", refId: needId },
  };
  eventContracts["finance.spend.decided"].parse(payload);
  const [e] = await getDb()
    .insert(domainEvents)
    .values({
      name: "finance.spend.decided",
      version: 1,
      payload,
      emittedByModule: "finance",
      editionId: EDITION.id,
    })
    .returning();
  await getDb()
    .insert(domainEventDeliveries)
    .values({ eventId: e?.id ?? "", handlerModule: "procurement", nextAttemptAt: new Date(0) });
  return e;
}

describe("needs", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("4 staple guns: we own 2 (1 broken) in Container A, so buy 3", async () => {
    const r = await raise();
    expect(r.check).toMatchObject({ usable: 1, gap: 3, suggestion: "buy" });
    expect(r.check.text).toBe("We own 2 (1 broken or missing) in Container A. Buy 3.");
    const row = await need(r.id);
    expect(row).toMatchObject({
      status: "needed",
      ownerPersonId: p.member,
      teamName: "Gift projects",
    });
    const [db] = await getDb().select().from(procurementNeeds);
    expect(db?.quantityOnHandSnapshot).toBe(1);
  });

  it("only the team's members raise needs; only its leads and camp leads manage them", async () => {
    await actAs(p.kitchenLead);
    await expect(
      ok(raiseNeed({ teamId: p.gifts, itemId: p.item.stapleGun, quantity: "1" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(raise(p.member, "0")).rejects.toBeInstanceOf(ValidationError);
    await expect(
      raise(p.member, "1", "01900000-0000-7000-8000-00000000dead"),
    ).rejects.toBeInstanceOf(ValidationError);
    const { id } = await raise();
    for (const who of [p.member, p.kitchenLead, p.admin]) {
      await actAs(who);
      await expect(ok(moveNeed({ id, to: "to_buy" }))).rejects.toBeInstanceOf(ForbiddenError);
      await expect(ok(setCritical({ id, critical: true }))).rejects.toBeInstanceOf(ForbiddenError);
    }
    await actAs(p.camp);
    expect(await ok(moveNeed({ id, to: "to_buy" }))).toEqual({ ok: true, status: "to_buy" });
    // A crafted id for a need that doesn't exist checks against a team nobody leads.
    expect(await needResource(getDb(), EDITION.id, "01900000-0000-7000-8000-00000000dead")).toEqual(
      {
        teamId: "00000000-0000-0000-0000-000000000000",
      },
    );
  });

  it("status moves follow the machine and are audited; received closes the buy task", async () => {
    const { id } = await raise();
    await actAs(p.lead);
    await expect(ok(moveNeed({ id, to: "received" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(ok(moveNeed({ id, to: "purchase_requested" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await ok(moveNeed({ id, to: "to_buy" }));
    const { taskId } = await ok(askFinance({ id, estimate: "$1,350" }));
    expect(taskId).toBeTruthy();
    await actAs(p.camp);
    await financeDecides(id, "approved");
    await dispatchPending();
    await actAs(p.lead);
    await ok(moveNeed({ id, to: "ordered" }));
    await ok(moveNeed({ id, to: "received" }));
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId ?? ""));
    expect(t?.status).toBe("done");
    await expect(ok(moveNeed({ id, to: "needed" }))).rejects.toBeInstanceOf(ValidationError);
    const moves = (await getDb().select().from(auditEvents)).filter(
      (a) => a.action === "procurement.need.moved",
    );
    expect(moves.map((m) => (m.changes as { status: string[] }).status[1])).toEqual([
      "to_buy",
      "ordered",
      "received",
    ]);
  });

  it("flagging critical emits a valid marked_critical event once", async () => {
    const { id } = await raise(p.member, "1", p.item.generator);
    await actAs(p.lead);
    expect(await ok(setCritical({ id, critical: true }))).toEqual({ ok: true, changed: true });
    expect(await ok(setCritical({ id, critical: true }))).toEqual({ ok: true, changed: false });
    await ok(setCritical({ id, critical: false }));
    const events = (await getDb().select().from(domainEvents)).filter(
      (e) => e.name === "procurement.need.marked_critical",
    );
    expect(events).toHaveLength(1);
    expect(
      eventContracts["procurement.need.marked_critical"].parse(events[0]?.payload),
    ).toMatchObject({
      needId: id,
      itemName: "Generator 5 kVA",
      quantity: 1,
    });
    await ok(moveNeed({ id, to: "cancelled" }));
    await expect(ok(setCritical({ id, critical: true }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("asking finance: event for the gap, a buy task for the converter, then the decision comes back", async () => {
    const { id } = await raise();
    await actAs(p.lead);
    await expect(ok(askFinance({ id, estimate: "abc" }))).rejects.toBeInstanceOf(ValidationError);
    const { taskId } = await ok(askFinance({ id, estimate: "1350" }));
    const row = await need(id);
    expect(row).toMatchObject({ status: "purchase_requested", estimateCents: 135_000, taskId });
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId ?? ""));
    expect(t).toMatchObject({
      kind: "procurement.buy",
      ownerPersonId: p.lead,
      title: "Buy 3 pcs Staple gun",
    });
    const [e] = (await getDb().select().from(domainEvents)).filter(
      (x) => x.name === "procurement.need.purchase_requested",
    );
    expect(eventContracts["procurement.need.purchase_requested"].parse(e?.payload)).toMatchObject({
      needId: id,
      quantity: 3,
      estimateCents: 135_000,
      requesterPersonId: p.lead,
    });
    await expect(ok(askFinance({ id }))).rejects.toBeInstanceOf(ValidationError);

    // Turned down → back to needed; a duplicate delivery changes nothing.
    await financeDecides(id, "rejected");
    await financeDecides(id, "rejected");
    expect(await dispatchPending()).toMatchObject({ failed: 0 });
    expect((await need(id))?.status).toBe("needed");
    const decided = (await getDb().select().from(auditEvents)).filter(
      (a) => a.action === "procurement.need.spend_decided",
    );
    expect(decided).toHaveLength(1);

    // Ask again, approved → to buy with the spend request ref.
    await ok(askFinance({ id }));
    await financeDecides(id, "approved");
    await dispatchPending();
    expect(await need(id)).toMatchObject({
      status: "to_buy",
      spendRequestRefId: "01900000-0000-7000-8000-0000000000f1",
    });
  });

  it("a decision about something else is ignored", async () => {
    const { id } = await raise();
    const [e] = await getDb()
      .insert(domainEvents)
      .values({
        name: "finance.spend.decided",
        version: 1,
        payload: {
          v: 1,
          spendRequestId: id,
          refCode: "X",
          decision: "approved",
          editionId: EDITION.id,
        },
        emittedByModule: "finance",
        editionId: EDITION.id,
      })
      .returning();
    await getDb()
      .insert(domainEventDeliveries)
      .values({ eventId: e?.id ?? "", handlerModule: "procurement", nextAttemptAt: new Date(0) });
    expect(await dispatchPending()).toMatchObject({ done: 1, failed: 0 });
    expect((await need(id))?.status).toBe("needed");
  });

  it("we already have enough: nothing to ask finance for", async () => {
    const { id, check } = await raise(p.member, "1");
    expect(check).toMatchObject({ gap: 0, suggestion: "have_it" });
    await actAs(p.lead);
    await expect(ok(askFinance({ id }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("the raiser edits while it's still needed; leads any time; others never", async () => {
    const { id } = await raise();
    await actAs(p.member);
    await ok(editNeed({ id, quantity: "5", notes: "for the Cloud build" }));
    expect(await need(id)).toMatchObject({ quantityNeeded: 5, notes: "for the Cloud build" });
    await actAs(p.kitchenLead);
    await expect(ok(editNeed({ id, quantity: "6" }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.lead);
    await ok(moveNeed({ id, to: "to_buy" }));
    await ok(editNeed({ id, estimate: "$900", neededBy: null }));
    expect(await need(id)).toMatchObject({ estimateCents: 90_000, neededBy: null });
    await actAs(p.member);
    await expect(ok(editNeed({ id, quantity: "2" }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.lead);
    await ok(moveNeed({ id, to: "cancelled" }));
    await expect(ok(editNeed({ id, notes: "x" }))).rejects.toBeInstanceOf(ValidationError);
    expect((await listNeeds(getDb(), EDITION.id, { teamIds: [] })).length).toBe(0);
    expect((await listNeeds(getDb(), EDITION.id, { teamIds: [p.gifts] })).length).toBe(1);
  });
});
