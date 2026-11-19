import { describe, expect, it } from "vitest";
import { mealPlan } from "./meal-plan";

const base = { people: 70, days: 9, mealsPerDay: 1, dinersPerCook: 15, giftsToPublic: false };

describe("mealPlan", () => {
  it("counts meals, plates, cooks a meal and cook shifts", () => {
    expect(mealPlan(base, 125)).toEqual({
      meals: 9,
      plates: 630,
      cooksPerMeal: 5,
      cookShifts: 45,
      permitReason: null,
    });
  });

  it("needs a permit over the limit, or for gifting to the public", () => {
    expect(mealPlan({ ...base, people: 125 }, 125).permitReason).toBeNull();
    expect(mealPlan({ ...base, people: 126 }, 125).permitReason).toBe("large");
    expect(mealPlan({ ...base, giftsToPublic: true }, 125).permitReason).toBe("public");
  });

  it("says nothing about permits without the event's rule or with no camp meals", () => {
    expect(mealPlan({ ...base, people: 500 }).permitReason).toBeNull();
    expect(mealPlan({ ...base, people: 500, mealsPerDay: 0 }, 125).permitReason).toBeNull();
  });

  it("needs no cooks for nobody, and at least one otherwise", () => {
    expect(mealPlan({ ...base, people: 0 }, 125).cooksPerMeal).toBe(0);
    expect(mealPlan({ ...base, people: 3, dinersPerCook: 0 }, 125).cooksPerMeal).toBe(3);
    expect(mealPlan({ ...base, people: 3 }, 125).cooksPerMeal).toBe(1);
  });
});
