import { describe, expect, it } from "vitest";
import { alertHours } from "../engine/rules/alerts";

const DEFAULTS = { remindHoursBefore: 48, remindAgainHoursBefore: 24, escalateLeadHoursBefore: 6 };
const row = {
  key: "shifts.gap",
  enabled: true,
  remindDaysBefore: null,
  remindAgainDaysBefore: null,
  escalateLeadAfterDays: null,
  escalateCampAfterDays: null,
  withinDays: null,
  escalateWithinDays: null,
};

describe("alert hours (shared, any module)", () => {
  it("defaults when there's no row or the columns are empty", () => {
    expect(alertHours(undefined, DEFAULTS)).toEqual({ enabled: true, ...DEFAULTS });
    expect(alertHours({ ...row, remindHoursBefore: null }, DEFAULTS)).toEqual({
      enabled: true,
      ...DEFAULTS,
    });
  });
  it("row values win, and a disabled row stays disabled", () => {
    expect(
      alertHours(
        { ...row, enabled: false, remindHoursBefore: 72, escalateLeadHoursBefore: 3 },
        DEFAULTS,
      ),
    ).toEqual({
      enabled: false,
      remindHoursBefore: 72,
      remindAgainHoursBefore: 24,
      escalateLeadHoursBefore: 3,
    });
  });
});
