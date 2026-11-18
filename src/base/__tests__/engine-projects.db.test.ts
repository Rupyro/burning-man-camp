// Projects through the engine service (docs/specs/b2-task-engine.md T1).
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { createProject, listProjects } from "@/base/engine/projects";
import { ForbiddenError } from "@/base/errors";
import { auditEvents, projects } from "@/base/schema";
import { at, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;

describe("engine: projects", () => {
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("T1: a team lead creates a project for their team, audited", async () => {
    const p = await createProject(await at(ids.lead), { teamId: ids.giftTeam, name: "Ossewas" });
    expect((await listProjects(await at(ids.gift))).map((x) => x.name)).toContain("Ossewas");
    const audits = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "project.created"));
    expect(audits).toHaveLength(1);
    const [row] = await getDb().select().from(projects).where(eq(projects.id, p.id));
    expect(row).toMatchObject({ leadPersonId: ids.lead, status: "active", kind: "general" });
  });

  it("T1: a workstream nests under a project of the same team only", async () => {
    const lead = await at(ids.lead);
    const sub = await createProject(lead, {
      teamId: ids.giftTeam,
      name: "Cloud: build",
      parentProjectId: ids.cloud,
      phase: "build",
    });
    expect(sub.id).toBeTruthy();
    const camp = await at(ids.camp);
    await expect(
      createProject(camp, { teamId: ids.kitchenTeam, name: "X", parentProjectId: ids.cloud }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("T1 (deny): a member, the lead of another team, or an unknown team", async () => {
    await expect(
      createProject(await at(ids.gift), { teamId: ids.giftTeam, name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createProject(await at(ids.cook), { teamId: ids.giftTeam, name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      createProject(await at(ids.camp), { teamId: ids.cloud, name: "X" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getDb().select().from(projects)).toHaveLength(1);
  });

  it("lists are for confirmed members only", async () => {
    expect(await listProjects(await at(ids.kitchen))).toHaveLength(1);
    await expect(listProjects(await at(ids.wait))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
