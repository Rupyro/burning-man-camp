// Camp-time form helpers (spec b1-12 E5): SAST is UTC+2 all year.
import { describe, expect, it } from "vitest";
import { campInputToInstant, instantToCampInput } from "@/lib/dates";

describe("camp time form helpers", () => {
  it("reads a camp-time date and time as the right instant", () => {
    expect(campInputToInstant("2027-04-21", "08:00").toISOString()).toBe(
      "2027-04-21T06:00:00.000Z",
    );
    expect(campInputToInstant("2027-04-21", "").toISOString()).toBe("2027-04-20T22:00:00.000Z");
  });

  it("shows an instant back as camp-time date and time", () => {
    expect(instantToCampInput(new Date("2027-04-21T06:00:00Z"))).toEqual({
      date: "2027-04-21",
      time: "08:00",
    });
    expect(instantToCampInput(new Date("2027-04-20T23:30:00Z"))).toEqual({
      date: "2027-04-21",
      time: "01:30",
    });
  });

  it("refuses a malformed date", () => {
    expect(() => campInputToInstant("21/04/2027", "08:00")).toThrow();
  });
});
