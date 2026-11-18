import { describe, expect, it } from "vitest";
import { groupReminders, NUDGE_WAIT_MS, nudgeAgainAt, nudgeTitle } from "./nudge";

const now = new Date("2026-10-27T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const t = (id: string, owner: string, due: Date | null) => ({
  id,
  title: id,
  dueAt: due,
  status: "todo",
  ownerPersonId: owner,
  ownerName: owner.toUpperCase(),
});

describe("team reminders", () => {
  it("groups by person, most late first, late tasks on top", () => {
    const out = groupReminders(
      [
        t("a1", "a", day(3)),
        t("b1", "b", day(-1)),
        t("b2", "b", day(-5)),
        t("a2", "a", day(-2)),
        t("c1", "c", null),
      ],
      new Map(),
      now,
    );
    expect(out.map((p) => [p.personId, p.lateCount])).toEqual([
      ["b", 2],
      ["a", 1],
      ["c", 0],
    ]);
    expect(out[0]?.tasks.map((x) => x.id)).toEqual(["b2", "b1"]);
    expect(out[1]?.tasks.map((x) => x.id)).toEqual(["a2", "a1"]);
  });

  it("waits 2 days after the last nudge", () => {
    expect(nudgeAgainAt(null, now)).toBeNull();
    expect(nudgeAgainAt(day(-1), now)?.getTime()).toBe(day(-1).getTime() + NUDGE_WAIT_MS);
    expect(nudgeAgainAt(day(-2), now)).toBeNull();
  });

  it("says who, how many and which team", () => {
    expect(nudgeTitle("Alex", "Kitchen", 1)).toBe("Alex nudged you: 1 late task in Kitchen");
    expect(nudgeTitle("Alex", "Kitchen", 3)).toBe("Alex nudged you: 3 late tasks in Kitchen");
  });
});
