// Task kinds that escalate overdue straight to the camp lead (docs/specs/obligations.md §3).
import { describe, expect, it } from "vitest";
import {
  type AlertFact,
  DEFAULT_ALERT_PARAMS,
  evaluateTaskAlerts,
} from "@/base/engine/rules/alerts";

const NOW = new Date("2027-04-10T07:00:00Z");
const fact = (over: Partial<AlertFact> = {}): AlertFact => ({
  taskId: "t1",
  title: "MV registration",
  status: "todo",
  kind: "obligations.obligation",
  isCritical: false,
  dueAt: new Date(NOW.getTime() - 0.5 * 86_400_000),
  ownerPersonId: "owner",
  teamId: "team",
  prerequisiteRisk: false,
  ...over,
});
const run = (f: AlertFact) =>
  evaluateTaskAlerts([f], NOW, DEFAULT_ALERT_PARAMS).map((a) => `${a.rule}:${a.level}:${a.to}`);

describe("immediate escalation kinds", () => {
  it("sends a day-1 overdue obligation to the owner and the camp lead", () => {
    expect(run(fact({ escalateImmediately: true }))).toEqual([
      "overdue:0:owner",
      "overdue:2:camp_leads",
    ]);
  });

  it("leaves ordinary kinds on the 3/7-day ladder", () => {
    expect(run(fact({ escalateImmediately: false }))).toEqual(["overdue:0:owner"]);
    expect(run(fact())).toEqual(["overdue:0:owner"]);
  });

  it("does nothing before the due date or once done", () => {
    const future = new Date(NOW.getTime() + 5 * 86_400_000);
    expect(run(fact({ escalateImmediately: true, dueAt: future }))).toEqual([]);
    expect(run(fact({ escalateImmediately: true, status: "done" }))).toEqual([]);
  });
});
