// Reminders and escalation on a fast-forwarded clock, and the jobs tick
// (docs/specs/b2-task-engine.md A1–A7, J1).
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import type { EditionRef } from "@/base/editions/current";
import { clearSentEmails, memoryAdapter, sentEmails, setEmailAdapter } from "@/base/email/adapter";
import { runAlerts } from "@/base/engine/alerts";
import { addDependency } from "@/base/engine/dependencies";
import { createTask, updateTask } from "@/base/engine/tasks";
import { runTick } from "@/base/engine/tick";
import { alertRules, alertStates, jobRuns, notifications } from "@/base/schema";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let edition: EditionRef;
const db = () => getDb();
const got = async (personId: string, type: string) =>
  (
    await db()
      .select({ title: notifications.title })
      .from(notifications)
      .where(and(eq(notifications.recipientPersonId, personId), eq(notifications.type, type)))
  ).map((n) => n.title);
const task = async (
  title: string,
  dueAt: Date,
  extra: { ownerPersonId?: string; isCritical?: boolean; kind?: string } = {},
) => (await createTask(await at(ids.lead), { projectId: ids.cloud, title, dueAt, ...extra })).id;
const tick = (now: Date) => runAlerts(db(), edition, now);

describe("engine: alerts and escalation", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    edition = (await at(ids.lead)).edition;
  });

  it("A1/A5: due soon reminds the owner at 3 days and at 1 day, once each", async () => {
    await task("Gas", days(3), { ownerPersonId: ids.gift });
    await tick(days(0));
    await tick(days(0.5));
    expect(await got(ids.gift, "task.due_soon")).toEqual(["Due soon: Gas"]);
    await tick(days(2.5));
    expect(await got(ids.gift, "task.due_soon")).toHaveLength(2);
    await tick(days(2.9));
    expect(await got(ids.gift, "task.due_soon")).toHaveLength(2);
  });

  it("A2: overdue goes to the owner, then team leads after 3 days, then camp leads after 7", async () => {
    await task("Gas", days(1), { ownerPersonId: ids.gift });
    await tick(days(1.1));
    expect(await got(ids.gift, "task.overdue")).toEqual(["Overdue: Gas"]);
    expect(await got(ids.lead, "task.overdue")).toEqual([]);
    await tick(days(4.2));
    expect(await got(ids.lead, "task.overdue")).toEqual(["Overdue: Gas"]);
    expect(await got(ids.camp, "task.overdue")).toEqual([]);
    await tick(days(8.2));
    expect(await got(ids.camp, "task.overdue")).toEqual(["Overdue: Gas"]);
    expect(await got(ids.gift, "task.overdue")).toHaveLength(1);
  });

  it("A2: a critical task or a milestone reaches the camp leads at once", async () => {
    await task("Permit", days(1), { ownerPersonId: ids.gift, isCritical: true });
    await task("Build done", days(1), { ownerPersonId: ids.gift, kind: "milestone" });
    await tick(days(1.1));
    expect((await got(ids.camp, "task.overdue")).sort()).toEqual([
      "Overdue: Build done",
      "Overdue: Permit",
    ]);
  });

  it("A3: an unowned task due within 14 days tells team leads, and camp leads within 7", async () => {
    await task("Shade cloth", days(20));
    await tick(days(0));
    expect(await got(ids.lead, "task.unowned")).toEqual([]);
    await tick(days(7));
    expect(await got(ids.lead, "task.unowned")).toEqual(["Needs an owner: Shade cloth"]);
    expect(await got(ids.camp, "task.unowned")).toEqual([]);
    await tick(days(13.5));
    expect(await got(ids.camp, "task.unowned")).toEqual(["Needs an owner: Shade cloth"]);
  });

  it("A4: a late prerequisite warns the waiting task's owner and team leads", async () => {
    const a = await task("Book forklift", days(1), { ownerPersonId: ids.lead });
    const b = await task("Lift Cloud", days(6), { ownerPersonId: ids.gift });
    await addDependency(await at(ids.lead), { taskId: b, dependsOnTaskId: a });
    await tick(days(0));
    expect(await got(ids.gift, "task.dependency_risk")).toEqual([]);
    await tick(days(1.5));
    const title = "At risk (a task it depends on is late or blocked): Lift Cloud";
    expect(await got(ids.gift, "task.dependency_risk")).toEqual([title]);
    expect(await got(ids.lead, "task.dependency_risk")).toEqual([title]);
  });

  it("A5: moving the due date resets the reminder", async () => {
    const t = await task("Gas", days(3), { ownerPersonId: ids.gift });
    await tick(days(0));
    await updateTask(await at(ids.lead), t, { dueAt: days(2.5) });
    await tick(days(0));
    expect(await got(ids.gift, "task.due_soon")).toHaveLength(2);
  });

  it("A6: finishing a task resolves its alerts and nothing more fires", async () => {
    const t = await task("Gas", days(1), { ownerPersonId: ids.gift });
    await tick(days(1.1));
    await updateTask(await at(ids.gift), t, { status: "done" });
    expect(await tick(days(9))).toMatchObject({ fired: 0, resolved: 1 });
    const states = await db().select().from(alertStates);
    expect(states.every((s) => s.resolvedAt !== null)).toBe(true);
    expect(await got(ids.lead, "task.overdue")).toEqual([]);
  });

  it("A7: a switched-off rule fires nothing; empty thresholds use defaults", async () => {
    await db()
      .insert(alertRules)
      .values([
        { key: "overdue", enabled: false },
        { key: "due_soon", enabled: true },
      ]);
    await task("Gas", days(1), { ownerPersonId: ids.gift });
    await tick(days(0));
    await tick(days(5));
    expect(await got(ids.gift, "task.overdue")).toEqual([]);
    expect(await got(ids.gift, "task.due_soon")).toEqual(["Due soon: Gas"]);
  });
});

describe("engine: jobs tick", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    setEmailAdapter(memoryAdapter);
    clearSentEmails();
  });

  it("J1: runs alerts, automations, digest and outbox in order, records each run, and is safe twice", async () => {
    await createTask(await at(ids.lead), {
      projectId: ids.cloud,
      title: "Gas",
      dueAt: days(1),
      ownerPersonId: ids.gift,
    });
    const now = days(1.1); // 11:24 camp time, after the digest hour
    const first = await runTick(db(), now);
    expect(first.alerts).toMatchObject({ fired: 1 });
    expect(first.digest).toMatchObject({ people: 1 });
    expect(first.outbox).toMatchObject({ sent: 2 }); // the assignment email + the digest
    expect(sentEmails().map((m) => m.tag)).toEqual(["notification", "digest"]);
    await runTick(db(), now);
    expect(sentEmails()).toHaveLength(2);
    const runs = await db().select().from(jobRuns).orderBy(jobRuns.startedAt, jobRuns.job);
    expect(runs.map((r) => r.status)).toEqual(Array(8).fill("succeeded"));
    expect(new Set(runs.map((r) => r.job))).toEqual(
      new Set(["alerts", "automations", "digest", "outbox"]),
    );
  });

  it("J1: a failing job is recorded and the others still run", async () => {
    const result = await runTick(db(), days(1), {
      jobs: [
        {
          key: "broken",
          run: async () => {
            throw new Error("boom");
          },
        },
        { key: "fine", run: async () => ({ ok: 1 }) },
      ],
    });
    expect(result).toEqual({ broken: null, fine: { ok: 1 } });
    const runs = await db().select().from(jobRuns);
    expect(runs.map((r) => [r.job, r.status, r.error])).toEqual(
      expect.arrayContaining([
        ["broken", "failed", "boom"],
        ["fine", "succeeded", null],
      ]),
    );
  });
});
