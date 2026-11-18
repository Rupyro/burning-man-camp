import { describe, expect, it } from "vitest";
import { BOARD_STATUS_LABEL, boardRows, boardStatus, type Match, type Plan } from "../rules/rides";

const plan = (p: Partial<Plan>): Plan => ({
  id: "x",
  personId: "p",
  direction: "to_burn",
  mode: "offering_ride",
  travelDate: "2027-04-21",
  areaPlaceId: null,
  seatsOffered: null,
  seatsNeeded: null,
  ...p,
});
const m = (driver: string, passenger: string, status: Match["status"], seats = 1): Match => ({
  driverPlanId: driver,
  passengerPlanId: passenger,
  seats,
  status,
});

describe("rides to camp board", () => {
  it("drivers have space until their seats are taken, then they're sorted", () => {
    const d = plan({ id: "d", seatsOffered: 2 });
    expect(boardStatus(d, [])).toBe("space");
    expect(boardStatus(d, [m("d", "a", "accepted"), m("d", "b", "proposed")])).toBe("space");
    expect(boardStatus(d, [m("d", "a", "accepted", 2)])).toBe("sorted");
  });
  it("passengers are still looking until a ride is agreed", () => {
    const s = plan({ id: "s", mode: "need_ride", seatsNeeded: 1 });
    expect(boardStatus(s, [m("d", "s", "proposed")])).toBe("looking");
    expect(boardStatus(s, [m("d", "s", "accepted")])).toBe("sorted");
    expect(BOARD_STATUS_LABEL.sorted).toBe("Sorted / full");
  });
  it("lists one direction, open rides first then by date, without people who sorted themselves", () => {
    const plans = [
      plan({ id: "a", travelDate: "2027-04-23", seatsOffered: 1 }),
      plan({ id: "b", mode: "need_ride", travelDate: "2027-04-21" }),
      plan({ id: "c", mode: "own_arrangement" }),
      plan({ id: "d", direction: "from_burn", seatsOffered: 3 }),
      plan({ id: "e", travelDate: "2027-04-20", seatsOffered: 1 }),
      plan({ id: "f", travelDate: null, seatsOffered: 2 }),
    ];
    const rows = boardRows(plans, [m("e", "b", "accepted")], "to_burn");
    expect(rows.map((r) => r.plan.id)).toEqual(["a", "f", "e", "b"]);
    expect(rows.find((r) => r.plan.id === "a")?.seatsLeft).toBe(1);
    expect(boardRows(plans, [], "from_burn").map((r) => r.plan.id)).toEqual(["d"]);
  });
});
