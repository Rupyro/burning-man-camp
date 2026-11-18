// Automatic rule 1: who is offered a dropped shift, and when.
import { describe, expect, it } from "vitest";
import { nextOnStandby, type StandbyRow, shouldOffer } from "../rules/standby";

const t = (m: number) => new Date(2027, 3, 1, 8, m);
const row = (id: string, status: StandbyRow["status"], m: number): StandbyRow => ({
  id,
  personId: `p-${id}`,
  status,
  createdAt: t(m),
});

describe("standby", () => {
  it("offers the place to whoever joined standby first and is still waiting", () => {
    expect(
      nextOnStandby([row("c", "waiting", 3), row("a", "passed", 1), row("b", "waiting", 2)])?.id,
    ).toBe("b");
    expect(nextOnStandby([row("a", "left", 1)])).toBeNull();
  });
  it("offers only when the rule is on, nobody holds an offer and the shift hasn't started", () => {
    const base = { ruleOn: true, startsAt: t(60), now: t(0), rows: [row("a", "waiting", 1)] };
    expect(shouldOffer(base)).toBe(true);
    expect(shouldOffer({ ...base, ruleOn: false })).toBe(false);
    expect(shouldOffer({ ...base, now: t(61) })).toBe(false);
    expect(shouldOffer({ ...base, rows: [row("a", "offered", 1)] })).toBe(false);
  });
});
