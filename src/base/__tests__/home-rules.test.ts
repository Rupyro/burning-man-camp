import { describe, expect, it } from "vitest";
import { countdown, daysUntil, dueChip, readinessPercent } from "@/base/landing/home-rules";

// 10 Apr 2027, 00:00 camp time (PT)
const NOW = new Date("2027-04-10T07:00:00Z");

describe("home: countdown (spec B3 §3.3)", () => {
  it("counts whole camp-time days, and a past date shows 0", () => {
    expect(daysUntil(new Date("2027-04-21T15:00:00Z"), NOW)).toBe(11);
    // 23:30 camp time on the 10th is still today
    expect(daysUntil(new Date("2027-04-11T06:30:00Z"), NOW)).toBe(0);
    // 00:30 camp time on the 11th is tomorrow, though under 24 hours away
    expect(daysUntil(new Date("2027-04-11T07:30:00Z"), NOW)).toBe(1);
    expect(daysUntil(new Date("2027-04-01T15:00:00Z"), NOW)).toBe(0);
  });

  it("uses build_start and event_start; a missing date hides its half", () => {
    const anchors = [
      { key: "container_day", startsAt: new Date("2027-04-17T15:00:00Z") },
      { key: "build_start", startsAt: new Date("2027-04-21T15:00:00Z") },
      { key: "event_start", startsAt: new Date("2027-04-26T19:00:00Z") },
    ];
    expect(countdown(anchors, NOW)).toEqual({
      build: { days: 11, at: anchors[1]?.startsAt },
      gates: { days: 16, at: anchors[2]?.startsAt },
    });
    expect(countdown(anchors.slice(0, 2), NOW).gates).toBeNull();
    expect(countdown([], NOW)).toEqual({ build: null, gates: null });
  });
});

describe("home: due chips", () => {
  it("late, due this week by weekday, later by date, none without a date", () => {
    expect(dueChip(new Date("2027-04-08T07:00:00Z"), NOW)).toEqual({
      label: "2 days late",
      tone: "late",
    });
    expect(dueChip(new Date("2027-04-09T20:00:00Z"), NOW)).toEqual({
      label: "1 day late",
      tone: "late",
    });
    expect(dueChip(new Date("2027-04-10T15:00:00Z"), NOW)).toEqual({
      label: "Due today",
      tone: "soon",
    });
    expect(dueChip(new Date("2027-04-14T07:00:00Z"), NOW)).toEqual({
      label: "Due Wed",
      tone: "soon",
    });
    expect(dueChip(new Date("2027-05-03T07:00:00Z"), NOW)).toEqual({
      label: "Due 3 May",
      tone: "normal",
    });
    expect(dueChip(null, NOW)).toBeNull();
  });
});

describe("home: readiness", () => {
  it("is done over live tasks, rounded; an empty project is 0", () => {
    expect(readinessPercent(5, 8)).toBe(63);
    expect(readinessPercent(0, 0)).toBe(0);
    expect(readinessPercent(3, 3)).toBe(100);
  });
});
