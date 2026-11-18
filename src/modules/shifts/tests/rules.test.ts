import { describe, expect, it } from "vitest";
import { type ClaimFacts, claimProblem, contribution, plannedEnough } from "../rules/contribution";

const at = (d: number, h: number) => new Date(Date.UTC(2027, 3, d, h));
const base: ClaimFacts = {
  now: at(1, 8),
  freezeAt: at(19, 0),
  startsAt: at(26, 7),
  endsAt: at(26, 10),
  slotStatus: "open",
  liveCount: 1,
  maxStaff: 3,
  requiredSkillId: null,
  mySkillIds: [],
  alreadyOn: false,
  myShifts: [],
};

describe("claiming", () => {
  it("open, before the freeze, room left, no clash: yes", () => {
    expect(claimProblem(base)).toBeNull();
  });
  it("refuses frozen, full, started, duplicate, overlapping and closed shifts", () => {
    expect(claimProblem({ ...base, now: at(19, 0) })).toMatch(/frozen/);
    expect(claimProblem({ ...base, liveCount: 3 })).toMatch(/full/);
    expect(claimProblem({ ...base, alreadyOn: true })).toMatch(/already/);
    expect(claimProblem({ ...base, slotStatus: "closed_out" })).toMatch(/closed/);
    expect(
      claimProblem({ ...base, myShifts: [{ startsAt: at(26, 9), endsAt: at(26, 12) }] }),
    ).toMatch(/overlaps/);
    expect(
      claimProblem({ ...base, myShifts: [{ startsAt: at(26, 10), endsAt: at(26, 12) }] }),
    ).toBeNull(); // back to back is fine
  });
  it("qualified-only roles need the skill", () => {
    expect(claimProblem({ ...base, requiredSkillId: "drv" })).toMatch(/qualification/);
    expect(claimProblem({ ...base, requiredSkillId: "drv", mySkillIds: ["drv"] })).toBeNull();
  });
});

describe("contribution", () => {
  const settings = { minDutyHours: 8, minBuildStrikeDays: 4, maxPrecreditPercent: 50 };
  const day = (d: Date) => d.toISOString().slice(0, 10);
  it("only lead-marked done counts; build/strike in distinct days; credit capped", () => {
    const c = contribution(
      [
        { phase: "burn", status: "completed", startsAt: at(26, 7), endsAt: at(26, 10) },
        { phase: "burn", status: "claimed", startsAt: at(27, 7), endsAt: at(27, 10) },
        { phase: "burn", status: "no_show", startsAt: at(28, 7), endsAt: at(28, 10) },
        { phase: "build", status: "completed", startsAt: at(23, 6), endsAt: at(23, 14) },
        { phase: "build", status: "claimed", startsAt: at(24, 6), endsAt: at(24, 14) },
        { phase: "strike", status: "claimed", startsAt: at(24, 15), endsAt: at(24, 16) },
      ],
      settings,
      10,
      day,
    );
    expect(c).toMatchObject({
      dutyHoursDone: 3,
      dutyHoursPlanned: 6,
      precreditHours: 4,
      buildStrikeDaysDone: 1,
      buildStrikeDaysPlanned: 2,
    });
    expect(plannedEnough(c)).toBe(false);
  });
});
