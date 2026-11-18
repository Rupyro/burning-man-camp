// Applicants ↔ Finance through the event bus (docs/specs/applicants.md §2, §6): a lead accepts →
// Finance makes the camp fee → the applicant sees it → a finance approver records the payment →
// once every requirement is done the applicant joins and becomes a confirmed member. Neither module
// reads the other's tables; duplicate deliveries change nothing.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/base/api";
import { editionMembers } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import {
  actAs,
  actorFor,
  baseTables,
  dispatchPending,
  EDITION,
  getDb,
} from "@/base/api/testing-db";
import { eventContracts } from "@/contracts/events";
import {
  confirmDocument,
  saveApplication,
  updateApplication,
} from "@/modules/applicants/server/actions";
import { myApplication } from "@/modules/applicants/server/queries";
import { applicantCamp, GOOD_ANSWERS } from "@/modules/applicants/tests/fixtures";
import { CAMP_FEE_PLACEHOLDER_CENTS } from "@/modules/finance/rules/fees";
import { financeCampFees } from "@/modules/finance/schema";
import { recordFeePayment } from "@/modules/finance/server/fees";

const { domainEvents, domainEventDeliveries, auditEvents } = baseTables;
let p: Awaited<ReturnType<typeof applicantCamp>>;
const app = () => myApplication(getDb(), EDITION.id, p.kai);
const fees = () => getDb().select().from(financeCampFees);
const membership = async (personId: string) =>
  (await getDb().select().from(editionMembers).where(eq(editionMembers.personId, personId)))[0];

async function acceptKai() {
  await actAs(p.kai);
  await ok(saveApplication({ answers: GOOD_ANSWERS, submit: true }));
  const id = (await app())?.id ?? "";
  await actAs(p.lead);
  await ok(
    updateApplication({
      id,
      status: "interview_scheduled",
      interviewDate: "2027-01-20",
      interviewTime: "18:30",
    }),
  );
  await ok(updateApplication({ id, status: "accepted" }));
  return id;
}

describe("applicants and finance", () => {
  beforeEach(async () => {
    p = await applicantCamp();
  });

  it("accepting makes a due camp fee in Finance and shows its amount to the applicant", async () => {
    const id = await acceptKai();
    const [fee] = await fees();
    expect(fee).toMatchObject({
      personId: p.kai,
      editionId: EDITION.id,
      amountCents: CAMP_FEE_PLACEHOLDER_CENTS,
      status: "due",
      sourceRefType: "applicants.application",
      sourceRefId: id,
    });
    expect(await app()).toMatchObject({ feeCents: 350_000, feeRefId: fee?.id, paidAt: null });
    const created = (await getDb().select().from(domainEvents)).filter(
      (e) => e.name === "finance.fee.created",
    );
    expect(created).toHaveLength(1);
    expect(eventContracts["finance.fee.created"].safeParse(created[0]?.payload).success).toBe(true);
  });

  it("paying alone isn't enough: joining waits for every document, then happens by itself", async () => {
    await acceptKai();
    const [fee] = await fees();
    await actAs(p.finance);
    expect(await ok(recordFeePayment({ id: fee?.id ?? "" }))).toEqual({ changed: true });
    expect(await app()).toMatchObject({ status: "accepted" });
    expect((await app())?.paidAt).toBeInstanceOf(Date);
    expect((await actorFor(p.kai)).isApplicant).toBe(true);

    await actAs(p.kai);
    await ok(confirmDocument({ docKey: "camp_agreement" }));
    await ok(confirmDocument({ docKey: "principles" }));
    expect(await ok(confirmDocument({ docKey: "ticket_plan" }))).toEqual({ joined: true });

    expect((await app())?.status).toBe("joined");
    expect(await membership(p.kai)).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid_in_full",
    });
    const kai = await actorFor(p.kai);
    expect(kai.isApplicant).toBe(false);
    expect(kai.isConfirmedMember).toBe(true);
    const audit = (await getDb().select().from(auditEvents)).map((a) => a.action);
    expect(audit).toContain("applicants.application.joined");
    expect(audit).toContain("member.status_changed");
    expect(audit).toContain("finance.fee.paid");
  });

  it("documents first, payment last: the payment event makes them join", async () => {
    await acceptKai();
    await actAs(p.kai);
    for (const d of ["camp_agreement", "principles", "ticket_plan"])
      await ok(confirmDocument({ docKey: d }));
    expect((await app())?.status).toBe("accepted");
    const [fee] = await fees();
    await actAs(p.camp);
    await ok(recordFeePayment({ id: fee?.id ?? "" }));
    expect((await app())?.status).toBe("joined");
    expect((await membership(p.kai))?.status).toBe("confirmed");
    // Recording twice changes nothing.
    expect(await ok(recordFeePayment({ id: fee?.id ?? "" }))).toEqual({ changed: false });
  });

  it("duplicate deliveries change nothing (one fee, one join)", async () => {
    await acceptKai();
    const [fee] = await fees();
    await actAs(p.finance);
    await ok(recordFeePayment({ id: fee?.id ?? "" }));
    await actAs(p.kai);
    for (const d of ["camp_agreement", "principles", "ticket_plan"])
      await ok(confirmDocument({ docKey: d }));
    // Replay every delivery as if the outbox ran them again.
    await getDb()
      .update(domainEventDeliveries)
      .set({ status: "pending", nextAttemptAt: new Date(0) });
    expect(await dispatchPending()).toMatchObject({ failed: 0 });
    expect(await fees()).toHaveLength(1);
    const joined = (await getDb().select().from(auditEvents)).filter(
      (a) => a.action === "applicants.application.joined",
    );
    expect(joined).toHaveLength(1);
    expect((await app())?.status).toBe("joined");
  });

  it("nobody records their own fee, and members, leads and applicants can't record any", async () => {
    await acceptKai();
    const [fee] = await fees();
    for (const who of [p.member, p.lead, p.kai, p.admin]) {
      await actAs(who);
      await expect(ok(recordFeePayment({ id: fee?.id ?? "" }))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    // A fee that belongs to the finance approver themselves.
    const [own] = await getDb()
      .insert(financeCampFees)
      .values({
        editionId: EDITION.id,
        personId: p.finance,
        amountCents: 350_000,
        sourceRefType: "test.manual",
        sourceRefId: "01900000-0000-7000-8000-0000000000ab",
      })
      .returning();
    await actAs(p.finance);
    await expect(ok(recordFeePayment({ id: own?.id ?? "" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      ok(recordFeePayment({ id: "01900000-0000-7000-8000-0000000000ac" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await fees()).every((f) => f.status === "due")).toBe(true);
  });
});
