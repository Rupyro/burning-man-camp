import { describe, expect, it } from "vitest";
import { dropTarget } from "./fun-extras";

describe("badge drop target", () => {
  it("lands the badge in its slot under the demo strip", () => {
    expect(dropTarget(true)).toEqual({ "--fun-top": "1.5rem" });
  });
  it("lands at the very top when there is no demo strip", () => {
    expect(dropTarget(false)).toEqual({ "--fun-top": "0px" });
  });
});
