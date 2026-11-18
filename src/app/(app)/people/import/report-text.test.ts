// Import screen text and duplicate choices (spec I2, I5).
import { describe, expect, it } from "vitest";
import type { ImportReport, ReportRow } from "@/base/people/import/import";
import {
  choices,
  countsLine,
  needsChoice,
  readChoice,
  resultMessage,
  rowSummary,
  rowsToShow,
} from "./report-text";

const row = (over: Partial<ReportRow>): ReportRow => ({
  line: 2,
  email: "a@example.test",
  displayName: "Alex Example",
  action: "create",
  changes: [],
  issues: [],
  ...over,
});
const report = (rows: ReportRow[]): ImportReport => ({
  headers: ["Email"],
  mapping: ["email"],
  rows,
  counts: { create: 1, update: 0, unchanged: 1, duplicate: 0, error: 0 },
  warnings: [],
});

describe("import screen text", () => {
  it("summarises a row with its changes and issues", () => {
    expect(rowSummary(row({}))).toBe("Line 2: create Alex Example a@example.test");
    expect(rowSummary(row({ action: "update", changes: ["phone", "diet"] }))).toBe(
      "Line 2: update Alex Example a@example.test (changes phone, diet)",
    );
    expect(
      rowSummary(
        row({ action: "error", email: null, displayName: null, issues: ["invalid email"] }),
      ),
    ).toBe("Line 2: error — invalid email");
  });

  it("hides unchanged rows and counts everything", () => {
    const r = report([row({}), row({ line: 3, action: "unchanged" })]);
    expect(rowsToShow(r).map((x) => x.line)).toEqual([2]);
    expect(countsLine(r.counts)).toBe("1 create · 0 update · 1 unchanged · 0 duplicate · 0 error");
  });

  it("asks for a decision on duplicates, offering each candidate", () => {
    const dup = row({
      action: "duplicate",
      candidates: [{ personId: "p1", displayName: "Alex Example", email: "alex@example.test" }],
    });
    expect(needsChoice(dup, {})).toBe(true);
    expect(needsChoice(row({}), {})).toBe(false);
    expect(needsChoice(row({}), { 2: "create" })).toBe(true);
    const opts = choices(dup);
    expect(opts.map((o) => o.label)).toEqual([
      "Skip this row",
      "Create a new person",
      "Same person as Alex Example (alex@example.test)",
    ]);
    expect(opts.map((o) => readChoice(o.value))).toEqual(["skip", "create", { link: "p1" }]);
    expect(choices(row({ action: "duplicate" }))).toHaveLength(2);
  });

  it("(deny) an unexpected choice value falls back to skip", () => {
    expect(readChoice(JSON.stringify("merge"))).toBe("skip");
    expect(readChoice(JSON.stringify({ link: 5 }))).toBe("skip");
    expect(readChoice("null")).toBe("skip");
  });

  it("says whether anything was saved", () => {
    expect(resultMessage(report([]))).toBe("Dry run only. Nothing has been saved yet.");
    expect(resultMessage({ ...report([]), applied: { created: 1, updated: 2, skipped: 3 } })).toBe(
      "Applied: 1 created, 2 updated, 3 skipped.",
    );
  });
});
