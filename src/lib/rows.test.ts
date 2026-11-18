import { describe, expect, it } from "vitest";
import { firstRow } from "./rows";

describe("firstRow", () => {
  it("returns the first row", () => {
    expect(firstRow([1, 2])).toBe(1);
  });
  it("throws with the label when empty", () => {
    expect(() => firstRow([], "invite")).toThrow("Expected a invite, got none");
  });
});
