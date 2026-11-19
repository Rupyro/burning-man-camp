// Obligations end to end through the guard (docs/specs/obligations.md §4, §6).
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError } from "@/base/api";
import { tasks } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import {
  actAs,
  addTeam,
  baseTables,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  landingFor,
  layoutStatus,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { obligationDetails, obligationDocuments } from "../schema";
import { markSubmitted, reopenObligation, updateObligation } from "../server/actions";
import { createObligation } from "../server/create";
import { listDocuments, listObligations } from "../server/queries";

const DAY = 86_400_000;
let camp: string;
let owner: string;
let member: string;
let waiting: string;
let taskId: string;

async function seedOne(key = "mv_registration", ownerPersonId: string | null = null) {
  const created = await createObligation(await tasksApiFor(camp), getDb(), EDITION, {
    key,
    title: "Mutant vehicle registration",
    authority: "afrikaburn",
    category: "mutant_vehicle",
    dueAt: new Date(Date.now() + 5 * DAY),
    previousYearDate: "2026-04-05",
    ownerPersonId,
  });
  return created?.taskId ?? "";
}

describe("obligations", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    await addTeam("camp_infra", "Camp infrastructure");
    camp = await createPerson({ email: "camp@example.test", name: "Camp", roles: ["camp_lead"] });
    owner = await createPerson({ email: "mv@example.test", name: "MV Owner" });
    member = await createPerson({ email: "m@example.test", name: "Member" });
    waiting = await createPerson({ email: "w@example.test", name: "W", status: "waitlisted" });
    taskId = await seedOne("mv_registration", owner);
  });

  it("creates one base task of the obligation kind plus its detail row, idempotently", async () => {
    expect(await seedOne()).toBe("");
    const [t] = await getDb().select().from(tasks).where(eq(tasks.id, taskId));
    expect(t?.kind).toBe("obligations.obligation");
    expect(t?.ownerPersonId).toBe(owner);
    const rows = await listObligations(getDb(), EDITION.id);
    expect(rows.map((r) => [r.key, r.ownerName, r.dateConfirmed])).toEqual([
      ["mv_registration", "MV Owner", false],
    ]);
  });

  it("members see the module and a tile; waitlisted people don't", async () => {
    expect(await layoutStatus("obligations", member)).toBe("ok");
    expect(await layoutStatus("obligations", waiting)).toBe("404");
    const tile = (await landingFor(member)).tiles.find((x) => x.id === "obligations");
    expect(tile?.badge).toBe(1); // due within 14 days
    expect((await landingFor(waiting)).tiles.find((x) => x.id === "obligations")).toBeUndefined();
  });

  it("the owner gets a 'check the date' nudge until the date is confirmed", async () => {
    const mine = (await landingFor(owner)).myItems.filter((i) => i.moduleId === "obligations");
    expect(mine.map((i) => i.title)).toEqual(["Check the 2027 date: Mutant vehicle registration"]);
    expect((await landingFor(member)).myItems.filter((i) => i.moduleId === "obligations")).toEqual(
      [],
    );
    await actAs(camp);
    await ok(updateObligation({ taskId, dateConfirmed: true }));
    expect((await landingFor(owner)).myItems.filter((i) => i.moduleId === "obligations")).toEqual(
      [],
    );
  });

  it("the owner can mark it submitted: task done, audit row, event", async () => {
    await actAs(owner);
    expect(await ok(markSubmitted({ taskId, confirmationRef: "AB-123" }))).toMatchObject({
      changed: true,
    });
    const [t] = await getDb().select().from(tasks).where(eq(tasks.id, taskId));
    expect(t?.status).toBe("done");
    const [d] = await getDb()
      .select()
      .from(obligationDetails)
      .where(eq(obligationDetails.taskId, taskId));
    expect(d?.confirmationRef).toBe("AB-123");
    expect(d?.submittedAt).toBeInstanceOf(Date);
    const actions = (await getDb().select().from(baseTables.auditEvents)).map((a) => a.action);
    expect(actions).toContain("obligations.obligation.submitted");
    const events = await getDb().select().from(baseTables.domainEvents);
    expect(events.map((e) => e.name)).toContain("obligations.obligation.submitted");
    expect(await ok(markSubmitted({ taskId }))).toMatchObject({ changed: false });
  });

  it("refuses submit from a member who isn't the owner, and from waitlisted people", async () => {
    await actAs(member);
    await expect(ok(markSubmitted({ taskId }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(waiting);
    await expect(ok(markSubmitted({ taskId }))).rejects.toBeInstanceOf(ForbiddenError);
    const [t] = await getDb().select().from(tasks).where(eq(tasks.id, taskId));
    expect(t?.status).toBe("todo");
  });

  it("only managers edit: due date, confirmed flag, owner, link, documents", async () => {
    await actAs(owner);
    await expect(ok(updateObligation({ taskId, dateConfirmed: true }))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await actAs(camp);
    await ok(
      updateObligation({
        taskId,
        dueDate: "2027-04-02",
        dateConfirmed: true,
        ownerPersonId: member,
        sourceUrl: "https://www.afrikaburn.org/",
        requiredDocuments: ["Vehicle photos", "Driver list"],
      }),
    );
    const [row] = await listObligations(getDb(), EDITION.id);
    expect(row?.dueAt?.toISOString()).toBe("2027-04-02T19:00:00.000Z"); // noon PT
    expect(row?.ownerPersonId).toBe(member);
    expect(row?.dateConfirmed).toBe(true);
    expect(row?.documentCount).toBe(2);
    expect((await listDocuments(getDb(), taskId)).map((d) => [d.name, d.status])).toEqual([
      ["Vehicle photos", "needed"],
      ["Driver list", "needed"],
    ]);
    await getDb()
      .update(obligationDocuments)
      .set({ status: "done", doneAt: new Date() })
      .where(eq(obligationDocuments.name, "Driver list"));
    await ok(
      updateObligation({
        taskId,
        requiredDocuments: ["Driver list", "Insurance", "Driver list"],
      }),
    );
    expect((await listDocuments(getDb(), taskId)).map((d) => [d.name, d.status])).toEqual([
      ["Driver list", "done"], // a document that stays keeps its tick
      ["Insurance", "needed"],
    ]);
    const audit = (await getDb().select().from(baseTables.auditEvents)).map((a) => a.action);
    expect(audit).toEqual(
      expect.arrayContaining(["obligations.obligation.updated", "task.owner_changed"]),
    );
  });

  it("refuses an unknown task id and a non-obligation task", async () => {
    await actAs(camp);
    await expect(
      ok(updateObligation({ taskId: "01900000-0000-7000-8000-00000000dead", notes: "x" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a manager can reopen a submitted obligation; a member can't", async () => {
    await actAs(owner);
    await ok(markSubmitted({ taskId }));
    await expect(ok(reopenObligation({ taskId }))).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(camp);
    expect(await ok(reopenObligation({ taskId }))).toMatchObject({ changed: true });
    const [row] = await listObligations(getDb(), EDITION.id);
    expect(row?.status).toBe("todo");
    expect(row?.submittedAt).toBeNull();
  });
});
