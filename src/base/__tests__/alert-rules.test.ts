// Base alert rules as pure functions (docs/specs/b2-task-engine.md A1–A4, A7; PLAN.md §4.3).
import { describe, expect, it } from "vitest";
import {
  type AlertFact,
  DEFAULT_ALERT_PARAMS,
  evaluateTaskAlerts,
  parseAlertParams,
} from "@/base/engine/rules/alerts";

const NOW = new Date("2027-04-10T07:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const fact = (over: Partial<AlertFact> = {}): AlertFact => ({
  taskId: "t1",
  title: "Book forklift",
  status: "todo",
  kind: "task",
  isCritical: false,
  dueAt: days(2),
  ownerPersonId: "owner",
  teamId: "team",
  prerequisiteRisk: false,
  ...over,
});
const run = (f: AlertFact, now = NOW, params = DEFAULT_ALERT_PARAMS) =>
  evaluateTaskAlerts([f], now, params).map((a) => `${a.rule}:${a.level}:${a.to}`);

describe("due soon (A1)", () => {
  it("fires the 3-day reminder, then the 1-day one, to the owner", () => {
    expect(run(fact({ dueAt: days(2.5) }))).toEqual(["due_soon:0:owner"]);
    const three = evaluateTaskAlerts([fact({ dueAt: days(2.5) })], NOW, DEFAULT_ALERT_PARAMS)[0];
    const one = evaluateTaskAlerts([fact({ dueAt: days(0.5) })], NOW, DEFAULT_ALERT_PARAMS)[0];
    expect(three?.fingerprint).not.toEqual(one?.fingerprint);
    expect(one?.fingerprint).toContain(":1d");
  });

  it("skips kinds whose module sends its own due-soon reminders, but still flags overdue", () => {
    expect(run(fact({ dueAt: days(0.5), ownDueSoon: true }))).toEqual([]);
    expect(run(fact({ dueAt: days(-1), ownDueSoon: true }))).toEqual(["overdue:0:owner"]);
  });

  it("stays quiet more than 3 days out, without an owner, or once done", () => {
    expect(run(fact({ dueAt: days(4) }))).toEqual([]);
    expect(run(fact({ status: "done" }))).toEqual([]);
    expect(run(fact({ dueAt: null }))).toEqual([]);
  });
});

describe("overdue and escalation (A2)", () => {
  it("owner first, then team leads after 3 days, then camp leads after 7", () => {
    expect(run(fact({ dueAt: days(-0.5) }))).toEqual(["overdue:0:owner"]);
    expect(run(fact({ dueAt: days(-3.5) }))).toEqual(["overdue:0:owner", "overdue:1:team_leads"]);
    expect(run(fact({ dueAt: days(-8) }))).toEqual([
      "overdue:0:owner",
      "overdue:1:team_leads",
      "overdue:2:camp_leads",
    ]);
  });

  it("milestones and critical tasks go straight to the camp leads too", () => {
    expect(run(fact({ dueAt: days(-0.5), kind: "milestone" }))).toEqual([
      "overdue:0:owner",
      "overdue:2:camp_leads",
    ]);
    expect(run(fact({ dueAt: days(-0.5), isCritical: true }))).toContain("overdue:2:camp_leads");
  });

  it("the fingerprint is the due date, so moving it gives a fresh alert (A5)", () => {
    const a = evaluateTaskAlerts([fact({ dueAt: days(-1) })], NOW, DEFAULT_ALERT_PARAMS)[0];
    const b = evaluateTaskAlerts([fact({ dueAt: days(-2) })], NOW, DEFAULT_ALERT_PARAMS)[0];
    expect(a?.fingerprint).toBe(days(-1).toISOString());
    expect(a?.fingerprint).not.toBe(b?.fingerprint);
  });

  it("an unowned overdue task skips the owner level (the unowned rule covers it)", () => {
    expect(run(fact({ dueAt: days(-1), ownerPersonId: null }))).toEqual([
      "unowned:1:team_leads",
      "unowned:2:camp_leads",
    ]);
  });
});

describe("unowned (A3) and dependency risk (A4)", () => {
  it("unowned and due within 14 days → team leads; within 7 → camp leads too", () => {
    expect(run(fact({ ownerPersonId: null, dueAt: days(10) }))).toEqual(["unowned:1:team_leads"]);
    expect(run(fact({ ownerPersonId: null, dueAt: days(6) }))).toEqual([
      "unowned:1:team_leads",
      "unowned:2:camp_leads",
    ]);
    expect(run(fact({ ownerPersonId: null, dueAt: days(20) }))).toEqual([]);
  });

  it("a late or blocked prerequisite warns the owner and the team leads", () => {
    expect(run(fact({ dueAt: days(10), prerequisiteRisk: true }))).toEqual([
      "dependency_risk:0:owner",
      "dependency_risk:1:team_leads",
    ]);
    expect(run(fact({ dueAt: days(20), prerequisiteRisk: true }))).toEqual([]);
  });
});

const EMPTY = {
  remindDaysBefore: null,
  remindAgainDaysBefore: null,
  escalateLeadAfterDays: null,
  escalateCampAfterDays: null,
  withinDays: null,
  escalateWithinDays: null,
};

describe("params (A7)", () => {
  it("a disabled rule fires nothing; custom thresholds are used", () => {
    const params = parseAlertParams([
      { ...EMPTY, key: "overdue", enabled: false },
      { ...EMPTY, key: "due_soon", enabled: true, remindDaysBefore: 5 },
    ]);
    expect(run(fact({ dueAt: days(-1) }), NOW, params)).toEqual([]);
    expect(run(fact({ dueAt: days(4.5) }), NOW, params)).toEqual(["due_soon:0:owner"]);
  });

  it("empty thresholds fall back to the defaults; set ones replace only themselves", () => {
    const params = parseAlertParams([
      { ...EMPTY, key: "overdue", enabled: true },
      { ...EMPTY, key: "unowned", enabled: true, escalateWithinDays: 3 },
    ]);
    expect(params.overdue).toEqual(DEFAULT_ALERT_PARAMS.overdue);
    expect(params.unowned).toEqual({ enabled: true, within_days: 14, escalate_within_days: 3 });
  });

  it("titles carry only safe task fields", () => {
    const [a] = evaluateTaskAlerts([fact({ dueAt: days(-1) })], NOW, DEFAULT_ALERT_PARAMS);
    expect(a?.title).toBe("Overdue: Book forklift");
    expect(a?.href).toBe("/tasks/t1");
  });
});
