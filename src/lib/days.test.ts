import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";
import { daysSince, stageReached } from "./days";

const T = new Date("2027-03-01T10:00:00Z");
const d = (n: number) => new Date(T.getTime() + n * 86_400_000);

describe("days", () => {
  it("counts whole days, negative into the future", () => {
    expect(daysSince(T, d(2.9))).toBe(2);
    expect(daysSince(d(3), T)).toBe(-3);
  });
  it("finds the latest stage reached", () => {
    expect(stageReached(2, [3, 7, 14])).toBeNull();
    expect(stageReached(8, [3, 7, 14])).toBe(7);
    expect(stageReached(40, [3, 7, 14])).toBe(14);
  });
});

describe("cron auth", () => {
  const secret = "s".repeat(32);
  it("needs the exact bearer secret, and refuses everything when none is set", () => {
    expect(cronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(cronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(cronAuthorized("Bearer nope", secret)).toBe(false);
    expect(cronAuthorized(null, secret)).toBe(false);
    expect(cronAuthorized("Bearer ", undefined)).toBe(false);
  });
});
