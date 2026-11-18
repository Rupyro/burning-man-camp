// "Ask the camp" demo router: the test set score, dates and buy-list parsing.
import { describe, expect, it } from "vitest";
import { parseBuy, parseDueDate, routeDemo } from "../rules/ask-demo";
import { ASK_TEST_SET } from "./ask-test-set";

const TEAMS = [
  "camp_infra",
  "gift_projects",
  "logistics",
  "finance",
  "kitchen",
  "programming",
  "community",
  "duties",
  "moop",
  "marketing",
  "content",
  "knowledge",
].map((key) => ({ key, name: key }));
const TODAY = "2026-04-09"; // a Thursday

describe("ask the camp: demo router test set", () => {
  const results = ASK_TEST_SET.map((s) => ({
    ...s,
    got: routeDemo({ text: s.text, today: TODAY, teams: TEAMS }),
  }));
  const right = results.filter((r) => r.got.teamKey === r.team);
  const accuracy = right.length / results.length;

  it("has about 20 requests", () => {
    expect(results.length).toBeGreaterThanOrEqual(20);
  });
  it("sends at least 90% of the test set to the right team", () => {
    console.log(
      `Ask the camp demo router: ${right.length}/${results.length} right (${Math.round(accuracy * 100)}%)`,
    );
    for (const r of results.filter((x) => x.got.teamKey !== x.team))
      console.log(`  wrong: "${r.text}" -> ${r.got.teamKey} (should be ${r.team})`);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
  it("is always labelled as the demo router", () => {
    expect(results.every((r) => r.got.router === "demo")).toBe(true);
  });
});

describe("ask the camp: the design example", () => {
  it("files 'need 20 kg of ice by Tuesday' for kitchen, due Tuesday 14 April, on the buy list", () => {
    const r = routeDemo({ text: "need 20 kg of ice by Tuesday", today: TODAY, teams: TEAMS });
    expect(r).toMatchObject({
      teamKey: "kitchen",
      title: "Buy 20 kg ice",
      dueOn: "2026-04-14",
      buy: { item: "ice", quantity: 20, unit: "kg" },
      guessed: false,
    });
  });
  it("falls back to the first team and says it guessed when no word matches", () => {
    const r = routeDemo({ text: "hmm what about the thing", today: TODAY, teams: TEAMS });
    expect(r.guessed).toBe(true);
    expect(r.teamKey).toBe("camp_infra");
    expect(r.title).toBe("Hmm what about the thing");
  });
  it("only picks from the teams it was given", () => {
    const r = routeDemo({ text: "need ice", today: TODAY, teams: [{ key: "duties", name: "D" }] });
    expect(r.teamKey).toBe("duties");
  });
});

describe("ask the camp: dates", () => {
  it.each([
    ["by Tuesday", "2026-04-14"],
    ["by Thursday", "2026-04-16"],
    ["today", "2026-04-09"],
    ["tomorrow", "2026-04-10"],
    ["in 3 days", "2026-04-12"],
    ["next week", "2026-04-16"],
    ["by 14 April", "2026-04-14"],
    ["on April 20", "2026-04-20"],
    ["by 2 March", "2027-03-02"],
    ["on 2026-05-01", "2026-05-01"],
    ["sometime", null],
  ])("%s -> %s", (text, want) => {
    expect(parseDueDate(text, TODAY)).toBe(want);
  });
});

describe("ask the camp: buy list", () => {
  it.each([
    ["need 20 kg of ice by Tuesday", { item: "ice", quantity: 20, unit: "kg" }],
    ["buy 2,5 l of milk", { item: "milk", quantity: 2.5, unit: "l" }],
    ["30 x cable ties", { item: "cable ties", quantity: 30, unit: null }],
    ["need more spices for Friday", { item: "spices", quantity: null, unit: null }],
    ["fix the generator", null],
    ["need", null],
  ])("%s", (text, want) => {
    expect(parseBuy(text)).toEqual(want);
  });
});

describe("ask the camp: more date and title shapes", () => {
  it.each([
    ["on Jan 40", null],
    ["tonight", "2026-04-09"],
    ["by 9 April", "2026-04-09"],
    ["by 8 April", "2027-04-08"],
  ])("%s -> %s", (text, want) => {
    expect(parseDueDate(text, TODAY)).toBe(want);
  });
  it("keeps long titles short and handles an empty team list", () => {
    const r = routeDemo({ text: "x".repeat(300), today: TODAY, teams: [] });
    expect(r.title).toHaveLength(200);
    expect(r.teamKey).toBe("");
    expect(r.guessed).toBe(true);
  });
  it("a plural team word still counts", () => {
    expect(routeDemo({ text: "two trucks please", today: TODAY, teams: TEAMS }).teamKey).toBe(
      "logistics",
    );
  });
});
