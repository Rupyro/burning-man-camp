import { describe, expect, it } from "vitest";
import { openByPartner } from "../rules/village";

describe("village rules", () => {
  it("counts open shares per partner, both ways, skipping returned ones", () => {
    expect(
      openByPartner([
        { partner: "Zed", direction: "borrow", returned: false },
        { partner: "Alpha", direction: "lend", returned: false },
        { partner: "Alpha", direction: "borrow", returned: false },
        { partner: "Alpha", direction: "lend", returned: true },
      ]),
    ).toEqual([
      { partner: "Alpha", theirs: 1, ours: 1 },
      { partner: "Zed", theirs: 1, ours: 0 },
    ]);
    expect(openByPartner([{ partner: "A", direction: "lend", returned: true }])).toEqual([]);
  });
});
