import { activeEvent } from "@/lib/active-packs";
import { campConfig } from "@/lib/camp";
import type { CampConfig } from "@/lib/camp-config";
import { mealPlan } from "@/lib/meal-plan";
import { eventDays, readCount } from "@/lib/water-plan";
import { basePage } from "../_components/base-page";

type Query = { people?: string; days?: string; meals?: string; per?: string; public?: string };

/** Meal plan (plan Phase 6): plates, cooks per meal, and the event's food permit rule. */
export default async function MealsPage(props: { searchParams: Promise<Query> }) {
  await basePage(async () => null);
  const q = await props.searchParams;
  const food = activeEvent.food;
  const input = {
    people: readCount(q.people, (campConfig as CampConfig).camp.size ?? 20, 2000),
    days: readCount(q.days, eventDays(activeEvent.event), 30),
    mealsPerDay: readCount(q.meals, 1, 3),
    dinersPerCook: Math.max(1, readCount(q.per, 15, 500)),
    giftsToPublic: q.public === "1",
  };
  const p = mealPlan(input, food?.permitOver);
  const n = (v: number) => v.toLocaleString("en-US");
  const field = (name: keyof Query, label: string, value: number, max?: number) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={max}
        defaultValue={value}
        className="min-h-11 rounded-lg border bg-background px-2"
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">Meal plan</h1>
        <p className="text-sm text-muted-foreground">
          Camp meals cooked for everyone. Change the numbers and press Work it out.
        </p>
      </div>
      <form
        method="get"
        className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      >
        {field("people", "People eating", input.people)}
        {field("days", "Days on site", input.days)}
        {field("meals", "Camp meals a day", input.mealsPerDay, 3)}
        {field("per", "Diners per cook", input.dinersPerCook)}
        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm">
          <input name="public" type="checkbox" value="1" defaultChecked={input.giftsToPublic} />
          We also give food or drinks to the public
        </label>
        <button type="submit" className="col-span-2 min-h-11 rounded-lg border font-semibold">
          Work it out
        </button>
      </form>
      <section className="rounded-2xl border bg-card p-4" aria-label="Meals">
        <h2 className="heading text-sm">
          {n(p.meals)} camp meals, {n(p.plates)} plates
        </h2>
        <p className="mt-2 text-sm">
          About <b>{p.cooksPerMeal}</b> cooks a meal, so <b>{n(p.cookShifts)}</b> cook shifts in
          all. Add clean-up shifts too.
        </p>
        {food ? (
          <p className={`mt-2 text-sm ${p.permitReason ? "font-semibold" : ""}`}>
            {p.permitReason === "public"
              ? `Giving food to the public needs a ${food.permitLabel}.`
              : p.permitReason === "large"
                ? `Cooking for more than ${food.permitOver} campmates needs a ${food.permitLabel}.`
                : `No food permit needed for camp meals for ${food.permitOver} people or fewer, as long as you don't give food to the public.`}{" "}
            <a href={food.source} className="underline" target="_blank" rel="noreferrer">
              Food permit rules
            </a>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Check the event's food safety rules before you plan to feed the public.
          </p>
        )}
      </section>
    </div>
  );
}
