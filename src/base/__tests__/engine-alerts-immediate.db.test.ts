// Task kinds with escalateOverdueImmediately reach the camp lead on day 1 (PLAN.md §4.3).
// Uses a stand-in manifest so the base test doesn't depend on any real module.
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getRegistry, type ModuleManifest, registerModules } from "@/base/api";
import { getDb } from "@/base/api/testing-db";
import { runAlerts } from "@/base/engine/alerts";
import { createTask } from "@/base/engine/tasks";
import { notifications } from "@/base/schema";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

const standIn = {
  id: "binder",
  name: "Stand-in",
  description: "test only",
  icon: "box",
  route: "/stand-in",
  tablePrefix: "standin_",
  access: [{ everyone: true }],
  permissions: [],
  nav: [],
  taskKinds: [
    { key: "binder.urgent", label: "Urgent", escalateOverdueImmediately: true },
    { key: "binder.normal", label: "Normal" },
  ],
  flag: { defaultEnabled: true },
} satisfies ModuleManifest;

let ids: EngineIds;
let saved: readonly ModuleManifest[] = [];
const got = async (personId: string) =>
  (
    await getDb()
      .select({ title: notifications.title })
      .from(notifications)
      .where(
        and(eq(notifications.recipientPersonId, personId), eq(notifications.type, "task.overdue")),
      )
  ).map((n) => n.title);

describe("engine: immediate escalation kinds", () => {
  beforeAll(() => {
    saved = getRegistry().modules;
    registerModules([standIn]);
  });
  afterAll(() => {
    registerModules(saved);
  });
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("sends a day-1 overdue task of that kind to the camp lead; other kinds wait 7 days", async () => {
    const lead = await at(ids.lead);
    for (const [title, kind] of [
      ["Urgent", "binder.urgent"],
      ["Normal", "binder.normal"],
    ] as const)
      await createTask(lead, {
        projectId: ids.cloud,
        title,
        kind,
        dueAt: days(1),
        ownerPersonId: ids.gift,
      });
    await runAlerts(getDb(), lead.edition, days(1.2));
    expect(await got(ids.camp)).toEqual(["Overdue: Urgent"]);
    expect((await got(ids.gift)).sort()).toEqual(["Overdue: Normal", "Overdue: Urgent"]);
  });
});
