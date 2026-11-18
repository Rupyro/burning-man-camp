import { describe, expect, it } from "vitest";
import {
  BADGES,
  badgeClass,
  badgeLabel,
  badgeRowTop,
  burnClockLine,
  demoDoneTopUp,
  earnedBadges,
  flipFun,
  funActive,
  funEnabled,
  funPlan,
  isShake,
  isSleepHour,
  milestoneCrossed,
  milestoneText,
  revealPlaya,
  stormAllowed,
  TapCounter,
} from "./fun-extras";

describe("fun extras switch", () => {
  it("is on unless switched off on this device", () => {
    expect(funEnabled(null)).toBe(true);
    expect(funEnabled("off")).toBe(false);
  });
});

describe("burn clock", () => {
  it("counts down, then welcomes people home by day", () => {
    expect(burnClockLine(183)).toBe("183 days to gates");
    expect(burnClockLine(1)).toBe("1 day to gates");
    expect(burnClockLine(0)).toBe("Welcome home, day 1");
    expect(burnClockLine(-2)).toBe("Welcome home, day 3");
    expect(burnClockLine(-9)).toBeNull();
    expect(burnClockLine(null)).toBeNull();
  });
});

describe("milestones every 10 tasks", () => {
  it("fires when the count reaches a new multiple of 10", () => {
    expect(milestoneCrossed(9, 10)).toBe(10);
    expect(milestoneCrossed(18, 21)).toBe(20);
    expect(milestoneCrossed(10, 10)).toBeNull();
    expect(milestoneCrossed(11, 19)).toBeNull();
    expect(milestoneCrossed(null, 30)).toBeNull();
  });
  it("reads the same way every time", () => {
    expect(milestoneText(10)).toEqual({
      title: "10 tasks finished!",
      next: "Next celebration at 20",
    });
  });
});

describe("badges", () => {
  it("earns task badges from finished tasks and keeps the rest locked", () => {
    const got = earnedBadges({ done: 52, shifts: 1, thanks: 0 });
    expect(got).toEqual(["first-shift", "tasks-10", "tasks-50"]);
    expect(BADGES.find((b) => b.id === "tasks-50")?.name).toBe("50 tasks finished");
    expect(earnedBadges({ done: 0, shifts: 0, thanks: 1 })).toEqual(["first-thanks"]);
  });
});

describe("eggs", () => {
  it("knows the 3am hour", () => {
    expect(isSleepHour(3)).toBe(true);
    expect(isSleepHour(4)).toBe(false);
  });
  it("counts five quick logo taps", () => {
    const t = new TapCounter(5, 1500);
    expect([0, 200, 400, 600].map((ms) => t.tap(ms))).toEqual([false, false, false, false]);
    expect(t.tap(800)).toBe(true);
    expect(t.tap(5000)).toBe(false);
  });
});

describe("what plays on this visit", () => {
  it("plans the campfire, then drops the newest badge", () => {
    expect(funPlan("9", 10, "", ["tasks-10"])).toEqual({
      party: 10,
      drop: "tasks-10",
      dropAt: 3000,
      settleAt: 4600,
    });
    expect(funPlan("10", 10, "tasks-10", ["tasks-10"])).toEqual({
      party: null,
      drop: null,
      dropAt: 0,
      settleAt: 1600,
    });
    expect(funPlan(null, 30, "", ["tasks-10"]).drop).toBeNull();
    expect(funPlan("5", 6, "", ["first-thanks"]).dropAt).toBe(0);
  });
  it("adds the 100th task line only at hundreds", () => {
    expect(milestoneText(100).next).toBe("That's your 100th task!");
    expect(milestoneText(200).next).toBe("That's your 200th task!");
  });
  it("labels badges plainly", () => {
    expect(badgeLabel("Strike helper", false)).toBe("Strike helper (not earned yet)");
    expect(badgeLabel("Strike helper", true)).toBe("Strike helper");
  });
});

describe("when the extras may play", () => {
  it("plays only when switched on and motion is allowed", () => {
    expect(funActive(null, false)).toBe(true);
    expect(funActive("off", false)).toBe(false);
    expect(funActive(null, true)).toBe(false);
  });
  it("sends a dust storm only when on and not in Burn Mode", () => {
    expect(stormAllowed(null, false)).toBe(true);
    expect(stormAllowed("off", false)).toBe(false);
    expect(stormAllowed(null, true)).toBe(false);
  });
  it("counts a hard shake, at most once every 4 seconds", () => {
    expect(isShake({ x: 20, y: 15, z: 10 }, 0, 5000)).toBe(true);
    expect(isShake({ x: 20, y: 15, z: 10 }, 3000, 5000)).toBe(false);
    expect(isShake({ x: 1, y: 9, z: 1 }, 0, 5000)).toBe(false);
    expect(isShake({ x: null, y: undefined, z: 50 }, 0, 5000)).toBe(true);
    expect(isShake(null, 0, 5000)).toBe(false);
  });
  it("reveals the playa name once per name", () => {
    expect(revealPlaya(true, null, "Dusty Sparrow")).toBe(true);
    expect(revealPlaya(true, "Dusty Sparrow", "Dusty Sparrow")).toBe(false);
    expect(revealPlaya(true, "Old Name", "Dusty Sparrow")).toBe(true);
    expect(revealPlaya(false, null, "Dusty Sparrow")).toBe(false);
  });
  it("flips the switch and says what to store", () => {
    expect(flipFun(true)).toEqual({ next: false, store: "off" });
    expect(flipFun(false)).toEqual({ next: true, store: null });
  });
  it("names each badge's look in the row", () => {
    expect(badgeClass(true, false, false)).toBe("fun-badge");
    expect(badgeClass(false, true, true)).toBe("fun-badge is-locked is-fresh is-empty");
  });
});

describe("demo top-up", () => {
  it("tops the demo member up to 9 finished tasks, never down", () => {
    expect(demoDoneTopUp(3)).toBe(6);
    expect(demoDoneTopUp(9)).toBe(0);
    expect(demoDoneTopUp(14)).toBe(0);
  });
  it("puts the badge row under the demo strip when it shows", () => {
    expect(badgeRowTop(true)).toBe("1.5rem");
    expect(badgeRowTop(false)).toBe("0");
  });
});
