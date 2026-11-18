// Burn Mode (Ruchir, Oct 28 2026): what goes quiet, and when home prompts on arrival day.
import { describe, expect, it } from "vitest";
import { burnAskOn, burnSilences, burnWelcome } from "@/base/people/burn-rules";

const off = { onAt: null, arrivalAt: null, promptDismissedAt: null };
const arrive = new Date("2027-04-26T10:00:00Z"); // Mon 26 Apr, 12:00 camp time

describe("burnSilences", () => {
  it("quiets nudges, task alerts and Money notices", () => {
    for (const type of ["task.nudge", "task.due_soon", "task.overdue", "task.unowned"])
      expect(burnSilences({ type, href: "/tasks/1" })).toBe(true);
    expect(burnSilences({ type: "finance.decided", href: "/x" })).toBe(true);
    expect(burnSilences({ type: "task.assigned", href: "/finance/r/1" })).toBe(true);
  });
  it("lets shift changes, assignments and comments through", () => {
    expect(burnSilences({ type: "shifts.swap", href: "/shifts/s/1" })).toBe(false);
    expect(burnSilences({ type: "task.assigned", href: "/tasks/1" })).toBe(false);
    expect(burnSilences({ type: "task.comment", href: "/tasks/1" })).toBe(false);
  });
});

describe("burnWelcome (C)", () => {
  it("doesn't ask before arrival day or with no arrival date", () => {
    expect(burnWelcome(off, arrive)).toBe(false);
    expect(burnWelcome({ ...off, arrivalAt: arrive }, new Date("2027-04-25T21:00:00Z"))).toBe(
      false,
    );
  });
  it("asks from the arrival day (camp time), including the first open after it", () => {
    // 22:30 UTC on the 25th is already the 26th in camp time.
    expect(burnWelcome({ ...off, arrivalAt: arrive }, new Date("2027-04-25T22:30:00Z"))).toBe(true);
    expect(burnWelcome({ ...off, arrivalAt: arrive }, new Date("2027-04-28T08:00:00Z"))).toBe(true);
  });
  it("never comes back once answered or dismissed, or while Burn Mode is on", () => {
    expect(burnWelcome({ ...off, arrivalAt: arrive, promptDismissedAt: arrive }, arrive)).toBe(
      false,
    );
    expect(burnWelcome({ ...off, onAt: arrive, arrivalAt: arrive }, arrive)).toBe(false);
  });
});

describe("burnAskOn (B)", () => {
  it("is on until the welcome is answered or turned off", () => {
    expect(burnAskOn(off)).toBe(true);
    expect(burnAskOn({ ...off, promptDismissedAt: arrive })).toBe(false);
  });
});
