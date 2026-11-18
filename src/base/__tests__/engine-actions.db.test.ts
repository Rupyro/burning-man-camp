// The task screens' server actions: the caller comes from the session; every engine call
// re-checks permission on the record (docs/specs/b2-task-engine.md §5, S1–S4).
import { beforeEach, describe, expect, it } from "vitest";
import { actAs } from "@/base/api/testing-db";
import { listMyNotifications } from "@/base/engine/notify";
import {
  addChecklist,
  claim,
  comment,
  decideTaskClaim,
  editTask,
  leaveTask,
  linkTasks,
  newProject,
  newTask,
  openForHelpers,
  readAllNotifications,
  readNotification,
  removeChecklist,
  removeComment,
  saveNotificationPreference,
  setOwner,
  tickChecklist,
  watch,
} from "@/base/engine/server/actions";
import { getTask } from "@/base/engine/tasks";
import { at, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.data;
};

describe("engine server actions", () => {
  beforeEach(async () => {
    ids = await engineFixture();
  });

  it("a lead plans work; a member claims, ticks and comments; the owner hears of it", async () => {
    await actAs(ids.lead);
    const p = ok(await newProject({ teamId: ids.giftTeam, name: "Cloud lights" }));
    const t = ok(await newTask({ projectId: p.id, title: "Rig", dueAt: "2027-04-20T10:00:00Z" }));
    const u = ok(await newTask({ projectId: p.id, title: "Test" }));
    ok(await linkTasks({ taskId: u.id, dependsOnTaskId: t.id, remove: false }));
    ok(await openForHelpers({ taskId: t.id, claimMode: "open_with_approval", claimCapacity: 2 }));
    ok(await setOwner({ taskId: t.id, ownerPersonId: ids.gift }));
    const item = ok(await addChecklist({ taskId: t.id, label: "Strips" }));

    await actAs(ids.kitchen);
    const c = ok(await claim({ taskId: t.id }));
    await actAs(ids.lead);
    ok(await decideTaskClaim({ assignmentId: c.assignmentId, approve: true }));
    await actAs(ids.kitchen);
    ok(await tickChecklist({ itemId: item.id, done: true }));
    const note = ok(await comment({ taskId: t.id, body: "Done the strips" }));
    ok(await watch({ taskId: u.id, on: true }));
    ok(await watch({ taskId: u.id, on: false }));
    ok(await removeComment({ commentId: note.id }));
    ok(await leaveTask({ assignmentId: c.assignmentId }));

    await actAs(ids.gift);
    ok(await editTask({ taskId: t.id, patch: { status: "in_progress" } }));
    const types = (await listMyNotifications(await at(ids.gift))).map((n) => n.type);
    expect(types).toEqual(["task.comment", "task.assigned"]);
    const [first] = await listMyNotifications(await at(ids.gift));
    expect(ok(await readNotification({ id: first?.id ?? "" }))).toEqual({ changed: true });
    ok(await readAllNotifications({}));
    ok(await saveNotificationPreference({ type: "task.comment", channel: "off" }));
    expect((await getTask(await at(ids.gift), t.id)).status).toBe("in_progress");

    await actAs(ids.lead);
    ok(await removeChecklist({ itemId: item.id }));
    ok(await linkTasks({ taskId: u.id, dependsOnTaskId: t.id, remove: true }));
  });

  it("readable problems come back as { ok: false }; refusals and sign-outs come back as { ok: false } too", async () => {
    await actAs(ids.lead);
    const t = ok(await newTask({ projectId: ids.cloud, title: "Rig" }));
    const blocked = await editTask({ taskId: t.id, patch: { status: "blocked" } });
    expect(blocked).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "Say why it's blocked (blockedReason: Say why it's blocked)",
    });
    expect((await linkTasks({ taskId: t.id, dependsOnTaskId: t.id, remove: false })).ok).toBe(
      false,
    );
    await actAs(ids.kitchen);
    expect(await setOwner({ taskId: t.id, ownerPersonId: ids.kitchen })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await claim({ taskId: t.id })).toEqual({
      ok: false,
      code: "VALIDATION",
      error: "This task isn't open for helpers",
    });
    await actAs(null);
    expect(await newTask({ projectId: ids.cloud, title: "x" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });
});
