// Lead home team pulse (docs/specs/b3-home-up-next.md §2): per-team late rows and readiness.
import { beforeEach, describe, expect, it } from "vitest";
import { createProject } from "@/base/engine/projects";
import { createTask, updateTask } from "@/base/engine/tasks";
import { getTeamPulse } from "@/base/landing/home";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let late: string[];
let blocked: string;

describe("getTeamPulse", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    const lead = await at(ids.lead);
    late = [];
    for (const [title, due] of [
      ["Late A", -2],
      ["Late B", -9],
      ["Late C", -1],
    ] as const)
      late.push((await createTask(lead, { projectId: ids.cloud, title, dueAt: days(due) })).id);
    const started = late[2] ?? "";
    await updateTask(lead, started, { status: "in_progress" });
    blocked = (await createTask(lead, { projectId: ids.cloud, title: "Stuck", dueAt: days(-4) }))
      .id;
    await updateTask(lead, blocked, { status: "blocked", blockedReason: "wood" });
    const done = (await createTask(lead, { projectId: ids.cloud, title: "Done", dueAt: days(-5) }))
      .id;
    await updateTask(lead, done, { status: "done" });
    const gone = (await createTask(lead, { projectId: ids.cloud, title: "Gone", dueAt: days(-5) }))
      .id;
    await updateTask(lead, gone, { status: "cancelled" });
    await createTask(lead, { projectId: ids.cloud, title: "Fine", dueAt: days(20) });
    const cook = await at(ids.cook);
    const meals = await createProject(cook, { teamId: ids.kitchenTeam, name: "Meal plan" });
    await createTask(cook, { projectId: meals.id, title: "Shopping list", dueAt: days(-1) });
  });

  it("team lead (allow): exact counts and readiness for their own team", async () => {
    const pulse = await getTeamPulse(await at(ids.lead));
    expect(pulse).toHaveLength(1);
    const [gift] = pulse ?? [];
    expect(gift).toMatchObject({
      teamId: ids.giftTeam,
      late: 3,
      blocked: 1,
      done: 1,
      total: 6,
      percent: 17,
    });
    // late first, oldest due first; blocked last
    expect(gift?.tasks.map((t) => t.title)).toEqual(["Late B", "Late A", "Late C", "Stuck"]);
    expect(gift?.tasks[0]).toMatchObject({ projectName: "Cloud", status: "todo" });
  });

  it("wrong record: the gift lead never sees Kitchen's late work", async () => {
    const pulse = await getTeamPulse(await at(ids.lead));
    expect(pulse?.map((t) => t.teamId)).not.toContain(ids.kitchenTeam);
    expect(JSON.stringify(pulse)).not.toContain("Shopping list");
  });

  it("camp lead (allow): every team, including teams with nothing late", async () => {
    const pulse = (await getTeamPulse(await at(ids.camp))) ?? [];
    expect(pulse.find((t) => t.teamId === ids.kitchenTeam)).toMatchObject({ late: 1, total: 1 });
    expect(pulse.find((t) => t.teamId === ids.giftTeam)?.late).toBe(3);
    expect(pulse.length).toBeGreaterThanOrEqual(2);
  });

  it("caps each team's list but keeps exact counts", async () => {
    const [gift] = (await getTeamPulse(await at(ids.lead), 2)) ?? [];
    expect(gift?.tasks).toHaveLength(2);
    expect(gift?.late).toBe(3);
    expect(gift?.blocked).toBe(1);
  });

  it("plain member (deny): null, nothing loaded", async () => {
    expect(await getTeamPulse(await at(ids.gift))).toBeNull();
    expect(await getTeamPulse(await at(ids.kitchen))).toBeNull();
  });
});
