// Helpers and claims through the engine service (docs/specs/b2-task-engine.md C1–C4).
import { beforeEach, describe, expect, it } from "vitest";
import {
  addHelper,
  claimTask,
  decideClaim,
  listAvailableWork,
  listHelpers,
  setClaimMode,
  withdrawClaim,
} from "@/base/engine/claims";
import { createTask, listMyTasks, updateTask } from "@/base/engine/tasks";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { at, days, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let task: string;

const open = async (claimMode: "open" | "open_with_approval" | "closed", claimCapacity?: number) =>
  setClaimMode(await at(ids.lead), task, { claimMode, claimCapacity: claimCapacity ?? null });
const claim = async (who: string) => claimTask(await at(who), task);
const refusal = async (p: Promise<unknown>) => {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ValidationError);
  return (err as Error).message;
};

describe("engine: helpers and claims", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    task = (
      await createTask(await at(ids.lead), {
        projectId: ids.cloud,
        title: "Sand the panels",
        dueAt: days(4),
      })
    ).id;
  });

  it("C1: an open task with room: a confirmed member claims it and sees it in My tasks", async () => {
    await open("open", 2);
    await addHelper(await at(ids.lead), task, ids.gift);
    expect((await listAvailableWork(await at(ids.kitchen))).map((t) => t.id)).toEqual([task]);
    expect(await claim(ids.kitchen)).toMatchObject({ status: "active" });
    expect((await listMyTasks(await at(ids.kitchen))).map((t) => t.id)).toEqual([task]);
    const helpers = await listHelpers(await at(ids.gift), task);
    expect(helpers.map((h) => [h.personId, h.status, h.source])).toEqual([
      [ids.gift, "active", "assigned"],
      [ids.kitchen, "active", "claimed"],
    ]);
    expect(await listAvailableWork(await at(ids.cook))).toEqual([]); // full now
  });

  it("C2: with approval, a claim waits; a lead decides; nobody approves their own claim", async () => {
    await open("open_with_approval");
    const k = await claim(ids.kitchen);
    expect(k.status).toBe("pending_approval");
    expect(await listMyTasks(await at(ids.kitchen))).toEqual([]);
    await expect(decideClaim(await at(ids.gift), k.assignmentId, true)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await decideClaim(await at(ids.lead), k.assignmentId, true)).toEqual({
      status: "active",
    });
    const c = await claim(ids.cook);
    expect(await decideClaim(await at(ids.lead), c.assignmentId, false)).toEqual({
      status: "declined",
    });
    await expect(decideClaim(await at(ids.lead), c.assignmentId, true)).rejects.toBeInstanceOf(
      ValidationError,
    );
    const mine = await claim(ids.lead);
    await expect(decideClaim(await at(ids.lead), mine.assignmentId, true)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await decideClaim(await at(ids.camp), mine.assignmentId, true)).toEqual({
      status: "active",
    });
  });

  it("C3 (deny): closed, full, finished, twice, own task, waitlisted", async () => {
    expect(await refusal(claim(ids.kitchen))).toBe("This task isn't open for helpers");
    await open("open", 1);
    await claim(ids.kitchen);
    expect(await refusal(claim(ids.kitchen))).toBe("You're already helping on this task");
    expect(await refusal(claim(ids.cook))).toBe("This task has all the helpers it needs");
    await expect(claim(ids.wait)).rejects.toBeInstanceOf(ForbiddenError);
    await updateTask(await at(ids.lead), task, { status: "done" });
    await open("open");
    expect(await refusal(claim(ids.cook))).toBe("This task is finished");
    const owned = await createTask(await at(ids.gift), {
      projectId: ids.cloud,
      title: "Mine",
      ownerPersonId: ids.gift,
    });
    await setClaimMode(await at(ids.lead), owned.id, { claimMode: "open", claimCapacity: null });
    expect(await refusal(claimTask(await at(ids.gift), owned.id))).toBe(
      "You already own this task",
    );
  });

  it("C4: a helper withdraws (and may claim again); a lead removes a helper; others can't", async () => {
    await open("open");
    const k = await claim(ids.kitchen);
    const c = await claim(ids.cook);
    await expect(withdrawClaim(await at(ids.gift), k.assignmentId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await withdrawClaim(await at(ids.kitchen), k.assignmentId)).toEqual({
      status: "withdrawn",
    });
    expect(await claim(ids.kitchen)).toMatchObject({ status: "active" });
    expect(await withdrawClaim(await at(ids.lead), c.assignmentId)).toEqual({
      status: "withdrawn",
    });
    expect(await refusal(withdrawClaim(await at(ids.lead), c.assignmentId))).toBe(
      "That help has already ended",
    );
    expect((await listHelpers(await at(ids.gift), task)).map((h) => h.personId)).toEqual([
      ids.kitchen,
    ]);
  });

  it("(deny) only leads open a task or add helpers; helpers must be confirmed", async () => {
    await expect(
      setClaimMode(await at(ids.gift), task, { claimMode: "open", claimCapacity: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addHelper(await at(ids.gift), task, ids.kitchen)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(await refusal(addHelper(await at(ids.lead), task, ids.wait))).toBe(
      "That person isn't a confirmed member this year",
    );
    await addHelper(await at(ids.lead), task, ids.kitchen);
    expect(await refusal(addHelper(await at(ids.lead), task, ids.kitchen))).toBe(
      "They're already helping on this task",
    );
    await expect(listHelpers(await at(ids.wait), task)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
