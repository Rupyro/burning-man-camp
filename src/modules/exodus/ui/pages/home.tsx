import { can, type ModuleContext } from "@/base/api";
import { campConfig } from "@/lib/camp";
import type { CampConfig } from "@/lib/camp-config";
import { formatCampDay, formatCampTime, instantToCampInput } from "@/lib/dates";
import { byDay, sweepCrew } from "../../rules/exodus";
import { listDepartures } from "../../server/queries";
import { DepartureForm } from "../components/forms";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listDepartures(ctx.db, ctx.edition.id);
  const manager = can(ctx.actor, "exodus.manage");
  const list = rows.map((r) => ({ ...r, day: instantToCampInput(r.departsAt).date }));
  const size = (campConfig as CampConfig).camp.size ?? rows.length;
  const crew = sweepCrew(list, size);
  const mine = rows.find((r) => r.personId === ctx.actor.personId);
  const initial = mine
    ? {
        ...instantToCampInput(mine.departsAt),
        staysForSweep: mine.staysForSweep,
        travel: mine.travel,
      }
    : null;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Exodus</h1>
      <p className="text-sm text-muted-foreground">
        Who leaves when, so camp isn't left half-packed. {rows.length} of {size} set.
      </p>
      {ctx.actor.personId ? <DepartureForm initial={initial} /> : null}
      <section className="rounded-2xl border bg-card p-4" aria-label="Sweep crew">
        <h2 className="font-semibold">Final sweep crew</h2>
        <p className="text-sm">
          {crew.staying.length} staying ({crew.wanted} wanted)
          {crew.staying.length ? `: ${crew.staying.join(", ")}` : ""}.
        </p>
        {manager && crew.short ? (
          <p role="alert" className="text-sm font-semibold">
            {crew.short} more needed to stay for the line sweep.
          </p>
        ) : null}
      </section>
      {byDay(list).map((d) => (
        <section key={d.day} className="rounded-2xl border bg-card p-4" aria-label={d.day}>
          <h2 className="font-semibold">
            {formatCampDay(new Date(`${d.day}T12:00:00Z`), "EEEE d MMM")} · {d.rows.length} leaving
          </h2>
          <ul className="mt-1 flex flex-col">
            {d.rows.map((r) => (
              <li key={r.personId} className="border-b py-2 text-sm last:border-0">
                <b>{r.name}</b> · {formatCampTime(r.departsAt, "HH:mm")}
                {r.staysForSweep ? " · sweep crew" : ""}
                {manager && r.travel ? (
                  <span className="block text-xs text-muted-foreground">{r.travel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
