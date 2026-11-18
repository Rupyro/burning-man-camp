// Home screen data (docs/specs/b3-home.md §3–4).
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { claimTask, setClaimMode } from "@/base/engine/claims";
import { notify } from "@/base/engine/notify";
import { createProject } from "@/base/engine/projects";
import { createTask, updateTask } from "@/base/engine/tasks";
import { getTeamBoard, listHelpRequests, listUnread } from "@/base/landing/home";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let late: string;
let blocked: string;
let kitchenLate: string;

describe("home data", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    const lead = await at(ids.lead);
    late = (await createTask(lead, { projectId: ids.cloud, title: "Late one", dueAt: days(-2) }))
      .id;
    blocked = (await createTask(lead, { projectId: ids.cloud, title: "Stuck", dueAt: days(9) })).id;
    await updateTask(lead, blocked, { status: "blocked", blockedReason: "waiting on wood" });
    const done = (await createTask(lead, { projectId: ids.cloud, title: "Done", dueAt: days(-5) }))
      .id;
    await updateTask(lead, done, { status: "done" });
    await createTask(lead, { projectId: ids.cloud, title: "Fine", dueAt: days(20) });
    const cook = await at(ids.cook);
    const meals = await createProject(cook, { teamId: ids.kitchenTeam, name: "Meal plan" });
    kitchenLate = (
      await createTask(cook, { projectId: meals.id, title: "Shopping list", dueAt: days(-1) })
    ).id;
  });

  it("team lead (allow): sees late and blocked work and readiness for their team only", async () => {
    const board = await getTeamBoard(await at(ids.lead));
    expect(board?.problems.map((t) => t.id).sort()).toEqual([late, blocked].sort());
    expect(board?.problems.map((t) => t.id)).not.toContain(kitchenLate);
    expect(board?.projects).toEqual([
      expect.objectContaining({ id: ids.cloud, done: 1, total: 4, percent: 25 }),
    ]);
  });

  it("camp lead (allow): sees every team", async () => {
    const board = await getTeamBoard(await at(ids.camp));
    expect(board?.problems.map((t) => t.id)).toContain(kitchenLate);
    expect(board?.projects).toHaveLength(2);
  });

  it("plain member (deny): no team board", async () => {
    expect(await getTeamBoard(await at(ids.gift))).toBeNull();
  });

  it("help requests: only for tasks I may manage, and never my own offer", async () => {
    await setClaimMode(await at(ids.lead), late, {
      claimMode: "open_with_approval",
      claimCapacity: null,
    });
    await claimTask(await at(ids.kitchen), late);
    const forLead = await listHelpRequests(await at(ids.lead));
    expect(forLead).toEqual([
      expect.objectContaining({
        taskId: late,
        taskTitle: "Late one",
        personName: "Kitchen Member",
      }),
    ]);
    // wrong record: the kitchen lead doesn't manage the gift team's task
    expect(await listHelpRequests(await at(ids.cook))).toEqual([]);
    expect(await listHelpRequests(await at(ids.kitchen))).toEqual([]);
  });

  it("unread notifications: mine only, newest first, capped", async () => {
    const send = (personId: string, title: string) =>
      notify(getDb(), {
        recipientPersonId: personId,
        type: "task.assigned",
        entityType: "base.task",
        entityId: late,
        title,
        href: `/tasks/${late}`,
      });
    for (const t of ["one", "two", "three", "four"]) await send(ids.gift, t);
    await send(ids.kitchen, "not yours");
    const mine = await listUnread(await at(ids.gift), 3);
    expect(mine.items.map((n) => n.title)).toEqual(["four", "three", "two"]);
    expect(mine.count).toBe(4);
  });
});
