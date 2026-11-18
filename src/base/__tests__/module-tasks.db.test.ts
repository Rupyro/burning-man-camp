// ctx.tasks: the engine as modules see it (docs/specs/obligations.md §8). Base rules still apply.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { getDb } from "@/base/api/testing-db";
import { createModuleTasksApi } from "@/base/engine/module-tasks";
import { auditEvents, projects, tasks } from "@/base/schema";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
const api = async (personId: string) => createModuleTasksApi(await at(personId));

describe("module tasks API", () => {
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("ensureProject creates once, then finds the same project", async () => {
    const camp = await api(ids.camp);
    const a = await camp.ensureProject({
      teamKey: "kitchen",
      name: "Deadlines",
      kind: "obligations",
    });
    const b = await camp.ensureProject({ teamKey: "kitchen", name: "Deadlines" });
    expect(b).toEqual(a);
    expect(a.teamId).toBe(ids.kitchenTeam);
    const rows = await getDb().select().from(projects).where(eq(projects.name, "Deadlines"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("obligations");
  });

  it("refuses ensureProject for someone who can't manage that team", async () => {
    const member = await api(ids.kitchen);
    await expect(member.ensureProject({ teamKey: "kitchen", name: "X" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      (await api(ids.camp)).ensureProject({ teamKey: "nope", name: "X" }),
    ).rejects.toThrow(/No team/);
  });

  it("creates, updates and reassigns through the engine, with audit rows", async () => {
    const camp = await api(ids.camp);
    const t = await camp.create({
      projectId: ids.cloud,
      title: "Register camp",
      kind: "task",
      dueAt: days(3),
      ownerPersonId: ids.gift,
    });
    expect((await camp.update(t.id, { status: "in_progress" })).changed).toBe(true);
    expect((await camp.setOwner(t.id, ids.lead)).changed).toBe(true);
    const [row] = await getDb().select().from(tasks).where(eq(tasks.id, t.id));
    expect(row?.status).toBe("in_progress");
    expect(row?.ownerPersonId).toBe(ids.lead);
    const audits = await getDb().select().from(auditEvents).where(eq(auditEvents.entityId, t.id));
    expect(audits.map((a) => a.action).sort()).toEqual([
      "task.created",
      "task.owner_changed",
      "task.status_changed",
    ]);
  });

  it("keeps base permission and kind checks", async () => {
    const gift = await api(ids.gift);
    const camp = await api(ids.camp);
    const t = await camp.create({ projectId: ids.cloud, title: "T", kind: "task" });
    await expect(gift.setOwner(t.id, ids.gift)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      camp.create({ projectId: ids.cloud, title: "T", kind: "nope.kind" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
