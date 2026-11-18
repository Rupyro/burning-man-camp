// Fun extras: the finished-task count behind the milestones and badges.
import { beforeEach, describe, expect, it } from "vitest";
import { createTask, setTaskOwner, updateTask } from "@/base/engine/tasks";
import { countMyFinished } from "@/base/landing/home";
import { at, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;

describe("finished tasks count", () => {
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("counts only my own done tasks", async () => {
    const lead = await at(ids.lead);
    for (const title of ["One", "Two", "Open"]) {
      const t = await createTask(lead, { projectId: ids.cloud, title });
      await setTaskOwner(lead, t.id, ids.lead);
      if (title !== "Open") await updateTask(lead, t.id, { status: "done" });
    }
    expect(await countMyFinished(lead)).toBe(2);
    expect(await countMyFinished(await at(ids.gift))).toBe(0);
  });
});
