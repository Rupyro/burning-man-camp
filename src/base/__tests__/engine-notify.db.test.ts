// In-app notifications, preferences and queued emails (docs/specs/b2-task-engine.md N1, N2, T7,
// C2, K2). Emails only reach the outbox here; sending is a later slice.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { claimTask, decideClaim, setClaimMode } from "@/base/engine/claims";
import { addComment } from "@/base/engine/comments";
import {
  enqueueEmail,
  getMyPreferences,
  listMyNotifications,
  markAllRead,
  markRead,
  setMyPreference,
  unreadCount,
} from "@/base/engine/notify";
import { createTask, setTaskOwner } from "@/base/engine/tasks";
import { ValidationError } from "@/base/errors";
import { emailOutbox, notifications } from "@/base/schema";
import { at, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
let task: string;
const mine = async (who: string) =>
  (await listMyNotifications(await at(who))).map((n) => [n.type, n.title, n.urgency]);
const outbox = () => getDb().select().from(emailOutbox);

describe("engine: notifications", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    task = (await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Rig lights" })).id;
  });

  it("N1/T7: the new owner is told, with a link; only they see it and can mark it read", async () => {
    await setTaskOwner(await at(ids.lead), task, ids.gift);
    expect(await mine(ids.gift)).toEqual([
      ["task.assigned", "Assigned to you: Rig lights", "immediate"],
    ]);
    const [n] = await listMyNotifications(await at(ids.gift));
    expect(n?.href).toBe(`/tasks/${task}`);
    expect(await mine(ids.kitchen)).toEqual([]);
    const id = n?.id ?? "";
    expect(await markRead(await at(ids.kitchen), id)).toEqual({ changed: false });
    expect(await unreadCount(await at(ids.gift))).toBe(1);
    expect(await markRead(await at(ids.gift), id)).toEqual({ changed: true });
    expect(await unreadCount(await at(ids.gift))).toBe(0);
  });

  it("T7: taking a task yourself sends nothing; creating one for someone else does", async () => {
    await setTaskOwner(await at(ids.lead), task, ids.lead);
    await createTask(await at(ids.gift), {
      projectId: ids.cloud,
      title: "Mine",
      ownerPersonId: ids.gift,
    });
    expect(await getDb().select().from(notifications)).toHaveLength(0);
    await createTask(await at(ids.lead), {
      projectId: ids.cloud,
      title: "Paint",
      ownerPersonId: ids.gift,
    });
    expect(await mine(ids.gift)).toEqual([
      ["task.assigned", "Assigned to you: Paint", "immediate"],
    ]);
  });

  it("N2: assignments email at once (queued once); comments wait for the digest", async () => {
    await setTaskOwner(await at(ids.lead), task, ids.gift);
    const [mail] = await outbox();
    expect(mail).toMatchObject({ toEmail: expect.stringContaining("@"), template: "notification" });
    expect(mail?.payload).toMatchObject({ subject: "Assigned to you: Rig lights" });
    const [n] = await listMyNotifications(await at(ids.gift));
    expect(mail?.dedupeKey).toBe(`notification:${n?.id}`);
    expect(
      await enqueueEmail(getDb(), {
        toPersonId: ids.gift,
        toEmail: "x@example.test",
        template: "notification",
        payload: { subject: "again", text: "again" },
        dedupeKey: `notification:${n?.id}`,
      }),
    ).toEqual({ queued: false });
    await addComment(await at(ids.kitchen), task, "Spare cable ties here");
    expect((await mine(ids.gift))[0]).toEqual([
      "task.comment",
      "New comment: Rig lights",
      "digest",
    ]);
    expect(await outbox()).toHaveLength(1);
  });

  it("N2: people choose per type; '*' covers the rest; off sends nothing", async () => {
    const gift = await at(ids.gift);
    expect((await getMyPreferences(gift)).find((p) => p.type === "task.assigned")?.channel).toBe(
      "email_immediate",
    );
    await setMyPreference(gift, "task.assigned", "off");
    await setMyPreference(gift, "*", "in_app");
    await setMyPreference(gift, "*", "in_app");
    await setTaskOwner(await at(ids.lead), task, ids.gift);
    await addComment(await at(ids.kitchen), task, "Hi");
    expect(await mine(ids.gift)).toEqual([
      ["task.comment", "New comment: Rig lights", "immediate"],
    ]);
    expect(await outbox()).toHaveLength(0);
    const prefs = await getMyPreferences(gift);
    expect(prefs.find((p) => p.type === "claim.decided")?.channel).toBe("in_app");
    await expect(setMyPreference(gift, "no such type!", "off")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("C2/K2: claimers hear the decision; watchers (not the author) hear of comments", async () => {
    await setClaimMode(await at(ids.lead), task, {
      claimMode: "open_with_approval",
      claimCapacity: null,
    });
    const c = await claimTask(await at(ids.kitchen), task);
    await decideClaim(await at(ids.lead), c.assignmentId, true);
    expect(await mine(ids.kitchen)).toEqual([
      ["claim.decided", "Claim approved: Rig lights", "immediate"],
    ]);
    await addComment(await at(ids.kitchen), task, "On it");
    await addComment(await at(ids.cook), task, "Need gas?");
    expect((await mine(ids.kitchen)).map((n) => n[0])).toEqual(["task.comment", "claim.decided"]);
    expect(await mine(ids.cook)).toEqual([]);
    await markAllRead(await at(ids.kitchen));
    expect(await unreadCount(await at(ids.kitchen))).toBe(0);
    const left = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.recipientPersonId, ids.cook));
    expect(left).toHaveLength(0);
  });
});
