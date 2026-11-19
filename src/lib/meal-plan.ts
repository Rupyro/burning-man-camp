// Meal plan (plan Phase 6, Kitchen pack): how many plates the camp kitchen serves, how many cooks
// each meal needs, and whether the event's food permit rule applies. Pure maths, no database.

export interface MealInput {
  people: number;
  days: number;
  /** Camp meals cooked for everyone each day (0–3). */
  mealsPerDay: number;
  /** One cook for this many diners. */
  dinersPerCook: number;
  /** Food or drink given to the public, not just campmates. */
  giftsToPublic: boolean;
}

export interface MealPlan {
  meals: number;
  plates: number;
  cooksPerMeal: number;
  /** Cook shifts across the whole event. */
  cookShifts: number;
  /** Why a food permit is needed, or null. */
  permitReason: "public" | "large" | null;
}

export function mealPlan(i: MealInput, permitOver?: number): MealPlan {
  const meals = i.days * i.mealsPerDay;
  const cooksPerMeal =
    i.people > 0 ? Math.max(1, Math.ceil(i.people / Math.max(1, i.dinersPerCook))) : 0;
  const permitReason =
    permitOver === undefined || meals === 0
      ? null
      : i.giftsToPublic
        ? "public"
        : i.people > permitOver
          ? "large"
          : null;
  return {
    meals,
    plates: meals * i.people,
    cooksPerMeal,
    cookShifts: meals * cooksPerMeal,
    permitReason,
  };
}
