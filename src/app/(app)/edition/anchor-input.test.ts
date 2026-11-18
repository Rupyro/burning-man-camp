// Reading the key-date and capacity forms (spec b1-12 E3–E5), without a browser.
import { describe, expect, it } from "vitest";
import { anchorFormInitial, capacityLine, readAnchorForm, readEditionForm } from "./anchor-input";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("readAnchorForm", () => {
  it("turns camp-time fields into the action's input", () => {
    const r = readAnchorForm(
      form({
        key: "build_start",
        label: " Build ",
        startDate: "2027-04-21",
        startTime: "08:00",
        endDate: "2027-04-25",
        endTime: "18:00",
        isConfirmed: "on",
        sourceNote: "camp draft",
      }),
    );
    expect(r).toEqual({
      ok: true,
      input: {
        key: "build_start",
        label: "Build",
        startsAt: "2027-04-21T06:00:00.000Z",
        endsAt: "2027-04-25T16:00:00.000Z",
        isConfirmed: true,
        sourceNote: "camp draft",
      },
    });
  });

  it("an edit keeps its key, and blank optional fields become null / TBC", () => {
    const r = readAnchorForm(
      form({ key: "other", label: "Gate", startDate: "2027-04-26" }),
      "gate_open",
    );
    expect(r).toEqual({
      ok: true,
      input: {
        key: "gate_open",
        label: "Gate",
        startsAt: "2027-04-25T22:00:00.000Z",
        endsAt: null,
        isConfirmed: false,
        sourceNote: null,
      },
    });
  });

  it("a malformed date is a readable error, not a crash", () => {
    expect(readAnchorForm(form({ key: "x1", label: "X", startDate: "26/04/2027" }))).toEqual({
      ok: false,
      error: "Use a date like 2027-04-21 and a time like 08:00",
    });
  });
});

describe("edition form and summary", () => {
  it("reads title and capacity", () => {
    expect(readEditionForm(form({ title: " AfrikaBurn 2027 ", capacity: "64" }))).toEqual({
      title: "AfrikaBurn 2027",
      memberCapacity: 64,
    });
  });

  it("says how full the camp is", () => {
    expect(capacityLine(12, 70)).toBe("12 confirmed of 70.");
    expect(capacityLine(80, 70)).toBe("80 confirmed of 70: over capacity.");
    expect(capacityLine(3, null)).toBe("3 confirmed (no capacity set).");
  });

  it("prefills an edit form in camp time", () => {
    expect(
      anchorFormInitial({
        key: "build_start",
        label: "Build",
        startsAt: new Date("2027-04-21T06:00:00Z"),
        endsAt: null,
        isConfirmed: true,
        sourceNote: null,
      }),
    ).toEqual({
      key: "build_start",
      label: "Build",
      start: { date: "2027-04-21", time: "08:00" },
      end: null,
      isConfirmed: true,
      sourceNote: "",
    });
  });
});
