// B2 notifications schema (DATA_MODEL.md §12, docs/specs/b2-task-engine.md A5, N1–N3, J1):
// defaults and the constraints the database enforces whatever the app code does.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, getDb, truncateAll } from "@/base/api/testing-db";
import {
  alertRules,
  alertStates,
  emailOutbox,
  jobRuns,
  notificationPreferences,
  notifications,
} from "@/base/schema";
import { firstRow } from "@/lib/rows";

let personId: string;
const T = new Date("2027-04-10T07:00:00Z");
const state = (level: number, fingerprint = "2027-04-12") => ({
  ruleKey: "overdue",
  entityType: "base.task",
  entityId: "00000000-0000-4000-8000-000000000001",
  level,
  fingerprint,
  firstFiredAt: T,
  lastFiredAt: T,
});

describe("B2 notifications schema", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    personId = await createPerson({ email: "a@example.test", name: "A" });
  });

  it("A5: an alert fires once per rule, task, level and due date", async () => {
    await getDb().insert(alertStates).values(state(0));
    await expect(getDb().insert(alertStates).values(state(0))).rejects.toThrow();
    await getDb().insert(alertStates).values(state(1));
    await getDb().insert(alertStates).values(state(0, "2027-04-20"));
    await expect(getDb().insert(alertStates).values(state(3))).rejects.toThrow();
  });

  it("alert rules default to enabled with no thresholds; out-of-range days are refused", async () => {
    const r = firstRow(await getDb().insert(alertRules).values({ key: "due_soon" }).returning());
    expect([r.enabled, r.remindDaysBefore, r.withinDays]).toEqual([true, null, null]);
    await expect(
      getDb().insert(alertRules).values({ key: "overdue", escalateLeadAfterDays: 61 }),
    ).rejects.toThrow();
    await expect(
      getDb().insert(alertRules).values({ key: "unowned", withinDays: 0 }),
    ).rejects.toThrow();
    // Hour thresholds (shared, e.g. shifts): 1 to 720 hours.
    await getDb().insert(alertRules).values({ key: "shifts.gap", remindHoursBefore: 48 });
    await expect(
      getDb().insert(alertRules).values({ key: "shifts.swap", escalateLeadHoursBefore: 0 }),
    ).rejects.toThrow();
  });

  it("N1: a notification starts unread and undigested", async () => {
    const n = firstRow(
      await getDb()
        .insert(notifications)
        .values({
          recipientPersonId: personId,
          type: "task.assigned",
          entityType: "base.task",
          entityId: randomUUID(),
          title: "Assigned: Rig the lights",
          href: "/tasks/x",
          urgency: "immediate",
        })
        .returning(),
    );
    expect([n.readAt, n.digestedAt, n.alertStateId]).toEqual([null, null, null]);
  });

  it("N2: one preference per person and type; '*' is the default type", async () => {
    const p = firstRow(
      await getDb()
        .insert(notificationPreferences)
        .values({ personId, channel: "email_digest" })
        .returning(),
    );
    expect([p.type, p.digestFrequency]).toEqual(["*", "daily"]);
    await expect(
      getDb().insert(notificationPreferences).values({ personId, channel: "off" }),
    ).rejects.toThrow();
  });

  it("N3: the same email key never queues twice; rows start pending", async () => {
    const row = {
      toEmail: "a@example.test",
      template: "notification",
      payload: { subject: "s", text: "t" },
      dedupeKey: "notification:1",
    };
    const o = firstRow(await getDb().insert(emailOutbox).values(row).returning());
    expect([o.status, o.attempts, o.sentAt]).toEqual(["pending", 0, null]);
    await expect(getDb().insert(emailOutbox).values(row)).rejects.toThrow();
  });

  it("J1: a job run starts running with empty stats", async () => {
    const j = firstRow(
      await getDb().insert(jobRuns).values({ job: "tick", startedAt: T }).returning(),
    );
    expect([j.status, j.stats, j.finishedAt]).toEqual(["running", {}, null]);
  });
});
