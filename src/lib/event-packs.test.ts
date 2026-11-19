// Event packs (Phase 1) and the year calendar built from them (Phase 2).
import { describe, expect, it } from "vitest";
import { EVENT_PACKS } from "../../camp-events";
import bass from "../../camp-presets/bass-canyon.config";
import lantern from "../../camp-presets/lantern-crew.config";
import { campConfigProblems } from "./camp-config";
import { calendarInOrder, upcomingEntries } from "./event-packs";
import { byMonth, calendarForCamp, dayInstant, monthLabel, withStates } from "./year-calendar";

const bm = EVENT_PACKS["burning-man"];

describe("Burning Man 2027 event pack", () => {
  it("has the official event dates and Pacific time", () => {
    expect(bm.event).toMatchObject({ start: "2027-08-29", end: "2027-09-06", status: "official" });
    expect(bm.timezone).toBe("America/Los_Angeles");
    expect(bm.currency).toBe("USD");
  });
  it("every calendar entry and rule has a source, and keys are unique", () => {
    const keys = bm.calendar.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of bm.calendar) expect(c.source).toMatch(/^https:\/\//);
    for (const r of bm.rules) expect(r.source).toMatch(/^https:\/\//);
  });
  it("sorts the calendar by date and lists what's still ahead", () => {
    const dates = calendarInOrder(bm).map((c) => c.date);
    expect(dates).toEqual([...dates].sort());
    const ahead = upcomingEntries(bm, "2027-08-30");
    expect((ahead[0]?.until ?? ahead[0]?.date ?? "") >= "2027-08-30").toBe(true);
    expect(ahead.map((c) => c.key)).not.toContain("soi_due");
  });
});

describe("year calendar", () => {
  it("open camping skips the Placement-only steps", () => {
    const all = calendarForCamp(bm, "theme");
    const open = calendarForCamp(bm, "open");
    expect(open.length).toBeLessThan(all.length);
    expect(open.some((c) => c.placedOnly)).toBe(false);
    expect(calendarForCamp(bm).length).toBe(all.length);
  });
  it("marks past, on now, next and later, and groups by month", () => {
    const entries = [
      { key: "a", label: "A", detail: "", date: "2027-01-10", status: "official", source: "x" },
      {
        key: "b",
        label: "B",
        detail: "",
        date: "2027-01-20",
        until: "2027-02-05",
        status: "official",
        source: "x",
      },
      { key: "c", label: "C", detail: "", date: "2027-02-10", status: "pattern", source: "x" },
      { key: "d", label: "D", detail: "", date: "2027-03-01", status: "pattern", source: "x" },
    ] as const;
    const s = withStates(entries, "2027-02-01");
    expect(s.map((e) => e.state)).toEqual(["past", "now", "next", "later"]);
    expect(byMonth(s).map((m) => [m.key, m.entries.length])).toEqual([
      ["2027-01", 2],
      ["2027-02", 1],
      ["2027-03", 1],
    ]);
    expect(monthLabel("2027-02")).toBe("February 2027");
    expect(dayInstant("2027-08-29").toISOString()).toBe("2027-08-29T12:00:00.000Z");
  });
});

describe("test camps", () => {
  it("Lantern Crew and Bass Canyon are valid configs with their sizes", () => {
    expect(campConfigProblems(lantern)).toEqual([]);
    expect(campConfigProblems(bass)).toEqual([]);
    expect([lantern.camp.size, bass.camp.size]).toEqual([20, 150]);
    expect([lantern.money.currency, bass.money.currency]).toEqual(["USD", "USD"]);
  });
  it("flags an unknown camp type", () => {
    const bad = { ...lantern, camp: { ...lantern.camp, type: "nope" as never } };
    expect(campConfigProblems(bad).length).toBeGreaterThan(0);
  });
});
