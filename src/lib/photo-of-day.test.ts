import { describe, expect, it } from "vitest";
import { PHOTOS, photoIndex, themeBootScript } from "./theme-mode";

// Camp time is SAST (UTC+2).
const sast = (iso: string) => Date.parse(`${iso}+02:00`);

describe("photoIndex (daily background)", () => {
  it("is day-of-year mod 3 in camp time and steady all camp day", () => {
    // 1 Jan is day 1 -> index 1; 3 Jan is day 3 -> index 0.
    expect(photoIndex(sast("2027-01-01T00:00:00"))).toBe(1);
    expect(photoIndex(sast("2027-01-01T23:59:00"))).toBe(1);
    expect(photoIndex(sast("2027-01-02T00:00:00"))).toBe(0);
    expect(photoIndex(sast("2027-01-03T12:00:00"))).toBe(1);
  });

  it("switches at camp midnight, not UTC midnight", () => {
    // 23:30 UTC on 1 Jan is already 2 Jan at camp.
    expect(photoIndex(Date.parse("2027-01-01T23:30:00Z"))).toBe(0);
  });

  it("is inlined in the pre-paint script with the photo list", () => {
    const s = themeBootScript();
    expect(s).toContain("dataset.photo");
    for (const p of PHOTOS) expect(s).toContain(p);
    expect(s).not.toContain("fence");
  });
});
