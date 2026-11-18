// What it cost, pay-backs, budgets, CSV and the home page (docs/specs/finance.md "Done when").
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { tasks } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, baseTables, EDITION, getDb, landingFor } from "@/base/api/testing-db";
import { financeBudgets, financeReimbursements, financeSpendRequests } from "../schema";
import { exportSummaryCsv, recordExpense, setBudget, settleReimbursement } from "../server/money";
import { summaryFor } from "../server/queries";
import { createRequest, decideRequest } from "../server/requests";
import { financeCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof financeCamp>>;
const req = async (id: string) =>
  (await getDb().select().from(financeSpendRequests).where(eq(financeSpendRequests.id, id)))[0];

/** The plan's demo: Kitchen asks for R4,500 of gas; the finance approver says yes. */
async function approvedGas() {
  await actAs(p.member);
  const a = await ok(
    createRequest({
      teamId: p.kitchen,
      title: "Gas bottles",
      amount: "4500",
      submit: true,
    }),
  );
  await actAs(p.finance);
  await ok(decideRequest({ id: a.id, decision: "approved" }));
  return a;
}

const spent = {
  amount: "4320",
  spentOn: "2027-03-02",
  description: "4 x 9 kg gas",
  receiptUrl: "https://example.test/r.jpg",
};

describe("expenses, pay-backs and budgets", () => {
  beforeEach(async () => {
    p = await financeCamp();
  });

  it("record R4,320 out of pocket → pay-back owed → finance pays → closed; budget updates", async () => {
    const a = await approvedGas();
    await actAs(p.lead);
    await expect(
      ok(recordExpense({ id: a.id, paidWith: "personal", ...spent })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.member);
    await ok(recordExpense({ id: a.id, paidWith: "personal", ...spent }));
    expect((await req(a.id))?.status).toBe("purchased");
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, (await req(a.id))?.taskId ?? ""));
    expect(t?.status).toBe("done");
    const [owed] = await getDb().select().from(financeReimbursements);
    expect(owed).toMatchObject({ amountCents: 432_000, status: "owed", payeePersonId: p.member });
    const s = await summaryFor(getDb(), EDITION.id, [p.kitchen]);
    expect(s.rows[0]).toMatchObject({
      committedCents: 0,
      actualCents: 432_000,
      remainingCents: 6_000_000 - 432_000,
    });

    const pays = (await landingFor(p.finance)).myItems.filter((i) => i.moduleId === "finance");
    expect(pays.map((i) => i.title)).toEqual(["Pay back Sam R4,320 (TST-SR-001)"]);
    await actAs(p.member);
    await expect(
      ok(settleReimbursement({ reimbursementId: owed?.id ?? "", outcome: "paid" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.finance);
    await ok(
      settleReimbursement({
        reimbursementId: owed?.id ?? "",
        outcome: "paid",
        methodNote: "EFT 3 Mar",
      }),
    );
    expect((await req(a.id))?.status).toBe("closed");
    const audit = (await getDb().select().from(baseTables.auditEvents)).map((x) => x.action);
    expect(audit).toEqual(
      expect.arrayContaining(["finance.expense.recorded", "finance.reimbursement.paid"]),
    );
  });

  it("finance can't settle their own pay-back", async () => {
    const a = await approvedGas();
    await actAs(p.member);
    await ok(recordExpense({ id: a.id, paidWith: "personal", ...spent }));
    await getDb().update(financeReimbursements).set({ payeePersonId: p.finance });
    const [owed] = await getDb().select().from(financeReimbursements);
    await actAs(p.finance);
    await expect(
      ok(settleReimbursement({ reimbursementId: owed?.id ?? "", outcome: "paid" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("camp card: no pay-back, closed straight away; only once; only when approved", async () => {
    await actAs(p.member);
    const draft = await ok(createRequest({ teamId: p.kitchen, title: "Ice", amount: "300" }));
    await expect(
      ok(recordExpense({ id: draft.id, paidWith: "camp_card", ...spent })),
    ).rejects.toBeInstanceOf(ValidationError);
    const a = await approvedGas();
    await actAs(p.member);
    await ok(recordExpense({ id: a.id, paidWith: "camp_card", ...spent }));
    expect((await req(a.id))?.status).toBe("closed");
    expect(await getDb().select().from(financeReimbursements)).toEqual([]);
    await expect(
      ok(recordExpense({ id: a.id, paidWith: "camp_card", ...spent })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("approvers see 'Approve …' on the home page with a badge", async () => {
    await actAs(p.member);
    await ok(
      createRequest({ teamId: p.kitchen, title: "Gas bottles", amount: "4500", submit: true }),
    );
    const home = await landingFor(p.finance);
    expect(home.myItems.filter((i) => i.moduleId === "finance").map((i) => i.title)).toEqual([
      "Approve TST-SR-001: Gas bottles, R4,500 (Kitchen)",
    ]);
    expect(home.tiles.find((t) => t.id === "finance")?.badge).toBe(1);
    expect(
      (await landingFor(p.member)).tiles.find((t) => t.id === "finance")?.badge ?? null,
    ).toBeNull();
  });

  it("budgets: finance sets them (audited); team leads can't; CSV totals match", async () => {
    await actAs(p.lead);
    await expect(ok(setBudget({ teamId: p.kitchen, amount: "1" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(ok(exportSummaryCsv({}))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.finance);
    await ok(setBudget({ teamId: p.kitchen, amount: "65,000" }));
    const [b] = await getDb()
      .select()
      .from(financeBudgets)
      .where(eq(financeBudgets.teamId, p.kitchen));
    expect(b?.amountCents).toBe(6_500_000);
    const audit = (await getDb().select().from(baseTables.auditEvents)).find(
      (x) => x.action === "finance.budget.updated",
    );
    expect(audit?.changes).toEqual({ amountCents: [6_000_000, 6_500_000] });
    const csv = await ok(exportSummaryCsv({}));
    expect(csv.split("\n").at(-2)).toBe("Total,66000.00,0.00,0.00,0.00,66000.00");
  });
});
