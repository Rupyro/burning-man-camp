// docs/specs/applicants.md §2–3: tracker, to-do, joining and lead moves; the placeholder form.
import { describe, expect, it } from "vitest";
import { FORM_FIELDS, validateAnswers } from "../rules/form";
import {
  checkLeadMove,
  DOC_KEYS,
  formatRand,
  type JourneyFacts,
  label,
  leadMoves,
  missingForJoin,
  readyToJoin,
  todoList,
  trackerSteps,
} from "../rules/journey";

const at = new Date("2027-01-20T16:30:00Z");
const facts = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({
  status: "applied",
  submittedAt: at,
  interviewAt: null,
  interviewDoneAt: null,
  feeCents: null,
  paidAt: null,
  docsDone: [],
  ...over,
});
const states = (f: JourneyFacts | null) => trackerSteps(f).map((s) => s.state);

describe("tracker", () => {
  it("no application or a draft: Not applied is current", () => {
    expect(states(null)).toEqual(["current", "todo", "todo", "todo", "todo"]);
    expect(states(facts({ status: "draft", submittedAt: null }))).toEqual(states(null));
    expect(trackerSteps(null).map((s) => s.label)).toEqual([
      "Not applied",
      "Applied",
      "Interview",
      "Accepted",
      "Joined",
    ]);
  });
  it("walks Applied → Interview (with its date) → Accepted → Joined", () => {
    expect(states(facts())).toEqual(["done", "current", "todo", "todo", "todo"]);
    const booked = trackerSteps(facts({ status: "interview_scheduled", interviewAt: at }));
    expect(booked.map((s) => s.state)).toEqual(["done", "done", "current", "todo", "todo"]);
    expect(booked[2]?.at).toEqual(at);
    expect(states(facts({ status: "accepted" }))).toEqual([
      "done",
      "done",
      "done",
      "current",
      "todo",
    ]);
    expect(states(facts({ status: "joined" }))).toEqual(["done", "done", "done", "done", "done"]);
  });
  it("declined stops after Applied", () => {
    expect(states(facts({ status: "declined" }))).toEqual([
      "done",
      "stopped",
      "todo",
      "todo",
      "todo",
    ]);
  });
});

describe("to-do list", () => {
  it("lists the form, the interview, every document and the fee", () => {
    const t = todoList(null, formatRand);
    expect(t.map((x) => x.key)).toEqual([
      "form",
      "interview",
      ...DOC_KEYS.map((k) => `doc:${k}`),
      "fee",
    ]);
    expect(t.every((x) => !x.done)).toBe(true);
    expect(t.find((x) => x.key === "fee")?.hint).toBe("Due once you're accepted.");
    expect(t.find((x) => x.key === "interview")?.hint).toMatch(/book it with you/);
  });
  it("ticks what's done and shows the fee amount once Finance set it", () => {
    const t = todoList(
      facts({
        status: "accepted",
        interviewAt: at,
        interviewDoneAt: at,
        feeCents: 350_000,
        docsDone: ["principles"],
      }),
      formatRand,
    );
    expect(t.find((x) => x.key === "form")).toMatchObject({
      done: true,
      label: "Application sent",
    });
    expect(t.find((x) => x.key === "interview")?.done).toBe(true);
    expect(t.find((x) => x.key === "doc:principles")?.done).toBe(true);
    expect(t.find((x) => x.key === "doc:camp_agreement")?.done).toBe(false);
    expect(t.find((x) => x.key === "fee")).toMatchObject({
      label: "Pay the camp fee ($3,500)",
      done: false,
    });
    expect(t.find((x) => x.key === "fee")?.hint).toMatch(/Demo: no real money/);
    expect(todoList(facts({ interviewAt: at }), formatRand)[1]?.hint).toMatch(/Booked/);
    const paid = todoList(facts({ feeCents: 350_000, paidAt: at }), formatRand);
    expect(paid.find((x) => x.key === "fee")).toMatchObject({ done: true, hint: undefined });
  });
});

describe("joining (paid + every requirement, including the interview)", () => {
  const all = facts({
    status: "accepted",
    interviewDoneAt: at,
    feeCents: 350_000,
    paidAt: at,
    docsDone: [...DOC_KEYS],
  });
  it("ready only when accepted with everything done", () => {
    expect(missingForJoin(all)).toEqual([]);
    expect(readyToJoin(all)).toBe(true);
  });
  it("each missing piece blocks it", () => {
    expect(missingForJoin({ ...all, paidAt: null })).toEqual(["Camp fee"]);
    expect(missingForJoin({ ...all, docsDone: ["principles"] })).toEqual([
      "Camp agreement (placeholder)",
      "Burning Man ticket plan",
    ]);
    expect(missingForJoin({ ...all, interviewDoneAt: null })).toEqual(["Interview and acceptance"]);
    expect(missingForJoin({ ...all, submittedAt: null })).toEqual(["Application form"]);
    expect(readyToJoin({ ...all, paidAt: null })).toBe(false);
  });
  it("not before acceptance, and never twice", () => {
    expect(readyToJoin({ ...all, status: "interview_scheduled" })).toBe(false);
    expect(missingForJoin({ ...all, status: "interview_scheduled" })).toContain(
      "Interview and acceptance",
    );
    expect(readyToJoin({ ...all, status: "joined" })).toBe(false);
    expect(missingForJoin({ ...all, status: "joined" })).toEqual([]);
  });
});

describe("lead moves", () => {
  it("follow the table in spec §2", () => {
    expect(leadMoves("applied")).toEqual(["interview_scheduled", "declined"]);
    expect(leadMoves("interview_scheduled")).toEqual([
      "interview_scheduled",
      "accepted",
      "declined",
    ]);
    expect(leadMoves("accepted")).toEqual(["declined"]);
    expect(leadMoves("declined")).toEqual(["applied"]);
    expect(leadMoves("draft")).toEqual([]);
    expect(leadMoves("joined")).toEqual([]);
  });
  it("an interview needs a date; illegal moves say why", () => {
    expect(checkLeadMove("applied", "interview_scheduled", at)).toBeNull();
    expect(checkLeadMove("applied", "interview_scheduled", null)).toBe(
      "Pick the interview date and time",
    );
    expect(checkLeadMove("applied", "accepted", at)).toBe(
      "Can't move an application from Applied to Accepted",
    );
    expect(checkLeadMove("joined", "declined", null)).toMatch(/from Joined/);
    expect(checkLeadMove("draft", "applied", null)).toMatch(/from Not applied/);
    expect(checkLeadMove("interview_scheduled", "accepted", null)).toBeNull();
  });
  it("labels every status", () => {
    expect(label("interview_scheduled")).toBe("Interview scheduled");
    expect(label("declined")).toBe("Declined");
  });
});

describe("placeholder form", () => {
  const good = {
    country: " South Africa ",
    burns: "First burn",
    why: "Friends told me about you.",
    contribute: "Kitchen",
    build_strike: "Both",
    extra: "dropped",
  };
  it("a draft may be partly empty; sending needs every required answer", () => {
    expect(validateAnswers({ why: "Because" }, false)).toEqual({
      answers: { why: "Because" },
      errors: {},
    });
    const sent = validateAnswers({ why: "Because" }, true);
    expect(Object.keys(sent.errors).sort()).toEqual([
      "build_strike",
      "burns",
      "contribute",
      "country",
    ]);
    expect(sent.errors.country).toBe("Please answer this one");
  });
  it("trims, drops unknown keys and checks choices and lengths", () => {
    const r = validateAnswers(good, true);
    expect(r.errors).toEqual({});
    expect(r.answers.country).toBe("South Africa");
    expect(r.answers.extra).toBeUndefined();
    expect(validateAnswers({ ...good, burns: "Loads" }, true).errors.burns).toBe(
      "Pick one of the options",
    );
    expect(validateAnswers({ ...good, why: "x".repeat(1501) }, true).errors.why).toBe(
      "Keep it under 1500 characters",
    );
    expect(validateAnswers({ country: 7 }, false).answers).toEqual({});
  });
  it("is clearly a placeholder with the questions the spec lists", () => {
    expect(FORM_FIELDS.filter((f) => f.required).map((f) => f.key)).toEqual([
      "country",
      "burns",
      "why",
      "contribute",
      "build_strike",
    ]);
  });
  it("formats integer cents as dollars", () => {
    expect(formatRand(350_000)).toBe("$3,500");
    expect(formatRand(432_050)).toBe("$4,320.50");
    expect(formatRand(-100)).toBe("−$1");
  });
});
