import { describe, expect, it } from "vitest";
import {
  boardCounts,
  dueLabel,
  obligationState,
  type StateInput,
  sortForBoard,
} from "../rules/status";

const NOW = new Date("2027-02-01T08:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const row = (over: Partial<StateInput> = {}): StateInput => ({
  status: "todo",
  dueAt: days(30),
  ownerPersonId: "p1",
  ...over,
});

describe("dueLabel", () => {
  it("shows the camp-time date when confirmed", () => {
    expect(dueLabel(new Date("2027-02-26T10:00:00Z"), true, "2026-02-28")).toEqual({
      text: "Fri, Feb 26",
      tentative: false,
    });
  });
  it("shows TBC with last year's date when unconfirmed", () => {
    expect(dueLabel(days(5), false, "2026-02-28")).toEqual({
      text: "TBC (2026: Feb 28)",
      tentative: true,
    });
  });
  it("falls back to the guessed date, then to 'No date yet'", () => {
    expect(dueLabel(new Date("2027-03-05T10:00:00Z"), false, null).text).toBe("TBC (Mar 5?)");
    expect(dueLabel(null, false, null)).toEqual({ text: "No date yet", tentative: true });
    expect(dueLabel(null, true, null).text).toBe("No date yet");
  });
  it("uses camp time near midnight (PT is UTC-8 in winter)", () => {
    expect(dueLabel(new Date("2027-02-27T07:30:00Z"), true, null).text).toBe("Fri, Feb 26");
  });
});

describe("obligationState", () => {
  it("covers each state", () => {
    expect(obligationState(row({ status: "done", dueAt: days(-5) }), NOW)).toBe("done");
    expect(obligationState(row({ status: "cancelled" }), NOW)).toBe("cancelled");
    expect(obligationState(row({ dueAt: days(-1) }), NOW)).toBe("late");
    expect(obligationState(row({ status: "blocked", dueAt: days(-1) }), NOW)).toBe("late");
    expect(obligationState(row({ dueAt: days(14) }), NOW)).toBe("due_soon");
    expect(obligationState(row({ dueAt: days(15), ownerPersonId: null }), NOW)).toBe("no_owner");
    expect(obligationState(row({ dueAt: null }), NOW)).toBe("open");
    expect(obligationState(row(), NOW)).toBe("open");
  });
});

describe("board", () => {
  it("sorts late → due soon → no owner → open → done, then by date", () => {
    const rows = [
      { ...row({ status: "done" }), id: "done" },
      { ...row({ dueAt: days(40) }), id: "open-late-date" },
      { ...row({ dueAt: days(20) }), id: "open" },
      { ...row({ ownerPersonId: null }), id: "unowned" },
      { ...row({ dueAt: days(3) }), id: "soon" },
      { ...row({ dueAt: days(-2) }), id: "late" },
    ];
    expect(sortForBoard(rows, NOW).map((r) => r.id)).toEqual([
      "late",
      "soon",
      "unowned",
      "open",
      "open-late-date",
      "done",
    ]);
  });

  it("counts, skipping cancelled; unowned late ones count as both", () => {
    expect(
      boardCounts(
        [
          row({ dueAt: days(-2), ownerPersonId: null }),
          row({ dueAt: days(3) }),
          row({ status: "done", ownerPersonId: null }),
          row({ status: "cancelled", ownerPersonId: null }),
          row(),
        ],
        NOW,
      ),
    ).toEqual({ late: 1, due_soon: 1, no_owner: 1, done: 1, total: 4 });
  });
});
