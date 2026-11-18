// "Ask the camp" through the guard: filing, the buy list, fixes as corrections, and who may act.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { tasks } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, getDb } from "@/base/api/testing-db";
import { procurementAskLog, procurementItems, procurementNeeds } from "../schema";
import { askTheCamp, fixAsk } from "../server/ask";
import { procurementCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof procurementCamp>>;
const logOf = (id: string) =>
  getDb().select().from(procurementAskLog).where(eq(procurementAskLog.id, id));
const taskOf = async (id: string | null) =>
  (
    await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, id ?? ""))
  )[0];

describe("ask the camp", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("files the ice request for Kitchen with an owner, a date and a buy-list line", async () => {
    await getDb().insert(procurementItems).values({ name: "Ice", category: "other", unit: "kg" });
    await actAs(p.kitchenLead);
    const r = await ok(askTheCamp({ text: "need 20 kg of ice by Tuesday" }));
    expect(r.notOnList).toBeNull();
    const [row] = await logOf(r.id);
    expect(row).toMatchObject({
      action: "asked",
      router: "demo",
      teamId: p.kitchen,
      aiCostCents: 0,
    });
    expect(row?.ownerPersonId).toBe(p.kitchenLead);
    expect(row?.dueOn).not.toBeNull();
    const task = await taskOf(row?.taskId ?? null);
    expect(task).toMatchObject({ title: "Buy 20 kg ice", kind: "procurement.ask" });
    expect(task?.dueAt).not.toBeNull();
    const [need] = await getDb()
      .select()
      .from(procurementNeeds)
      .where(eq(procurementNeeds.id, row?.needId ?? ""));
    expect(need).toMatchObject({ teamId: p.kitchen, quantityNeeded: 20, taskId: row?.taskId });
  });

  it("says when the thing to buy isn't in the catalogue", async () => {
    await actAs(p.kitchenLead);
    const r = await ok(askTheCamp({ text: "buy 3 bags of unicorn dust" }));
    expect(r.notOnList).toBe("unicorn dust");
  });

  it("a camp lead's ask goes to the right team's lead, and owner fixes are remembered", async () => {
    await actAs(p.camp);
    const first = await ok(askTheCamp({ text: "paint the art car on Sunday" }));
    const [row] = await logOf(first.id);
    expect(row).toMatchObject({ teamId: p.gifts, ownerPersonId: p.lead });
    await ok(fixAsk({ askId: first.id, action: "change_owner", ownerPersonId: p.member }));
    expect((await taskOf(row?.taskId ?? null))?.ownerPersonId).toBe(p.member);
    const fixes = await getDb()
      .select()
      .from(procurementAskLog)
      .where(eq(procurementAskLog.askId, first.id));
    expect(fixes[0]).toMatchObject({
      action: "change_owner",
      fromValue: p.lead,
      toValue: p.member,
    });
    const next = await ok(askTheCamp({ text: "more paint for the sculpture" }));
    expect((await logOf(next.id))[0]?.ownerPersonId).toBe(p.member);
  });

  it("change date moves the task; looks right is logged; nothing is overwritten", async () => {
    await actAs(p.kitchenLead);
    const r = await ok(askTheCamp({ text: "plan breakfast for build week" }));
    await ok(fixAsk({ askId: r.id, action: "change_date", dueOn: "2027-03-02" }));
    await ok(fixAsk({ askId: r.id, action: "change_date", dueOn: "2027-03-03" }));
    await ok(fixAsk({ askId: r.id, action: "looks_right" }));
    const rows = await getDb()
      .select()
      .from(procurementAskLog)
      .where(eq(procurementAskLog.askId, r.id))
      .orderBy(procurementAskLog.createdAt);
    expect(rows.map((x) => x.action).sort()).toEqual(["change_date", "change_date", "looks_right"]);
    expect(rows.find((x) => x.toValue === "2027-03-03")?.fromValue).toBe("2027-03-02");
    const [asked] = await logOf(r.id);
    expect((await taskOf(asked?.taskId ?? null))?.dueAt).not.toBeNull();
  });

  it("rejects an owner who isn't on the team, and a too-short request", async () => {
    await actAs(p.kitchenLead);
    const r = await ok(askTheCamp({ text: "need ice" }));
    await expect(
      ok(fixAsk({ askId: r.id, action: "change_owner", ownerPersonId: p.member })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(ok(askTheCamp({ text: "x" }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("members can't ask, and a lead can't fix another team's ask (wrong record)", async () => {
    await actAs(p.member);
    await expect(ok(askTheCamp({ text: "need ice" }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.camp);
    const r = await ok(askTheCamp({ text: "paint the art car" }));
    await actAs(p.kitchenLead);
    await expect(ok(fixAsk({ askId: r.id, action: "looks_right" }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      ok(fixAsk({ askId: "01900000-0000-7000-8000-0000000000ee", action: "looks_right" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
