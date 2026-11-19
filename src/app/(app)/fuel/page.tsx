import { activeEvent } from "@/lib/active-packs";
import { fuelPlan, readAmount } from "@/lib/fuel-plan";
import { eventDays, readCount } from "@/lib/water-plan";
import { basePage } from "../_components/base-page";

type Query = { generators?: string; hours?: string; rate?: string; days?: string };

/** Fuel plan (plan Phase 6): generator fuel for the event, in cans, against the storage limit. */
export default async function FuelPage(props: { searchParams: Promise<Query> }) {
  await basePage(async () => null);
  const q = await props.searchParams;
  const f = activeEvent.fuel;
  const unit = f?.unit ?? (activeEvent.water?.unit === "L" ? "L" : "gal");
  const gal = unit === "gal";
  const input = {
    generators: readCount(q.generators, 1, 50),
    hoursPerDay: readCount(q.hours, 8, 24),
    perHour: readAmount(q.rate, gal ? 0.3 : 1.1, 50),
    days: readCount(q.days, eventDays(activeEvent.event), 30),
    unit,
    spare: 0.1,
    maxFill: f?.maxFill ?? 0.8,
  } as const;
  const p = fuelPlan(input, f?.storageLimit);
  const u = gal ? "gallons" : "litres";
  const n = (v: number) => v.toLocaleString("en-US");
  const field = (name: keyof Query, label: string, value: number, step = "1") => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        step={step}
        defaultValue={value}
        className="min-h-11 rounded-lg border bg-background px-2"
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">Fuel plan</h1>
        <p className="text-sm text-muted-foreground">
          Generator fuel for {activeEvent.words.name}. Take the burn rate from your generator's
          manual at the load you expect. Change the numbers and press Work it out.
        </p>
      </div>
      <form
        method="get"
        className="grid grid-cols-2 items-end gap-2 rounded-2xl border bg-card p-4"
      >
        {field("generators", "Generators", input.generators)}
        {field("hours", "Hours a day each", input.hoursPerDay)}
        {field("rate", `${gal ? "Gallons" : "Litres"} an hour each`, input.perHour, "0.05")}
        {field("days", "Days on site", input.days)}
        <button type="submit" className="col-span-2 min-h-11 rounded-lg border font-semibold">
          Work it out
        </button>
      </form>
      <section className="rounded-2xl border bg-card p-4" aria-label="Fuel needed">
        <h2 className="heading text-sm">
          Bring {n(p.total)} {u}
        </h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          <li>
            Running the generators: {n(p.burn)} {u}
          </li>
          <li>
            10% spare: {n(p.spare)} {u}
          </li>
        </ul>
        <p className="mt-2 text-sm">
          That's <b>{p.can.count}</b> {p.can.label}, each filled to {n(p.can.holds)} {unit} (
          {Math.round(input.maxFill * 100)}%) to leave room for the heat.
        </p>
        {f ? (
          <p className={`mt-2 text-sm ${p.overLimit ? "font-semibold text-destructive" : ""}`}>
            {p.overLimit
              ? `More than the ${n(f.storageLimit)} ${u} a camp may store at once. Plan refills or a fuel delivery during the week instead of bringing it all.`
              : `Within the ${n(f.storageLimit)} ${u} a camp may store at once.`}{" "}
            Store it in secondary containment, away from generators, tents and shade.{" "}
            <a href={f.source} className="underline" target="_blank" rel="noreferrer">
              Fuel storage rules
            </a>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Check the event's own fuel storage rules before you pack.
          </p>
        )}
      </section>
    </div>
  );
}
