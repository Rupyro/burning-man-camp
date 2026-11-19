import { activeEvent } from "@/lib/active-packs";
import { campConfig } from "@/lib/camp";
import type { CampConfig } from "@/lib/camp-config";
import { eventDays, readCount, waterPlan } from "@/lib/water-plan";
import { basePage } from "../_components/base-page";

type Query = { people?: string; days?: string; kitchen?: string; showers?: string };

/** Water plan (plan Phase 5): what the camp brings, from people, days and the event's allowance. */
export default async function WaterPage(props: { searchParams: Promise<Query> }) {
  await basePage(async () => null);
  const q = await props.searchParams;
  const w = activeEvent.water ?? { perPersonPerDay: 1.5, unit: "gal" as const };
  const gal = w.unit === "gal";
  const input = {
    people: readCount(q.people, (campConfig as CampConfig).camp.size ?? 20, 2000),
    days: readCount(q.days, eventDays(activeEvent.event), 30),
    perPersonPerDay: w.perPersonPerDay,
    unit: w.unit,
    kitchenPerDay: readCount(q.kitchen, gal ? 10 : 40, 5000),
    showersPerDay: readCount(q.showers, 0, 2000),
    perShower: gal ? 2 : 8,
    spare: 0.1,
  };
  const p = waterPlan(input);
  const u = gal ? "gallons" : "litres";
  const field = (name: keyof Query, label: string, value: number) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={value}
        className="min-h-11 rounded-lg border bg-background px-2"
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">Water plan</h1>
        <p className="text-sm text-muted-foreground">
          {activeEvent.words.name} guidance: {w.perPersonPerDay} {u} per person per day for drinking
          and cooking
          {"source" in w && w.source ? (
            <>
              {" "}
              (
              <a href={w.source} className="underline" target="_blank" rel="noreferrer">
                source
              </a>
              )
            </>
          ) : null}
          . Change the numbers and press Work it out.
        </p>
      </div>
      <form
        method="get"
        className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      >
        {field("people", "People", input.people)}
        {field("days", "Days on site", input.days)}
        {field("kitchen", `Kitchen ${u} a day`, input.kitchenPerDay)}
        {field("showers", "Showers a day (whole camp)", input.showersPerDay)}
        <button type="submit" className="col-span-2 min-h-11 rounded-lg border font-semibold">
          Work it out
        </button>
      </form>
      <section className="rounded-2xl border bg-card p-4" aria-label="Water needed">
        <h2 className="heading text-sm">
          Bring {p.total.toLocaleString("en-US")} {u}
        </h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          <li>
            Drinking and cooking: {p.drinking.toLocaleString("en-US")} {u}
          </li>
          <li>
            Kitchen: {p.kitchen.toLocaleString("en-US")} {u}
          </li>
          <li>
            Showers: {p.showers.toLocaleString("en-US")} {u}
          </li>
          <li>
            10% spare: {p.spare.toLocaleString("en-US")} {u}
          </li>
        </ul>
        <p className="mt-2 text-sm">
          That's about <b>{p.small.count}</b> {p.small.label}, or <b>{p.large.count}</b>{" "}
          {p.large.label}.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gray water to evaporate or haul out: about {p.gray.toLocaleString("en-US")} {u}. Never
          dump it on the ground.
        </p>
      </section>
    </div>
  );
}
