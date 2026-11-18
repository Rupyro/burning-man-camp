import { describe, expect, it } from "vitest";
import { BADGES, dropSlotX } from "./fun-extras";

// A full row of 8 slots, as the row shows them (see badgeRow for the +N overflow).
const row = { ids: BADGES.slice(0, 8).map((b) => b.id), more: 0 };

describe("badge drop lands in its own slot", () => {
  it("lines up with the badge's slot across the row", () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(8);
    expect(dropSlotX(BADGES[0]!.id, row)).toBe("-91px");
    expect(dropSlotX("tasks-10", row)).toBe(
      `${-91 + 26 * BADGES.findIndex((b) => b.id === "tasks-10")}px`,
    );
    expect(dropSlotX(BADGES[7]!.id, row)).toBe("91px");
  });
  it("falls to the middle for a badge it doesn't know", () => {
    expect(dropSlotX("nope", row)).toBe("0px");
  });
});
