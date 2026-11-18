// docs/specs/logistics.md §3: load moves, gaps, ride matching, phone visibility, exports.
import { describe, expect, it } from "vitest";
import { arrivalsByDay, arrivalsCsv, csvField, type MemberRow, wapCsv } from "../rules/exports";
import {
  canMoveLoad,
  GAP_TEXT,
  gapReason,
  gaps,
  isLoadOpen,
  LOAD_STATUS_LABEL,
  LOAD_STATUSES,
  nextLoadMoves,
  qtyText,
} from "../rules/loads";
import {
  canSeePhone,
  DIRECTION_LABEL,
  daysApart,
  type Match,
  MODE_LABEL,
  offersFor,
  type Plan,
  seatsLeft,
} from "../rules/rides";

describe("loads", () => {
  it("writes quantities the way people say them", () => {
    expect(qtyText(2, "pcs")).toBe("× 2");
    expect(qtyText(2.5, "kg")).toBe("2.5 kg");
    expect(qtyText(1 / 3, "L")).toBe("0.33 L");
  });
  it("moves forward, can step back once, and ends at delivered or cancelled", () => {
    expect(canMoveLoad("planned", "packing")).toBe(true);
    expect(canMoveLoad("packing", "planned")).toBe(true);
    expect(canMoveLoad("in_transit", "delivered")).toBe(true);
    expect(canMoveLoad("planned", "delivered")).toBe(false);
    expect(canMoveLoad("delivered", "cancelled")).toBe(false);
    expect(nextLoadMoves("cancelled")).toEqual([]);
    expect(LOAD_STATUSES.filter(isLoadOpen)).toEqual(["planned", "packing", "in_transit"]);
    expect(LOAD_STATUS_LABEL.in_transit).toBe("On the road");
  });

  it("a critical item is a gap with no load, a cancelled load, or no destination (L8)", () => {
    const base = { id: "1", description: "Generator", isCritical: true, neededBy: null };
    expect(gapReason({ ...base, load: null })).toBe("no_load");
    expect(gapReason({ ...base, load: { status: "cancelled", hasDestination: true } })).toBe(
      "load_cancelled",
    );
    expect(gapReason({ ...base, load: { status: "planned", hasDestination: false } })).toBe(
      "no_destination",
    );
    expect(gapReason({ ...base, load: { status: "planned", hasDestination: true } })).toBeNull();
    expect(gapReason({ ...base, isCritical: false, load: null })).toBeNull();
    expect(GAP_TEXT.no_load).toBe("Not on a load yet");
  });

  it("gaps sort by needed-by date, undated last, then name", () => {
    const g = gaps([
      { id: "a", description: "Water drums", isCritical: true, neededBy: null, load: null },
      { id: "b", description: "Generator", isCritical: true, neededBy: "2027-04-10", load: null },
      { id: "c", description: "Shade", isCritical: false, neededBy: "2027-04-01", load: null },
      { id: "d", description: "Fridge", isCritical: true, neededBy: "2027-04-10", load: null },
      { id: "e", description: "Ice", isCritical: true, neededBy: null, load: null },
    ]);
    expect(g.map((x) => x.description)).toEqual(["Fridge", "Generator", "Ice", "Water drums"]);
  });
});

const plan = (over: Partial<Plan>): Plan => ({
  id: "p",
  personId: "x",
  direction: "to_burn",
  mode: "offering_ride",
  travelDate: "2027-04-21",
  areaPlaceId: "cbd",
  seatsOffered: 3,
  seatsNeeded: null,
  ...over,
});

describe("ride board", () => {
  const need = plan({
    id: "n",
    personId: "me",
    mode: "need_ride",
    seatsNeeded: 1,
    seatsOffered: null,
  });
  const offers = [
    plan({ id: "o1", personId: "a", travelDate: "2027-04-22" }),
    plan({ id: "o2", personId: "b" }),
    plan({ id: "o3", personId: "c", travelDate: "2027-04-24" }), // too far
    plan({ id: "o4", personId: "d", direction: "from_burn" }), // wrong way
    plan({ id: "o5", personId: "e", areaPlaceId: "airport" }), // wrong area
    plan({ id: "o6", personId: "f", areaPlaceId: null, seatsOffered: 1 }), // full (see matches)
    plan({ id: "o7", personId: "me" }), // own offer
    plan({ id: "o8", personId: "g", travelDate: null }), // no date
    plan({ id: "o9", personId: "h", mode: "own_arrangement" }),
  ];
  const matches: Match[] = [
    { driverPlanId: "o6", passengerPlanId: "z", seats: 1, status: "accepted" },
    { driverPlanId: "o2", passengerPlanId: "y", seats: 1, status: "proposed" },
    { driverPlanId: "o2", passengerPlanId: "w", seats: 1, status: "accepted" },
  ];

  it("matches direction, ±1 day, area (or none) and seats left; closest date first (L4)", () => {
    const got = offersFor(need, offers, matches);
    expect(got.map((x) => x.plan.id)).toEqual(["o2", "o1"]);
    expect(got[0]).toMatchObject({ seatsLeft: 2, daysApart: 0 });
    expect(
      offersFor({ ...need, areaPlaceId: null }, offers, matches).map((x) => x.plan.id),
    ).toEqual(["o2", "o5", "o1"]);
    expect(offersFor({ ...need, seatsNeeded: 3 }, offers, matches).map((x) => x.plan.id)).toEqual([
      "o1",
    ]);
    expect(offersFor({ ...need, seatsNeeded: null }, offers, []).length).toBeGreaterThan(0);
  });

  it("seats left counts accepted passengers only", () => {
    expect(seatsLeft(offers[1] as Plan, matches)).toBe(2);
    expect(seatsLeft(offers[5] as Plan, matches)).toBe(0);
    expect(seatsLeft(plan({ seatsOffered: null }), [])).toBe(0);
    expect(daysApart("2027-04-30", "2027-05-01")).toBe(1);
    expect(daysApart(null, "2027-05-01")).toBeNull();
  });

  it("phones only between the two people of an accepted match (L3)", () => {
    const m = { status: "accepted" as const, driverPersonId: "d", passengerPersonId: "p" };
    expect(canSeePhone("d", "p", m)).toBe(true);
    expect(canSeePhone("p", "d", m)).toBe(true);
    expect(canSeePhone("x", "d", m)).toBe(false);
    expect(canSeePhone("d", "x", m)).toBe(false);
    expect(canSeePhone("d", "d", m)).toBe(false);
    expect(canSeePhone("d", "p", { ...m, status: "proposed" })).toBe(false);
    expect(MODE_LABEL.need_ride).toBe("Need a ride");
    expect(DIRECTION_LABEL.from_burn).toBe("Home from the burn");
  });
});

describe("exports", () => {
  const rows: MemberRow[] = [
    {
      name: "Zed",
      email: "z@example.test",
      status: "confirmed",
      buildCommitment: "full",
      arrivalDay: "2027-04-21",
    },
    {
      name: "Amy",
      email: "a@example.test",
      status: "confirmed",
      buildCommitment: "partial",
      arrivalDay: "2027-04-21",
    },
    {
      name: "Bo",
      email: "b@example.test",
      status: "confirmed",
      buildCommitment: "none",
      arrivalDay: "2027-04-26",
    },
    {
      name: "Cy",
      email: "c@example.test",
      status: "waitlisted",
      buildCommitment: "full",
      arrivalDay: "2027-04-21",
    },
    {
      name: 'Di, "Dee"',
      email: "d@example.test",
      status: "confirmed",
      buildCommitment: "full",
      arrivalDay: null,
    },
  ];

  it("WAP list: confirmed builders only, name and email only (L5)", () => {
    expect(wapCsv(rows)).toBe(
      [
        "name,email",
        "Amy,a@example.test",
        '"Di, ""Dee""",d@example.test',
        "Zed,z@example.test",
      ].join("\n"),
    );
  });

  it("arrivals grouped by day, unknown last; CSV marks builders", () => {
    expect(arrivalsByDay(rows)).toEqual([
      { day: "2027-04-21", names: ["Amy", "Zed"] },
      { day: "2027-04-26", names: ["Bo"] },
      { day: null, names: ['Di, "Dee"'] },
    ]);
    expect(arrivalsCsv(rows).split("\n")).toEqual([
      "day,name,builder",
      "2027-04-21,Amy,yes",
      "2027-04-21,Zed,yes",
      "2027-04-26,Bo,no",
      'unknown,"Di, ""Dee""",yes',
    ]);
  });

  it("defuses spreadsheet formulas", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("plain")).toBe("plain");
  });
});
