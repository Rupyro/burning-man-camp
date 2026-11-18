// Team reminders (option A, 27 Oct 2026): leads see what's due by person and nudge with one alert.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/base/api/testing-db";
import { nudgePerson, reminderTeams, teamReminders } from "@/base/engine/reminders";
import { createTask } from "@/base/engine/tasks";
import { ForbiddenError } from "@/base/errors";
import { notifications } from "@/base/schema";
import { at, type EngineIds, engineFixture } from "./engine-fixture";

let ids: EngineIds;
const nudges = (to: string) =>
  getDb()
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientPersonId, to), eq(notifications.type, "task.nudge")));

describe("team reminders", () => {
  beforeEach(async () => {
    ids = await engineFixture();
    const lead = await at(ids.lead);
    await createTask(lead, {
      projectId: ids.cloud,
      title: "Late one",
      dueAt: "2027-04-01T10:00:00Z",
      ownerPersonId: ids.gift,
    });
    await createTask(lead, {
      projectId: ids.cloud,
      title: "Later one",
      dueAt: "2027-05-01T10:00:00Z",
      ownerPersonId: ids.gift,
    });
    await createTask(lead, {
      projectId: ids.cloud,
      title: "Lead's own",
      dueAt: "2027-05-02T10:00:00Z",
      ownerPersonId: ids.lead,
    });
  });

  it("a lead sees their team by person, most late first", async () => {
    const lead = await at(ids.lead);
    expect((await reminderTeams(lead)).map((t) => t.id)).toEqual([ids.giftTeam]);
    const view = await teamReminders(lead, ids.giftTeam);
    expect(view.people.map((p) => [p.personId, p.lateCount, p.tasks.length])).toEqual([
      [ids.gift, 1, 2],
      [ids.lead, 0, 1],
    ]);
    expect(view.people[0]?.tasks[0]?.title).toBe("Late one");
  });

  it("a nudge is one task.nudge alert, then a 2-day wait", async () => {
    const lead = await at(ids.lead);
    expect(await nudgePerson(lead, { teamId: ids.giftTeam, personId: ids.gift })).toEqual({
      late: 1,
    });
    const [n] = await nudges(ids.gift);
    expect(n?.title).toMatch(/nudged you: 1 late task in /);
    expect(n?.href).toBe("/tasks");
    await expect(nudgePerson(lead, { teamId: ids.giftTeam, personId: ids.gift })).rejects.toThrow(
      "Already nudged in the last 2 days",
    );
    const later = { ...lead, now: new Date(lead.now.getTime() + 2 * 86_400_000 + 1) };
    await nudgePerson(later, { teamId: ids.giftTeam, personId: ids.gift });
    expect(await nudges(ids.gift)).toHaveLength(2);
  });

  it("refuses yourself, nothing-late and other teams' leads", async () => {
    await expect(
      nudgePerson(await at(ids.lead), { teamId: ids.giftTeam, personId: ids.lead }),
    ).rejects.toThrow("You can't nudge yourself");
    await expect(
      nudgePerson(await at(ids.admin), { teamId: ids.giftTeam, personId: ids.lead }),
    ).rejects.toThrow("Nothing of theirs is late in this team");
    await expect(teamReminders(await at(ids.kitchen), ids.giftTeam)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
