// Task dependencies through the engine service (docs/specs/b2-task-engine.md D1–D4).
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { addDependency, listDependencies, removeDependency } from "@/base/engine/dependencies";
import { createProject } from "@/base/engine/projects";
import { createTask, updateTask } from "@/base/engine/tasks";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { auditEvents, taskDependencies } from "@/base/schema";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let a: string;
let b: string;
let c: string;

const link = async (taskId: string, dependsOnTaskId: string, who = ids.lead) =>
  addDependency(await at(who), { taskId, dependsOnTaskId });

describe("engine: dependencies", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    const lead = await at(ids.lead);
    a = (await createTask(lead, { projectId: ids.cloud, title: "Book forklift", dueAt: days(2) }))
      .id;
    b = (await createTask(lead, { projectId: ids.cloud, title: "Lift Cloud", dueAt: days(5) })).id;
    c = (await createTask(lead, { projectId: ids.cloud, title: "Light Cloud", dueAt: days(8) })).id;
  });

  it("D1: a lead links B after A; it's saved and audited", async () => {
    expect(await link(b, a)).toEqual({ added: true });
    const deps = await listDependencies(await at(ids.gift), b);
    expect(deps.prerequisites.map((p) => p.title)).toEqual(["Book forklift"]);
    expect((await listDependencies(await at(ids.gift), a)).dependents.map((d) => d.title)).toEqual([
      "Lift Cloud",
    ]);
    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "task.dependency_added"));
    expect(audits).toHaveLength(1);
  });

  it("D2: a self-link or a loop is refused, naming the loop", async () => {
    await link(b, a);
    await link(c, b);
    await expect(link(a, a)).rejects.toBeInstanceOf(ValidationError);
    const err = await link(a, c).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe(
      "That would create a loop: Book forklift → Light Cloud → Lift Cloud → Book forklift",
    );
    expect(await getDb().select().from(taskDependencies)).toHaveLength(2);
  });

  it("D3: adding the same link twice is a no-op", async () => {
    await link(b, a);
    expect(await link(b, a)).toEqual({ added: false });
    expect(await getDb().select().from(taskDependencies)).toHaveLength(1);
  });

  it("D4: a task is at risk when a prerequisite is overdue or blocked", async () => {
    await link(b, a);
    expect((await listDependencies(await at(ids.gift), b)).atRisk).toBe(false);
    const late = await at(ids.lead, days(3));
    expect((await listDependencies(late, b)).atRisk).toBe(true);
    await updateTask(await at(ids.lead), a, { status: "blocked", blockedReason: "Hire shop shut" });
    expect((await listDependencies(await at(ids.gift), b)).atRisk).toBe(true);
    await updateTask(await at(ids.lead), a, { status: "done" });
    expect((await listDependencies(late, b)).atRisk).toBe(false);
  });

  it("(deny) members can't link; a lead can't link into another team's task", async () => {
    await expect(link(b, a, ids.gift)).rejects.toBeInstanceOf(ForbiddenError);
    const kitchen = await createProject(await at(ids.cook), {
      teamId: ids.kitchenTeam,
      name: "Kitchen build",
    });
    const k = await createTask(await at(ids.cook), { projectId: kitchen.id, title: "Gas" });
    await expect(link(k.id, a)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await link(a, k.id)).toEqual({ added: true }); // waiting on another team is fine
    await expect(link(b, ids.cloud)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("removing a link is for leads, audited, and a missing link is a no-op", async () => {
    await link(b, a);
    await expect(
      removeDependency(await at(ids.gift), { taskId: b, dependsOnTaskId: a }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await removeDependency(await at(ids.lead), { taskId: b, dependsOnTaskId: a })).toEqual({
      removed: true,
    });
    expect(await removeDependency(await at(ids.lead), { taskId: b, dependsOnTaskId: a })).toEqual({
      removed: false,
    });
    expect(await getDb().select().from(taskDependencies)).toHaveLength(0);
  });
});
