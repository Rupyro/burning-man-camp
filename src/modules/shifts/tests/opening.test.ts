// Before the roster exists (Sage, 21 Oct 2026): say when sign-ups open, never "not set up".
import { describe, expect, it } from "vitest";
import { notOpenYet, SIGNUPS_OPEN_ANCHOR } from "../rules/opening";

const NOW = new Date("2026-10-21T10:00:00Z");

describe("shift sign-ups not open yet", () => {
  it("names the opening day from the shift_signups_open anchor date", () => {
    expect(SIGNUPS_OPEN_ANCHOR).toBe("shift_signups_open");
    expect(notOpenYet(new Date("2027-02-01T08:00:00Z"), NOW)).toBe(
      "Shift sign-ups open on 1 Feb. We'll send you an alert when they do.",
    );
  });
  it("without a date (or a date already past) it still says what happens next", () => {
    const line = "Shift sign-ups haven't opened yet. We'll send you an alert when they do.";
    expect(notOpenYet(null, NOW)).toBe(line);
    expect(notOpenYet(new Date("2026-10-01T08:00:00Z"), NOW)).toBe(line);
  });
});
