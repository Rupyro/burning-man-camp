import { describe, expect, it } from "vitest";
import { friendlyReviewDate } from "../rules/review";

describe("friendlyReviewDate", () => {
  it("turns a camp date into a warm, readable day", () => {
    expect(friendlyReviewDate("2026-10-29")).toBe("Thursday, 29 Oct");
    expect(friendlyReviewDate("2026-03-01")).toBe("Sunday, 1 Mar");
  });
  it("leaves anything odd as it is", () => {
    expect(friendlyReviewDate("soon")).toBe("soon");
  });
});
