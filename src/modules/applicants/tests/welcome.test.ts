import { describe, expect, it } from "vitest";
import { WELCOME_DAYS, welcomeOpen, welcomeTodos } from "../rules/welcome";

const NOW = new Date("2027-03-01T08:00:00Z");
const ago = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const fact = { joinedAt: ago(1), paidAt: ago(1), guideReadAt: null };

describe("welcome list", () => {
  it("gives a new member three to-dos, with the fee already ticked", () => {
    expect(welcomeTodos(fact).map((t) => [t.key, t.done])).toEqual([
      ["fee", true],
      ["shifts", null],
      ["guide", false],
    ]);
  });
  it("shows on home until the guide is read, for the welcome days, while switched on", () => {
    expect(welcomeOpen(fact, NOW, true)).toBe(true);
    expect(welcomeOpen({ ...fact, guideReadAt: ago(0) }, NOW, true)).toBe(false);
    expect(welcomeOpen({ ...fact, joinedAt: ago(WELCOME_DAYS + 1) }, NOW, true)).toBe(false);
    expect(welcomeOpen(fact, NOW, false)).toBe(false);
    expect(welcomeOpen({ ...fact, joinedAt: null }, NOW, true)).toBe(false);
  });
});
