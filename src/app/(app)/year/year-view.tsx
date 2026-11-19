import { MOOP_LABEL, STANDING_LABEL, type StandingYear } from "@/lib/camp-content";
import { formatCampDay } from "@/lib/dates";
import type { YearEntry, YearMonth } from "@/lib/year-calendar";
import { dayInstant, monthLabel } from "@/lib/year-calendar";

const STATE_LABEL: Record<YearEntry["state"], string | null> = {
  past: "Done",
  now: "On now",
  next: "Next",
  later: null,
};

function when(e: YearEntry): string {
  const start = formatCampDay(dayInstant(e.date), "EEE d MMM");
  const end = e.until ? ` – ${formatCampDay(dayInstant(e.until), "EEE d MMM")}` : "";
  return `${start}${end}${e.time ? `, ${e.time}` : ""}`;
}

/** The camp-lead year: every deadline and date from the event pack, month by month. */
export function YearView({
  eventName,
  year,
  months,
  standing,
}: {
  eventName: string;
  year: number;
  months: YearMonth[];
  /** Placement history, newest first; null hides it (camps that aren't placed). */
  standing: readonly StandingYear[] | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">
          The {eventName} {year} year
        </h1>
        <p className="text-sm text-muted-foreground">
          Every deadline a camp lead tracks, from the first form to the last report. "Last year's
          pattern" dates move once the event posts this year's.
        </p>
      </div>
      {standing ? (
        <section className="rounded-2xl border bg-card p-4" aria-label="Placement standing">
          <h2 className="heading text-sm">Placement standing</h2>
          {standing.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No history yet. A camp lead adds each year in camp-content/standing.ts after the
              Post-playa Report.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {standing.map((s) => (
                <li key={s.year} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <b>{s.year}</b> · {STANDING_LABEL[s.standing]}
                    {s.note ? (
                      <span className="block text-xs text-muted-foreground">{s.note}</span>
                    ) : null}
                  </span>
                  {s.moop ? <span className="text-xs">MOOP Map: {MOOP_LABEL[s.moop]}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {months.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">
          This event pack has no calendar yet. Dates appear here once it's filled in.
        </p>
      ) : (
        months.map((m) => (
          <section
            key={m.key}
            className="rounded-2xl border bg-card p-4"
            aria-label={monthLabel(m.key)}
          >
            <h2 className="heading text-sm">{monthLabel(m.key)}</h2>
            <ul className="mt-2 flex flex-col">
              {m.entries.map((e) => (
                <li
                  key={e.key}
                  className={`border-b py-2 last:border-0 ${e.state === "past" ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {e.label}
                      {STATE_LABEL[e.state] ? (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal">
                          {STATE_LABEL[e.state]}
                        </span>
                      ) : null}
                    </span>
                    <b className="text-sm">{when(e)}</b>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.detail}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.status === "official" ? "Official date" : "Last year's pattern"} ·{" "}
                    <a href={e.source} className="underline" target="_blank" rel="noreferrer">
                      source
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
