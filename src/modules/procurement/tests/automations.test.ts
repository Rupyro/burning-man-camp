// Kit automation, rule 14 (automation plan).
import { describe, expect, it } from "vitest";
import { kitAutomations, type UnclaimedFact } from "../rules/automations";

const NOW = new Date("2027-03-01T08:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const need = (over: Partial<UnclaimedFact> = {}): UnclaimedFact => ({
  needId: "n1",
  itemName: "Stapler",
  teamId: "t1",
  teamName: "Gift projects",
  raisedAt: day(-8),
  neededBy: day(30),
  leadIds: ["lead"],
  ...over,
});

describe("rule 14: unclaimed kit", () => {
  it("reminds the team leads weekly", () => {
    expect(kitAutomations([need({ raisedAt: day(-6) })], NOW).reminders).toEqual([]);
    expect(kitAutomations([need()], NOW).reminders.map((r) => [r.personId, r.stage])).toEqual([
      ["lead", "d7"],
    ]);
  });
  it("within 14 days of its date it goes to the camp lead", () => {
    expect(kitAutomations([need({ neededBy: day(15) })], NOW).handovers).toEqual([]);
    expect(kitAutomations([need({ neededBy: day(14) })], NOW).handovers[0]).toMatchObject({
      what: "Unclaimed kit, needed in 14 days",
      about: "Stapler (Gift projects)",
      to: { role: "camp_lead" },
    });
    expect(kitAutomations([need({ neededBy: day(-2) })], NOW).handovers[0]?.what).toBe(
      "Unclaimed kit, needed in 0 days",
    );
    expect(kitAutomations([need({ neededBy: null })], NOW).handovers).toEqual([]);
  });
});
