// B2 work-engine schema (docs/specs/b2-task-engine.md, DATA_MODEL.md §3): defaults and the
// constraints the database enforces on its own, whatever the app code does.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import {
  projects,
  taskAssignments,
  taskChecklistItems,
  taskComments,
  taskDependencies,
  tasks,
  taskWatchers,
  teams,
} from "@/base/schema";
import { firstRow } from "@/lib/rows";

let personId: string;
let projectId: string;

async function newTask(title: string) {
  return firstRow(
    await getDb().insert(tasks).values({ editionId: EDITION.id, projectId, title }).returning(),
    "task",
  );
}

describe("B2 engine schema", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    personId = await createPerson({ email: "a@example.test", name: "A" });
    const team = firstRow(await getDb().select().from(teams).where(eq(teams.key, "kitchen")));
    projectId = firstRow(
      await getDb()
        .insert(projects)
        .values({ editionId: EDITION.id, teamId: team.id, name: "Kitchen build" })
        .returning(),
    ).id;
  });

  it("a new project and task start with safe defaults", async () => {
    const p = firstRow(await getDb().select().from(projects).where(eq(projects.id, projectId)));
    expect(p).toMatchObject({ kind: "general", status: "active", carryForward: false });
    const t = await newTask("Gas bottles");
    expect(t).toMatchObject({
      kind: "task",
      status: "todo",
      priority: "should",
      claimMode: "closed",
      isCritical: false,
      ownerPersonId: null,
      blockedReason: null,
    });
  });

  it("refuses a blocked task without a reason", async () => {
    const t = await newTask("Lift Cloud");
    await expect(
      getDb().update(tasks).set({ status: "blocked" }).where(eq(tasks.id, t.id)),
    ).rejects.toThrow();
    await getDb()
      .update(tasks)
      .set({ status: "blocked", blockedReason: "No forklift" })
      .where(eq(tasks.id, t.id));
    expect(firstRow(await getDb().select().from(tasks).where(eq(tasks.id, t.id))).status).toBe(
      "blocked",
    );
  });

  it("a task can't depend on itself, and a dependency is stored once", async () => {
    const a = await newTask("Book forklift");
    const b = await newTask("Lift Cloud");
    await expect(
      getDb().insert(taskDependencies).values({ taskId: a.id, dependsOnTaskId: a.id }),
    ).rejects.toThrow();
    await getDb().insert(taskDependencies).values({ taskId: b.id, dependsOnTaskId: a.id });
    await expect(
      getDb().insert(taskDependencies).values({ taskId: b.id, dependsOnTaskId: a.id }),
    ).rejects.toThrow();
  });

  it("one live claim per person per task; a withdrawn one doesn't block a new claim", async () => {
    const t = await newTask("Sand the deck");
    await getDb()
      .insert(taskAssignments)
      .values({ taskId: t.id, personId, source: "claimed", status: "withdrawn" });
    await getDb()
      .insert(taskAssignments)
      .values({ taskId: t.id, personId, source: "claimed", status: "active" });
    await expect(
      getDb()
        .insert(taskAssignments)
        .values({ taskId: t.id, personId, source: "assigned", status: "pending_approval" }),
    ).rejects.toThrow();
  });

  it("checklist items, comments and watchers hang off a task", async () => {
    const t = await newTask("Pack container");
    await getDb()
      .insert(taskChecklistItems)
      .values([
        { taskId: t.id, position: 1, label: "Tools" },
        { taskId: t.id, position: 2, label: "Gas" },
      ]);
    await getDb()
      .insert(taskComments)
      .values({ taskId: t.id, authorPersonId: personId, body: "Hi" });
    await getDb().insert(taskWatchers).values({ taskId: t.id, personId });
    await expect(getDb().insert(taskWatchers).values({ taskId: t.id, personId })).rejects.toThrow();
    const items = await getDb()
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.taskId, t.id));
    expect(items.map((i) => i.label)).toEqual(["Tools", "Gas"]);
  });

  it("a sub-project and a sub-task point at their parent", async () => {
    const team = firstRow(await getDb().select().from(projects).where(eq(projects.id, projectId)));
    const sub = firstRow(
      await getDb()
        .insert(projects)
        .values({
          editionId: EDITION.id,
          teamId: team.teamId,
          parentProjectId: projectId,
          name: "Build workstream",
          kind: "gift_project",
          phase: "build",
        })
        .returning(),
    );
    expect(sub.parentProjectId).toBe(projectId);
    const parent = await newTask("Cloud: build");
    const child = firstRow(
      await getDb()
        .insert(tasks)
        .values({ editionId: EDITION.id, projectId, title: "Ribs", parentTaskId: parent.id })
        .returning(),
    );
    expect(child.parentTaskId).toBe(parent.id);
  });
});
