import { describe, expect, it } from "vitest";
import { clashes, toCsv } from "../rules/schedule";

const at = (h: number) => new Date(Date.UTC(2027, 8, 1, h));

describe("schedule rules", () => {
  it("finds overlapping events, not ones that touch", () => {
    expect(
      clashes([
        { id: "a", title: "A", startsAt: at(10), endsAt: at(12) },
        { id: "b", title: "B", startsAt: at(11), endsAt: at(13) },
        { id: "c", title: "C", startsAt: at(13), endsAt: at(14) },
      ]),
    ).toEqual([["a", "b"]]);
  });
  it("writes CSV with quoting", () => {
    const csv = toCsv([
      {
        title: 'Yoga, "gentle"',
        description: "Bring water",
        category: "care",
        date: "2027-08-31",
        start: "07:00",
        end: "08:00",
        location: "At camp",
      },
    ]);
    expect(csv.split("\n")).toEqual([
      "Title,Description,Category,Date,Start,End,Location",
      '"Yoga, ""gentle""",Bring water,Care or healing,2027-08-31,07:00,08:00,At camp',
    ]);
  });
});
