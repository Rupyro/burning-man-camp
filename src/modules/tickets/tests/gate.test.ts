import { describe, expect, it } from "vitest";
import { gateMissing, summarize, type TicketRow } from "../rules/gate";

const row = (r: Partial<TicketRow> = {}): TicketRow => ({
  ticket: "have",
  vehiclePass: "not_needed",
  earlyArrival: "no",
  ...r,
});

describe("Gate-ready", () => {
  it("needs a ticket and every pass the person said they need", () => {
    expect(gateMissing(row())).toEqual([]);
    expect(gateMissing(row({ ticket: "looking" }))).toEqual(["ticket"]);
    expect(gateMissing(row({ vehiclePass: "need", earlyArrival: "requested" }))).toEqual([
      "vehicle pass",
      "early-arrival pass",
    ]);
    expect(gateMissing(row({ vehiclePass: "have", earlyArrival: "have" }))).toEqual([]);
  });
});

describe("camp board summary", () => {
  it("counts against the allocations, never below zero", () => {
    const s = summarize(
      [
        row(),
        row({ ticket: "stewards_offered", vehiclePass: "need" }),
        row({ ticket: "none", earlyArrival: "requested" }),
        row({ earlyArrival: "have" }),
      ],
      { stewards: 1, vehiclePasses: 2, earlyPasses: 3 },
    );
    expect(s).toMatchObject({
      people: 4,
      gateReady: 2,
      stewardsLeft: 0,
      vehiclePassesNeeded: 1,
      earlyRequested: 1,
      earlyLeft: 2,
    });
    expect(s.ticket).toEqual({ none: 1, looking: 0, stewards_offered: 1, have: 2 });
  });
});
