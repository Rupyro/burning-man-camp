// Spend requests through the guard (docs/specs/finance.md "Done when").
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { tasks } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, actorFor, baseTables, EDITION, getDb } from "@/base/api/testing-db";
import { financeRequestSteps, financeSpendRequests } from "../schema";
import { inboxFor, stepsOf, summaryFor } from "../server/queries";
import {
  cancelRequest,
  createRequest,
  decideRequest,
  editRequest,
  submitRequest,
} from "../server/requests";
import { financeCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;
const chain = async (id: string) =>
  (await stepsOf(getDb(), id)).map((s) => `${s.round}.${s.position} ${s.approver} ${s.status}`);
const row = async (id: string) =>
  (await getDb().select().from(financeSpendRequests).where(eq(financeSpendRequests.id, id)))[0];

async function ask(amount: string, who = p.member, submit = true, teamId = p.kitchen) {
  await actAs(who);
  return ok(createRequest({ teamId, title: "Gas bottles", amount, submit }));
}

describe("spend requests", () => {
  beforeEach(async () => {
    p = await financeCamp();
  });

  it("R900 in budget: the team lead approves; refs count up; the requester gets a task", async () => {
    const a = await ask("900");
    const b = await ask("R1,200", p.member, false);
    expect([a.refCode, b.refCode]).toEqual(["TST-SR-001", "TST-SR-002"]);
    expect(await chain(a.id)).toEqual(["1.0 team_lead pending"]);
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, (await row(a.id))?.taskId ?? ""));
    expect(t?.kind).toBe("finance.purchase");
    expect(t?.ownerPersonId).toBe(p.member);
    expect((await inboxFor(getDb(), EDITION.id, await actorFor(p.lead))).map((x) => x.id)).toEqual([
      a.id,
    ]);
    await actAs(p.finance);
    await expect(ok(decideRequest({ id: a.id, decision: "approved" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await actAs(p.lead);
    expect(await ok(decideRequest({ id: a.id, decision: "approved" }))).toMatchObject({
      status: "approved",
    });
    const events = await getDb().select().from(baseTables.domainEvents);
    expect(events.map((e) => e.name)).toEqual(["finance.spend.decided"]);
    const s = await summaryFor(getDb(), EDITION.id, [p.kitchen]);
    expect(s.rows[0]).toMatchObject({ committedCents: 90_000, pendingCents: 0 });
  });

  it("R12,000 needs a finance approver, then the camp lead", async () => {
    const a = await ask("12000");
    await actAs(p.lead);
    await expect(ok(decideRequest({ id: a.id, decision: "approved" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await actAs(p.finance);
    expect(await ok(decideRequest({ id: a.id, decision: "approved" }))).toMatchObject({
      status: "submitted",
    });
    await expect(ok(decideRequest({ id: a.id, decision: "approved" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await actAs(p.camp);
    expect(await ok(decideRequest({ id: a.id, decision: "approved" }))).toMatchObject({
      status: "approved",
    });
    expect(await chain(a.id)).toEqual([
      "1.0 role:finance_approver approved",
      "1.1 role:camp_lead approved",
    ]);
    const audit = (await getDb().select().from(baseTables.auditEvents)).filter(
      (x) => x.action === "finance.spend.decided",
    );
    expect(audit.map((x) => x.changes)).toEqual([
      expect.objectContaining({ status: ["submitted", "submitted"], step: [null, 0] }),
      expect.objectContaining({ status: ["submitted", "approved"] }),
    ]);
  });

  it("nobody approves their own request, not even a camp lead", async () => {
    const a = await ask("12000", p.camp, true, p.kitchen).catch((e) => e);
    expect(a).toBeInstanceOf(ForbiddenError); // camp lead isn't on Kitchen
    const own = await ask("900", p.lead);
    await actAs(p.lead);
    await expect(ok(decideRequest({ id: own.id, decision: "approved" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await actAs(p.camp);
    expect(await ok(decideRequest({ id: own.id, decision: "approved" }))).toMatchObject({
      status: "approved",
    });
  });

  it("decisions carry a tapped reason and next step; mismatches are refused", async () => {
    const a = await ask("4500");
    await actAs(p.finance);
    await expect(
      ok(decideRequest({ id: a.id, decision: "rejected", reason: "within_budget" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ok(
        decideRequest({
          id: a.id,
          decision: "rejected",
          reason: "wrong_budget",
          next: "move_budget",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await ok(
      decideRequest({
        id: a.id,
        decision: "rejected",
        reason: "over_budget",
        next: "resubmit_lower",
      }),
    );
    const [step] = await getDb()
      .select()
      .from(financeRequestSteps)
      .where(eq(financeRequestSteps.spendRequestId, a.id));
    expect(step).toMatchObject({
      reasonCode: "over_budget",
      nextStep: "resubmit_lower",
      comment: null,
    });
  });

  it("over budget goes to finance + camp lead even when small", async () => {
    const a = await ask("1100", p.giftLead, true, p.gifts);
    expect(await chain(a.id)).toEqual([
      "1.0 role:finance_approver pending",
      "1.1 role:camp_lead pending",
    ]);
  });

  it("send back → edit → resubmit restarts the chain; reject needs a reason", async () => {
    const a = await ask("4500");
    await actAs(p.finance);
    await expect(ok(decideRequest({ id: a.id, decision: "needs_info" }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await ok(decideRequest({ id: a.id, decision: "needs_info", comment: "Which supplier?" }));
    expect((await row(a.id))?.status).toBe("needs_info");
    await actAs(p.lead);
    await expect(
      ok(editRequest({ id: a.id, title: "Gas bottles", amount: "4500", supplierName: "Afrox" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.member);
    await ok(editRequest({ id: a.id, title: "Gas bottles (Afrox)", amount: "1000", submit: true }));
    const r = await row(a.id);
    expect(r).toMatchObject({ status: "submitted", estimatedCents: 100_000 });
    expect(await chain(a.id)).toEqual([
      "1.0 role:finance_approver needs_info",
      "2.0 team_lead pending",
    ]);
    await actAs(p.lead);
    await ok(decideRequest({ id: a.id, decision: "rejected", comment: "We have gas" }));
    await actAs(p.member);
    await expect(ok(submitRequest({ id: a.id }))).rejects.toBeInstanceOf(ValidationError);
    await ok(cancelRequest({ id: a.id }));
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, r?.taskId ?? ""));
    expect(t?.status).toBe("done"); // members can't cancel tasks in the base; done = nothing left
  });

  it("people outside the team can't ask, see or cancel", async () => {
    await actAs(p.outsider);
    await expect(
      ok(createRequest({ teamId: p.kitchen, title: "Gas", amount: "100" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const a = await ask("900");
    await actAs(p.giftLead);
    await expect(ok(cancelRequest({ id: a.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.lead); // can see it, but it's not theirs to cancel
    await expect(ok(cancelRequest({ id: a.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.member);
    expect(await ok(cancelRequest({ id: a.id }))).toMatchObject({ status: "cancelled" });
    expect(await chain(a.id)).toEqual([]); // nothing left waiting on anyone
  });

  it("sending back mid-chain drops the steps that never happened", async () => {
    const a = await ask("12000");
    await actAs(p.finance);
    await ok(decideRequest({ id: a.id, decision: "needs_info", comment: "Quote?" }));
    const left = await getDb()
      .select()
      .from(financeRequestSteps)
      .where(eq(financeRequestSteps.spendRequestId, a.id));
    expect(left.map((x) => [x.position, x.status, x.decidedByPersonId])).toEqual([
      [0, "needs_info", p.finance],
    ]);
    expect(await inboxFor(getDb(), EDITION.id, await actorFor(p.camp))).toEqual([]);
  });

  it("refuses bad amounts", async () => {
    await expect(ask("-5")).rejects.toBeInstanceOf(ValidationError);
    await expect(ask("4,5")).rejects.toBeInstanceOf(ValidationError);
  });
});
