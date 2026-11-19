// Sending queued emails and the daily digest (docs/specs/b2-task-engine.md N3, N4).
// The memory adapter stands in for email; nothing leaves the box.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { clearSentEmails, memoryAdapter, sentEmails, setEmailAdapter } from "@/base/email/adapter";
import { addComment, watchTask } from "@/base/engine/comments";
import { runDigest } from "@/base/engine/digest";
import { enqueueEmail } from "@/base/engine/notify";
import { sendPendingEmails } from "@/base/engine/outbox";
import { createTask, setTaskOwner } from "@/base/engine/tasks";
import { emailOutbox, notifications } from "@/base/schema";
import { firstRow } from "@/lib/rows";
import { at, days, type EngineIds, engineFixture, NOW } from "./engine-fixture";

let ids: EngineIds;
const db = () => getDb();
const queue = (key: string, template = "notification") =>
  enqueueEmail(db(), {
    toPersonId: null,
    toEmail: `${key}@example.test`,
    template,
    payload: { subject: `About ${key}`, text: "Hello", link: "http://localhost:3000/tasks/x" },
    dedupeKey: key,
  });
const statuses = async () =>
  (await db().select().from(emailOutbox).orderBy(emailOutbox.dedupeKey)).map((r) => [
    r.dedupeKey,
    r.status,
  ]);
/** 06:00 and 07:30 in camp time (America/Los_Angeles, UTC-7 in April) on NOW's day. */
const SIX_AM = new Date("2027-04-10T13:00:00Z");
const HALF_SEVEN = new Date("2027-04-10T14:30:00Z");

describe("engine: outbox and digest", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    setEmailAdapter(memoryAdapter);
    clearSentEmails();
  });

  it("N3: sends pending emails up to the daily cap, immediate before digest, rest next day", async () => {
    await queue("c-digest", "digest");
    await queue("a");
    await queue("b");
    expect(await sendPendingEmails(db(), NOW, { cap: 2 })).toEqual({
      sent: 2,
      failed: 0,
      deferred: 1,
    });
    expect(sentEmails().map((m) => [m.to, m.subject, m.tag])).toEqual([
      ["a@example.test", "About a", "notification"],
      ["b@example.test", "About b", "notification"],
    ]);
    expect(await sendPendingEmails(db(), new Date(NOW.getTime() + 3_600_000), { cap: 2 })).toEqual({
      sent: 0,
      failed: 0,
      deferred: 1,
    });
    expect(await sendPendingEmails(db(), days(1), { cap: 2 })).toEqual({
      sent: 1,
      failed: 0,
      deferred: 0,
    });
    expect(await statuses()).toEqual([
      ["a", "sent"],
      ["b", "sent"],
      ["c-digest", "sent"],
    ]);
  });

  it("N3: a failed send is retried later, then given up after 5 tries", async () => {
    await queue("a");
    setEmailAdapter({
      name: "broken",
      async send() {
        throw new Error("provider down");
      },
    });
    expect(await sendPendingEmails(db(), NOW, { cap: 10 })).toEqual({
      sent: 0,
      failed: 1,
      deferred: 0,
    });
    const [row] = await db().select().from(emailOutbox);
    expect([row?.status, row?.attempts, row?.lastError]).toEqual(["pending", 1, "provider down"]);
    expect((row?.nextAttemptAt.getTime() ?? 0) > NOW.getTime()).toBe(true);
    expect(await sendPendingEmails(db(), NOW, { cap: 10 })).toEqual({
      sent: 0,
      failed: 0,
      deferred: 0,
    });
    for (let d = 1; d <= 4; d++) await sendPendingEmails(db(), days(d), { cap: 10 });
    expect(await statuses()).toEqual([["a", "failed"]]);
  });

  it("N4: once a day after 07:00 camp time, one digest per person, grouped by type", async () => {
    const t1 = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Rig lights" });
    const t2 = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Paint" });
    await watchTask(await at(ids.gift), t1.id);
    await watchTask(await at(ids.gift), t2.id);
    await addComment(await at(ids.kitchen), t1.id, "Spare ties");
    await addComment(await at(ids.cook), t2.id, "Gas?");
    await setTaskOwner(await at(ids.lead), t1.id, ids.gift); // immediate, not in the digest

    expect(await runDigest(db(), SIX_AM)).toEqual({ people: 0, notifications: 0 });
    expect(await runDigest(db(), HALF_SEVEN)).toEqual({ people: 1, notifications: 2 });
    const digests = await db().select().from(emailOutbox).where(eq(emailOutbox.template, "digest"));
    expect(digests).toHaveLength(1);
    const d = firstRow(digests, "digest");
    expect(d.toPersonId).toBe(ids.gift);
    expect(d.payload).toMatchObject({ subject: "Your Camp: 2 updates" });
    const text = (d.payload as { text: string }).text;
    expect(text).toContain("New comments\n- New comment: Rig lights");
    expect(text).toContain("- New comment: Paint");
    expect(text).not.toContain("Assigned");
    expect(await runDigest(db(), HALF_SEVEN)).toEqual({ people: 0, notifications: 0 });
  });

  it("N4: news after today's digest waits for tomorrow's; nothing new means no email", async () => {
    const t = await createTask(await at(ids.lead), { projectId: ids.cloud, title: "Rig lights" });
    await watchTask(await at(ids.gift), t.id);
    await addComment(await at(ids.kitchen), t.id, "One");
    await runDigest(db(), HALF_SEVEN);
    await addComment(await at(ids.kitchen), t.id, "Two");
    expect(await runDigest(db(), new Date(HALF_SEVEN.getTime() + 3_600_000))).toEqual({
      people: 0,
      notifications: 0,
    });
    const waiting = await db()
      .select()
      .from(notifications)
      .where(eq(notifications.recipientPersonId, ids.gift));
    expect(waiting.filter((n) => n.digestedAt === null)).toHaveLength(1);
    expect(await runDigest(db(), days(1))).toEqual({ people: 1, notifications: 1 });
    expect(await runDigest(db(), days(2))).toEqual({ people: 0, notifications: 0 });
  });
});
