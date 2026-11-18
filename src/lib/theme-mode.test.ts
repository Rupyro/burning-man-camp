import { describe, expect, it } from "vitest";
import { parseMode, resolveTheme, sunState, TANKWA, themeBootScript } from "./theme-mode";

// Camp time is SAST (UTC+2), so local hh:mm = UTC + 2h.
const sast = (iso: string) => Date.parse(`${iso}+02:00`);

describe("sunState at Tankwa", () => {
  it("is day at noon and night at midnight camp time", () => {
    expect(sunState(sast("2027-04-25T12:00:00"), TANKWA.lat, TANKWA.lon)[0]).toBe(false);
    expect(sunState(sast("2027-04-25T00:30:00"), TANKWA.lat, TANKWA.lon)[0]).toBe(true);
    expect(sunState(sast("2027-04-25T22:00:00"), TANKWA.lat, TANKWA.lon)[0]).toBe(true);
  });

  it("puts late-April sunrise near 07:20 and sunset near 18:20 camp time", () => {
    // From just after midnight the next change is sunrise.
    const midnight = sast("2027-04-25T00:00:00");
    const [, toRise] = sunState(midnight, TANKWA.lat, TANKWA.lon);
    const riseMin = toRise / 60000;
    expect(riseMin).toBeGreaterThan(7 * 60 + 5);
    expect(riseMin).toBeLessThan(7 * 60 + 35);
    const noon = sast("2027-04-25T12:00:00");
    const [, toSet] = sunState(noon, TANKWA.lat, TANKWA.lon);
    const setMin = 12 * 60 + toSet / 60000;
    expect(setMin).toBeGreaterThan(18 * 60 + 5);
    expect(setMin).toBeLessThan(18 * 60 + 35);
  });

  it("flips exactly at the predicted change", () => {
    const t = sast("2027-04-25T12:00:00");
    const [night, ms] = sunState(t, TANKWA.lat, TANKWA.lon);
    expect(sunState(t + ms - 60000, TANKWA.lat, TANKWA.lon)[0]).toBe(night);
    expect(sunState(t + ms + 60000, TANKWA.lat, TANKWA.lon)[0]).toBe(!night);
  });

  it("has longer days in December than June", () => {
    const dayLen = (iso: string) => {
      const [, toSet] = sunState(sast(`${iso}T12:00:00`), TANKWA.lat, TANKWA.lon);
      const [, toRise] = sunState(sast(`${iso}T00:10:00`), TANKWA.lat, TANKWA.lon);
      return 12 * 3600000 + toSet - (10 * 60000 + toRise);
    };
    expect(dayLen("2026-12-21")).toBeGreaterThan(dayLen("2027-06-21") + 3 * 3600000);
  });
});

describe("mode and resolveTheme", () => {
  it("parses stored values, defaulting to auto", () => {
    expect(parseMode("day")).toBe("day");
    expect(parseMode("night")).toBe("night");
    expect(parseMode(null)).toBe("auto");
    expect(parseMode("bogus")).toBe("auto");
  });

  it("manual modes win and never schedule a change", () => {
    const noon = sast("2027-04-25T12:00:00");
    expect(resolveTheme("night", noon)).toEqual({ night: true, nextChangeMs: null });
    expect(resolveTheme("day", sast("2027-04-25T23:00:00"))).toEqual({
      night: false,
      nextChangeMs: null,
    });
  });

  it("auto follows the sun and schedules the next switch", () => {
    const r = resolveTheme("auto", sast("2027-04-25T12:00:00"));
    expect(r.night).toBe(false);
    expect(r.nextChangeMs).toBeGreaterThan(0);
  });
});

describe("themeBootScript", () => {
  it("is self-contained and sets the night class from storage", () => {
    const classes = new Set<string>();
    const doc = {
      documentElement: {
        classList: {
          toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
        },
      },
    };
    const store = { getItem: () => "night" };
    new Function("document", "localStorage", themeBootScript())(doc, store);
    expect(classes.has("theme-night")).toBe(true);
    store.getItem = () => "day";
    new Function("document", "localStorage", themeBootScript())(doc, store);
    expect(classes.has("theme-night")).toBe(false);
  });
});
