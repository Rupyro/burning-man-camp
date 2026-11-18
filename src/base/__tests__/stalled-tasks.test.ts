// Automatic rule 5: a task nobody has touched for N days goes back to the team lead.
import { describe, expect, it } from "vitest";
import { stalledTaskAlerts } from "@/base/engine/rules/alerts";

const now = new Date("2027-03-10T08:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const fact = (over: Partial<Parameters<typeof stalledTaskAlerts>[0][number]> = {}) => ({
  taskId: "t1",
  title: "Fix the dome door hinges",
  status: "todo" as const,
  ownerPersonId: "marco",
  ownerName: "Marco",
  teamId: "build",
  touchedAt: daysAgo(8),
  ...over,
});

describe("quiet tasks go back to the lead", () => {
  it("after a week untouched, the team's leads get it once per quiet spell", () => {
    const [a, ...rest] = stalledTaskAlerts([fact()], now, 7);
    expect(rest).toEqual([]);
    expect(a).toMatchObject({
      rule: "stalled",
      taskId: "t1",
      level: 1,
      to: "team_leads",
      fingerprint: daysAgo(8).toISOString(),
      href: "/tasks/t1",
    });
    expect(a?.title).toBe(`"Fix the dome door hinges" hasn't moved in 8 days (Marco has it)`);
  });

  it("not before the quiet days, not for unowned, blocked or finished tasks", () => {
    expect(stalledTaskAlerts([fact({ touchedAt: daysAgo(6) })], now, 7)).toEqual([]);
    expect(stalledTaskAlerts([fact({ ownerPersonId: null, ownerName: null })], now, 7)).toEqual([]);
    expect(stalledTaskAlerts([fact({ status: "blocked" })], now, 7)).toEqual([]);
    expect(stalledTaskAlerts([fact({ status: "done" })], now, 7)).toEqual([]);
  });
});

describe("quiet tasks and the overdue rule", () => {
  it("an overdue task is left to the overdue rule, so the lead isn't told twice", () => {
    expect(stalledTaskAlerts([fact({ dueAt: daysAgo(1) })], now, 7)).toEqual([]);
    expect(
      stalledTaskAlerts([fact({ dueAt: new Date(now.getTime() + 86_400_000) })], now, 7),
    ).toHaveLength(1);
  });
});
