// Applicant automations, rules 1–3 (automation plan).
import { describe, expect, it } from "vitest";
import {
  type ApplicantFact,
  applicantAutomations,
  missingRequirements,
} from "../rules/automations";
import { DOC_KEYS } from "../rules/journey";

const NOW = new Date("2027-03-01T08:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const app = (over: Partial<ApplicantFact> = {}): ApplicantFact => ({
  id: "a1",
  personId: "p1",
  name: "Sam",
  status: "accepted",
  submittedAt: ago(30),
  decidedAt: ago(0),
  interviewDoneAt: ago(1),
  feeCents: 150_000,
  paidAt: null,
  docsDone: DOC_KEYS,
  ...over,
});
const run = (a: ApplicantFact, reviewers = ["lead", "p1"]) =>
  applicantAutomations([a], NOW, reviewers);
const stages = (a: ApplicantFact) => run(a).reminders.map((r) => `${r.rule}:${r.stage}`);

describe("rule 1: fee unpaid", () => {
  it("reminds the day after it's due, then tells the camp lead a week later", () => {
    expect(stages(app({ decidedAt: ago(0) }))).toEqual([]);
    expect(stages(app({ decidedAt: ago(1) }))).toEqual(["applicants.fee_unpaid:d1"]);
    expect(stages(app({ decidedAt: ago(5) }))).toEqual(["applicants.fee_unpaid:d1"]);
    expect(run(app({ decidedAt: ago(7) })).handovers).toEqual([]);
    expect(run(app({ decidedAt: ago(8) })).handovers).toEqual([
      expect.objectContaining({
        what: "Camp fee still unpaid after 8 days",
        about: "Sam",
        to: { role: "camp_lead" },
      }),
    ]);
  });
  it("tells the member's own team lead when they have a team", () => {
    expect(run(app({ decidedAt: ago(8), teamId: "t1" })).handovers).toEqual([
      expect.objectContaining({ to: { teamId: "t1" } }),
    ]);
  });
  it("stops once paid, and never before a fee exists", () => {
    expect(run(app({ decidedAt: ago(20), paidAt: ago(1) }))).toEqual({
      reminders: [],
      handovers: [],
    });
    expect(run(app({ decidedAt: ago(20), feeCents: null }))).toEqual({
      reminders: [],
      handovers: [],
    });
  });
});

describe("rule 2: requirement missing", () => {
  it("lists exactly what's missing, weekly, then hands over after 3 weeks", () => {
    const a = app({ paidAt: ago(1), interviewDoneAt: null, docsDone: [], decidedAt: ago(8) });
    expect(missingRequirements(a)[0]).toBe("Interview");
    const [r] = run(a).reminders;
    expect(r?.title).toMatch(/^Still needed to join: Interview, Camp agreement/);
    expect(r?.stage).toBe("d7");
    expect(run({ ...a, decidedAt: ago(22) }).handovers[0]).toMatchObject({
      what: "Stuck on Interview for 3 weeks",
    });
  });
});

describe("rule 3: application not reviewed", () => {
  it("nudges the reviewers (never the applicant) at 5 days; camp lead at 10", () => {
    const a = app({ status: "applied", submittedAt: ago(5), decidedAt: null });
    expect(run(a).reminders.map((r) => r.personId)).toEqual(["lead"]);
    expect(run(a).handovers).toEqual([]);
    expect(run({ ...a, submittedAt: ago(4) }).reminders).toEqual([]);
    expect(run({ ...a, submittedAt: ago(10) }).handovers[0]).toMatchObject({
      what: "Application not reviewed in 10 days",
      to: { role: "camp_lead" },
    });
  });
  it("drafts and declined applications get nothing", () => {
    expect(run(app({ status: "declined", decidedAt: ago(20) }))).toEqual({
      reminders: [],
      handovers: [],
    });
    expect(run(app({ status: "applied", submittedAt: null }))).toEqual({
      reminders: [],
      handovers: [],
    });
  });
});

describe("rule 1: fee timing from the camp settings", () => {
  it("uses the chosen reminder and lead days", () => {
    const timed = (d: number) =>
      applicantAutomations([app({ decidedAt: ago(d) })], NOW, [], { reminderDays: 3, leadDays: 4 });
    expect(timed(2).reminders).toEqual([]);
    expect(timed(3).reminders.map((r) => r.stage)).toEqual(["d3"]);
    expect(timed(6).handovers).toEqual([]);
    expect(timed(7).handovers).toEqual([
      expect.objectContaining({ why: "Reminded 4 days ago. It might be worth a quick chat" }),
    ]);
  });
});
