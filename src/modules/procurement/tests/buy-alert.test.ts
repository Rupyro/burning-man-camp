// Automatic rule 2: an item still not bought N days before it's needed → the team lead is told.
import { describe, expect, it } from "vitest";
import { buyDeadlineAlerts } from "../rules/automations";

const now = new Date("2027-04-05T08:00:00Z");
const need = (over: Partial<Parameters<typeof buyDeadlineAlerts>[0][number]> = {}) => ({
  needId: "n1",
  itemName: "Shade cloth, 30 m",
  teamId: "t-log",
  teamName: "Logistics",
  neededBy: new Date("2027-04-10T10:00:00Z"),
  ownerName: "Pieter",
  ...over,
});

describe("buy-list warning", () => {
  it("5 days before it's needed, the team lead is told, naming who said they'd buy it", () => {
    const [h, ...rest] = buyDeadlineAlerts([need()], now, 5);
    expect(rest).toEqual([]);
    expect(h).toMatchObject({
      rule: "procurement.not_bought",
      entityId: "n1",
      to: { teamId: "t-log" },
      what: "Nobody has bought Shade cloth, 30 m yet",
      about: "Pieter said they would buy it",
      href: "/procurement/n/n1",
    });
    expect(h?.why).toContain("5 days");
  });

  it("not yet when it's further away, and never without a needed-by date", () => {
    expect(buyDeadlineAlerts([need()], now, 3)).toEqual([]);
    expect(buyDeadlineAlerts([need({ neededBy: null })], now, 5)).toEqual([]);
  });

  it("says nobody has picked it up when it has no owner", () => {
    const [h] = buyDeadlineAlerts([need({ ownerName: null })], now, 7);
    expect(h?.about).toBe("Nobody has picked it up");
  });
});
