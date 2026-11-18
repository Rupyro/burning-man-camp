// Anti-spam rules for automations (automation plan, "Not spamming anyone").
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  handoverHeadline,
  handoverTitle,
  pickReminders,
  quietReason,
  thingKey,
} from "@/base/engine/rules/reminders";
import type { ReminderCandidate } from "@/contracts/automations";

const NOW = new Date("2027-03-01T08:00:00Z");
const c = (personId: string, entityId: string, priority = 1, title = "x"): ReminderCandidate => ({
  rule: "finance.receipt_missing",
  entityType: "finance.expense",
  entityId,
  personId,
  stage: "d3",
  priority,
  title,
  href: "/",
});

describe("quiet", () => {
  it("nothing from 21:00 until 07:00 camp time, or during the Burn", () => {
    expect(quietReason(6, NOW, null)).toBe("quiet_hours");
    expect(quietReason(21, NOW, null)).toBe("quiet_hours");
    expect(quietReason(7, NOW, null)).toBeNull();
    const burn = {
      startsAt: new Date("2027-02-28T00:00:00Z"),
      endsAt: new Date("2027-03-05T00:00:00Z"),
    };
    expect(quietReason(9, NOW, burn)).toBe("burn");
    expect(quietReason(9, NOW, { ...burn, endsAt: null })).toBe("burn");
    expect(
      quietReason(9, NOW, { startsAt: new Date("2027-04-26T00:00:00Z"), endsAt: null }),
    ).toBeNull();
  });
});

describe("the daily cron", () => {
  it("fires outside quiet hours (camp time is UTC+2, Hobby cron may run up to 59 min late)", () => {
    const { crons } = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const tick = crons.find((c) => c.path === "/api/jobs/tick");
    const [minute, utcHour] = (tick?.schedule ?? "").split(" ").map(Number);
    expect(minute).toBe(0);
    const campHour = ((utcHour ?? 0) + 2) % 24;
    expect(quietReason(campHour, NOW, null)).toBeNull();
    expect(campHour + 1).toBeLessThan(21);
  });
});

describe("pickReminders", () => {
  it("stops after 3 reminders about the same thing", () => {
    const before = new Map([[thingKey(c("p1", "e1")), 3]]);
    expect(pickReminders([c("p1", "e1"), c("p1", "e2")], before, new Map())).toEqual([
      c("p1", "e2"),
    ]);
  });

  it("at most 5 a day per person, most urgent first; one stage per thing per run", () => {
    const many = [6, 5, 4, 3, 2, 1, 0].map((p) => c("p1", `e${p}`, p));
    const picked = pickReminders(
      [...many, c("p1", "e0", 0, "dup")],
      new Map(),
      new Map([["p1", 1]]),
    );
    expect(picked.map((x) => x.priority)).toEqual([0, 1, 2, 3]);
    expect(pickReminders([c("p2", "e1")], new Map(), new Map([["p2", 5]]))).toEqual([]);
  });

  it("handovers read the same everywhere", () => {
    const h = { what: "Fee unpaid 15 days", about: "Sam", why: "3 reminders, not paid" };
    expect(handoverTitle(h)).toBe("Fee unpaid 15 days: Sam (3 reminders, not paid)");
    expect(handoverHeadline({ what: "Stuck" })).toBe("Stuck");
  });
});
