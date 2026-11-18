// Checklist, comments and watchers through the engine service (docs/specs/b2-task-engine.md K1–K3).
import { beforeEach, describe, expect, it } from "vitest";
import {
  addChecklistItem,
  listChecklist,
  removeChecklistItem,
  tickChecklistItem,
} from "@/base/engine/checklist";
import { addHelper } from "@/base/engine/claims";
import {
  addComment,
  deleteComment,
  listComments,
  listWatchers,
  unwatchTask,
  watchTask,
} from "@/base/engine/comments";
import { createTask } from "@/base/engine/tasks";
import { ForbiddenError, ValidationError } from "@/base/errors";
import { at, days, type EngineIds, engineFixture, NOW } from "./engine-fixture";

let ids: EngineIds;
let task: string;

describe("engine: checklist, comments, watchers", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    task = (
      await createTask(await at(ids.lead), {
        projectId: ids.cloud,
        title: "Rig the lights",
        ownerPersonId: ids.gift,
        dueAt: days(6),
      })
    ).id;
  });

  it("K1: owner, helpers and leads tick items; others can't", async () => {
    const one = await addChecklistItem(await at(ids.gift), task, "Test every strip");
    const two = await addChecklistItem(await at(ids.lead), task, "Label the plugs");
    await expect(addChecklistItem(await at(ids.kitchen), task, "Nope")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(addChecklistItem(await at(ids.gift), task, "  ")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(tickChecklistItem(await at(ids.kitchen), one.id, true)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await addHelper(await at(ids.lead), task, ids.kitchen);
    await tickChecklistItem(await at(ids.kitchen), one.id, true);
    await tickChecklistItem(await at(ids.gift), two.id, true);
    await tickChecklistItem(await at(ids.lead), two.id, false);
    await expect(tickChecklistItem(await at(ids.cook), one.id, false)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const list = await listChecklist(await at(ids.cook), task);
    expect(list.map((i) => [i.label, i.doneByPersonId, i.doneAt?.getTime() ?? null])).toEqual([
      ["Test every strip", ids.kitchen, NOW.getTime()],
      ["Label the plugs", null, null],
    ]);
    await expect(removeChecklistItem(await at(ids.kitchen), two.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await removeChecklistItem(await at(ids.gift), two.id);
    expect((await listChecklist(await at(ids.gift), task)).map((i) => i.label)).toEqual([
      "Test every strip",
    ]);
  });

  it("K2: any confirmed member comments; author and owner become watchers", async () => {
    await addComment(await at(ids.kitchen), task, "I have spare cable ties");
    await addComment(await at(ids.gift), task, "Thanks!");
    expect((await listWatchers(await at(ids.gift), task)).sort()).toEqual(
      [ids.gift, ids.kitchen].sort(),
    );
    const list = await listComments(await at(ids.cook), task);
    expect(list.map((c) => [c.body, c.authorPersonId])).toEqual([
      ["I have spare cable ties", ids.kitchen],
      ["Thanks!", ids.gift],
    ]);
    await expect(addComment(await at(ids.wait), task, "Hi")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addComment(await at(ids.gift), task, " ")).rejects.toBeInstanceOf(ValidationError);
  });

  it("comments: the author or a lead removes one; others can't", async () => {
    const c = await addComment(await at(ids.kitchen), task, "Wrong task, sorry");
    const d = await addComment(await at(ids.kitchen), task, "Off topic");
    await expect(deleteComment(await at(ids.gift), c.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteComment(await at(ids.kitchen), c.id);
    await deleteComment(await at(ids.lead), d.id);
    expect(await listComments(await at(ids.gift), task)).toEqual([]);
  });

  it("K3: watch and unwatch any visible task; waitlisted can't", async () => {
    await watchTask(await at(ids.cook), task);
    await watchTask(await at(ids.cook), task);
    expect(await listWatchers(await at(ids.cook), task)).toEqual([ids.cook]);
    await unwatchTask(await at(ids.cook), task);
    expect(await listWatchers(await at(ids.cook), task)).toEqual([]);
    await expect(watchTask(await at(ids.wait), task)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
