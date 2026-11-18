import { describe, expect, it } from "vitest";
import {
  CAMP_START_YEAR,
  canWelcomeFamily,
  familyLine,
  familyYearsOffered,
  isFoundingFamily,
  litMessage,
  suggestFamilyRole,
  validFamilyYears,
  yearsBadges,
} from "../rules/family";

const d = (y: number) => new Date(Date.UTC(y, 5, 1));

describe("Oe-aa-sies Family years", () => {
  it("offers every year since the camp began in 2023, growing each year", () => {
    expect(CAMP_START_YEAR).toBe(2023);
    expect(familyYearsOffered(d(2026))).toEqual([2023, 2024, 2025, 2026]);
    expect(familyYearsOffered(d(2028))).toEqual([2023, 2024, 2025, 2026, 2027, 2028]);
    expect(familyYearsOffered(d(2022))).toEqual([2023]);
  });
  it("only accepts real camp years, once each, sorted", () => {
    expect(validFamilyYears([2025, 2024, 2025], d(2026))).toEqual([2024, 2025]);
    expect(validFamilyYears([2019, 2022, 2026, 2031], d(2026))).toEqual([2026]);
  });
  it("lights badges at 2 years, 3 years and Founding family at 4 or more", () => {
    expect(yearsBadges(1)).toEqual([]);
    expect(yearsBadges(2)).toEqual(["years-2"]);
    expect(yearsBadges(3)).toEqual(["years-2", "years-3"]);
    expect(yearsBadges(5)).toEqual(["years-2", "years-3", "founding-family"]);
  });
  it("knows Founding family is every year since 2023", () => {
    expect(isFoundingFamily([2023, 2024, 2025, 2026], d(2026))).toBe(true);
    expect(isFoundingFamily([2024, 2025, 2026], d(2026))).toBe(false);
    expect(litMessage([2024, 2025, 2026], d(2026))).toBe(
      "3 years bloomed. Thank you for coming back.",
    );
    expect(litMessage([2023, 2024, 2025, 2026], d(2026))).toBe(
      "All 4 in bloom, every year since we began in 2023. You're Founding family!",
    );
    expect(litMessage([2025], d(2026))).toBe("1 year bloomed. Thank you for coming back.");
    expect(litMessage([], d(2026))).toBe(
      "Tap a year. Your protea opens a little more for each one.",
    );
  });
  it("writes the proud profile line", () => {
    expect(familyLine([2024, 2025, 2026], d(2026))).toBe("2024 · 2025 · 2026 · 3 years in bloom");
    expect(familyLine([2023, 2024, 2025, 2026], d(2026))).toBe(
      "2023 · 2024 · 2025 · 2026 · 4 years in bloom · Founding family",
    );
  });
});

describe("welcoming family home", () => {
  it("is for admins only by default", () => {
    expect(canWelcomeFamily({ isAdmin: true, isLead: false }, "admins")).toBe(true);
    expect(canWelcomeFamily({ isAdmin: false, isLead: true }, "admins")).toBe(false);
    expect(canWelcomeFamily({ isAdmin: false, isLead: true }, "admins_and_leads")).toBe(true);
    expect(canWelcomeFamily({ isAdmin: false, isLead: false }, "admins_and_leads")).toBe(false);
  });
  it("offers a soft guess from their answers", () => {
    expect(suggestFamilyRole({ teams: ["Build"], led: true, loveTo: ["Leading a team"] })).toBe(
      "could lead Build",
    );
    expect(suggestFamilyRole({ teams: ["Transport"], led: false, loveTo: [] })).toBe(
      "a natural fit for Transport",
    );
    expect(suggestFamilyRole({ teams: [], led: false, loveTo: [] })).toBe(
      "happy anywhere: ask what they'd enjoy",
    );
  });
});
