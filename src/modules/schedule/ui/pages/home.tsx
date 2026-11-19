import { can, type ModuleContext } from "@/base/api";
import { activeEvent } from "@/lib/active-packs";
import { formatCampDay, formatCampTime, instantToCampInput } from "@/lib/dates";
import { CATEGORY_LABEL, clashes, toCsv } from "../../rules/schedule";
import { listEvents, type ScheduleRow } from "../../server/queries";
import { AddEventForm, RemoveButton } from "../components/forms";

function byDay(rows: readonly ScheduleRow[]) {
  const days: { key: string; rows: ScheduleRow[] }[] = [];
  for (const r of rows) {
    const key = instantToCampInput(r.startsAt).date;
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(r);
    else days.push({ key, rows: [r] });
  }
  return days;
}

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listEvents(ctx.db, ctx.edition.id);
  const manager = can(ctx.actor, "schedule.manage");
  const clash = manager ? clashes(rows) : [];
  const title = (id: string) => rows.find((r) => r.id === id)?.title ?? "";
  const csv = manager
    ? toCsv(
        rows.map((r) => ({
          title: r.title,
          description: r.description,
          category: r.category,
          date: instantToCampInput(r.startsAt).date,
          start: instantToCampInput(r.startsAt).time,
          end: instantToCampInput(r.endsAt).time,
          location: r.location,
        })),
      )
    : "";
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <p className="text-sm text-muted-foreground">
        What the camp offers to the city, and when. {rows.length} events.
      </p>
      {manager ? <AddEventForm firstDay={activeEvent.event?.start} /> : null}
      {clash.length ? (
        <section role="alert" className="rounded-2xl border bg-card p-4 text-sm">
          <b>Overlaps to fix:</b>
          <ul className="list-disc pl-5">
            {clash.map(([a, b]) => (
              <li key={`${a}-${b}`}>
                {title(a)} and {title(b)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {byDay(rows).map((d) => (
        <section key={d.key} className="rounded-2xl border bg-card p-4" aria-label={d.key}>
          <h2 className="font-semibold">
            {formatCampDay(new Date(`${d.key}T12:00:00Z`), "EEEE d MMM")}
          </h2>
          <ul className="mt-1 flex flex-col">
            {d.rows.map((r) => (
              <li key={r.id} className="border-b py-2 text-sm last:border-0">
                <b>{r.title}</b> · {formatCampTime(r.startsAt, "HH:mm")}–
                {formatCampTime(r.endsAt, "HH:mm")}
                <span className="block text-xs text-muted-foreground">
                  {CATEGORY_LABEL[r.category]} · {r.location}
                  {r.host ? ` · hosted by ${r.host}` : ""}
                </span>
                {r.description ? <span className="block">{r.description}</span> : null}
                {manager ? <RemoveButton id={r.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {manager && rows.length ? (
        <a
          className="text-sm font-semibold underline"
          download="camp-schedule.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
        >
          Download the schedule for the event guide (CSV)
        </a>
      ) : null}
    </main>
  );
}
