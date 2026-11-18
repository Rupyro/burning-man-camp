// Tasks through the engine service (docs/specs/b2-task-engine.md T2–T7, S1–S3).
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import {
  createTask,
  getTask,
  listMyTasks,
  listProjectTasks,
  setTaskOwner,
  updateTask,
} from "@/base/engine/tasks";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { auditEvents, tasks } from "@/base/schema";
import { firstRow } from "@/lib/rows";
import { at, days, type EngineIds, engineFixture, NOW } from "./engine-fixture";

let ids: EngineIds;
const audits = async (action: string) =>
  getDb().select().from(auditEvents).where(eq(auditEvents.action, action));
const row = async (id: string) =>
  firstRow(await getDb().select().from(tasks).where(eq(tasks.id, id)));

describe("engine: tasks", () => {
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("T2: a team member adds a task: todo, unowned, audited", async () => {
    const t = await createTask(await at(ids.gift), { projectId: ids.cloud, title: "Ribs" });
    expect(await row(t.id)).toMatchObject({ status: "todo", ownerPersonId: null, kind: "task" });
    expect(await audits("task.created")).toHaveLength(1);
    const mine = await createTask(await at(ids.gift), {
      projectId: ids.cloud,
      title: "Mine",
      ownerPersonId: ids.gift,
    });
    expect((await row(mine.id)).ownerPersonId).toBe(ids.gift);
  });

  it("T2 (deny): other teams, waitlisted people, or handing a new task to someone else", async () => {
    await expect(
      createTask(await at(ids.kitchen), { projectId: ids.cloud, title: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createTask(await at(ids.wait), { projectId: ids.cloud, title: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createTask(await at(ids.gift), { projectId: ids.cloud, title: "X", ownerPersonId: ids.lead }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createTask(await at(ids.gift), { projectId: ids.lead, title: "unknown project" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getDb().select().from(tasks)).toHaveLength(0);
  });

  it("T3/T4: blocked needs a reason; done stamps completed_at at the clock", async () => {
    const t = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Lift" });
    await expect(
      updateTask(await at(ids.lead), t.id, { status: "blocked" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await updateTask(await at(ids.lead), t.id, { status: "blocked", blockedReason: "No forklift" });
    expect((await row(t.id)).blockedReason).toBe("No forklift");
    await updateTask(await at(ids.lead), t.id, { status: "done" });
    expect(await row(t.id)).toMatchObject({
      status: "done",
      blockedReason: null,
      completedAt: NOW,
    });
    expect(await audits("task.status_changed")).toHaveLength(2);
  });

  it("T5: the owner edits title, due date and status, but can't reassign or cancel", async () => {
    const t = await createTask(await at(ids.lead), {
      projectId: ids.cloud,
      title: "Sand",
      ownerPersonId: ids.gift,
    });
    const owner = await at(ids.gift);
    await updateTask(owner, t.id, {
      title: "Sand the deck",
      dueAt: days(3),
      status: "in_progress",
    });
    expect(await row(t.id)).toMatchObject({ title: "Sand the deck", status: "in_progress" });
    await expect(setTaskOwner(owner, t.id, ids.lead)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateTask(owner, t.id, { status: "cancelled" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("T5 (deny): someone who isn't the owner or a lead can't edit (crafted request)", async () => {
    const t = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Paint" });
    await expect(updateTask(await at(ids.gift), t.id, { title: "x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(updateTask(await at(ids.cook), t.id, { title: "x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(updateTask(await at(ids.lead), ids.cloud, { title: "x" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await row(t.id)).title).toBe("Paint");
  });

  it("T6: only base or registered task kinds", async () => {
    await expect(
      createTask(await at(ids.lead), { projectId: ids.cloud, title: "x", kind: "banana" }),
    ).rejects.toBeInstanceOf(ValidationError);
    const m = await createTask(await at(ids.lead), {
      projectId: ids.cloud,
      title: "Cloud standing",
      kind: "milestone",
    });
    expect((await row(m.id)).kind).toBe("milestone");
  });

  it("T7: a lead sets the owner; it's audited, and an unknown person is refused", async () => {
    const t = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Ribs" });
    expect(await setTaskOwner(await at(ids.lead), t.id, ids.gift)).toEqual({ changed: true });
    expect(await setTaskOwner(await at(ids.lead), t.id, ids.gift)).toEqual({ changed: false });
    expect((await row(t.id)).ownerPersonId).toBe(ids.gift);
    expect(await audits("task.owner_changed")).toHaveLength(1);
    await expect(setTaskOwner(await at(ids.lead), t.id, ids.cloud)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(setTaskOwner(await at(ids.lead), t.id, ids.wait)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("lists: my tasks overdue first; a project's tasks; refused for the waitlist", async () => {
    const lead = await at(ids.lead);
    const late = await createTask(lead, { projectId: ids.cloud, title: "Late", dueAt: days(-2) });
    const soon = await createTask(lead, { projectId: ids.cloud, title: "Soon", dueAt: days(1) });
    const later = await createTask(lead, { projectId: ids.cloud, title: "Later", dueAt: days(9) });
    await createTask(lead, { projectId: ids.cloud, title: "Not mine" });
    for (const t of [later, soon, late]) await setTaskOwner(lead, t.id, ids.gift);
    const mine = await listMyTasks(await at(ids.gift));
    expect(mine.map((t) => [t.title, t.urgency])).toEqual([
      ["Late", "overdue"],
      ["Soon", "soon"],
      ["Later", "normal"],
    ]);
    expect(await listProjectTasks(await at(ids.kitchen), ids.cloud)).toHaveLength(4);
    await expect(listProjectTasks(await at(ids.wait), ids.cloud)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(listMyTasks(await at(ids.wait))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("task view: the server says what the caller may do", async () => {
    const t = await createTask(await at(ids.lead), {
      projectId: ids.cloud,
      title: "Ribs",
      ownerPersonId: ids.gift,
    });
    const asOwner = await getTask(await at(ids.gift), t.id);
    expect(asOwner.can).toMatchObject({ edit: true, manage: false, comment: true });
    expect(asOwner.project.name).toBe("Cloud");
    const asOther = await getTask(await at(ids.kitchen), t.id);
    expect(asOther.can).toMatchObject({ edit: false, manage: false });
    expect((await getTask(await at(ids.lead), t.id)).can.manage).toBe(true);
    await expect(getTask(await at(ids.wait), t.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getTask(await at(ids.gift), ids.cloud)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
