// What the project screens load (docs/specs/b2-task-engine.md S2): one project with what the
// caller may do there, and the teams a person can start a project for.
import { describe, expect, it } from "vitest";
import { getProject, listPlannableTeams } from "@/base/engine/projects";
import { ForbiddenError } from "@/base/errors";
import { at, engineFixture } from "./engine-fixture";

describe("engine: project view", () => {
  it("S2: shows the project and team, and what the caller can do", async () => {
    const ids = await engineFixture();
    const asLead = await getProject(await at(ids.lead), ids.cloud);
    expect(asLead).toMatchObject({ name: "Cloud", teamName: expect.any(String) });
    expect(asLead.can).toEqual({ plan: true, addTask: true });
    expect((await getProject(await at(ids.gift), ids.cloud)).can).toEqual({
      plan: false,
      addTask: true,
    });
    expect((await getProject(await at(ids.kitchen), ids.cloud)).can).toEqual({
      plan: false,
      addTask: false,
    });
    await expect(getProject(await at(ids.wait), ids.cloud)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getProject(await at(ids.lead), ids.gift)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("team leads can plan for their own team; the camp lead for every team; members none", async () => {
    const ids = await engineFixture();
    expect((await listPlannableTeams(await at(ids.lead))).map((t) => t.id)).toEqual([ids.giftTeam]);
    expect((await listPlannableTeams(await at(ids.camp))).map((t) => t.id).sort()).toEqual(
      [ids.giftTeam, ids.kitchenTeam].sort(),
    );
    expect(await listPlannableTeams(await at(ids.gift))).toEqual([]);
  });
});
