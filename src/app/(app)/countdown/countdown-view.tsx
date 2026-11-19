import Link from "next/link";
import { countdown } from "@/base/landing/home-rules";
import { countdownNote, thisWeek } from "@/lib/countdown-week";
import { formatCampDay } from "@/lib/dates";

type Anchor = {
  key: string;
  label: string;
  startsAt: Date;
  endsAt: Date | null;
  isConfirmed: boolean;
};

/** Countdown: days to build and to the burn, this week's jobs, then the dates ahead. */
export function CountdownView({ anchors, now }: { anchors: Anchor[]; now: Date }) {
  const { build, gates } = countdown(anchors, now);
  const shown = anchors.filter((a) => ["build_start", "event_start"].includes(a.key));
  const year = (build?.at ?? gates?.at ?? now).getUTCFullYear();
  const note = countdownNote(shown.length > 0 && shown.every((a) => a.isConfirmed), year);
  const todos = thisWeek(build ? build.days : null);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="heading text-lg">Countdown</h1>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {build || gates ? (
        <div className="grid grid-cols-2 gap-2">
          {[
            { part: build, label: "days to build" },
            { part: gates, label: "days to the burn" },
          ].map(({ part, label }) =>
            part ? (
              <div key={label} className="rounded-2xl border bg-card p-4 text-center">
                <p className="heading text-4xl leading-none">{part.days}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {label}
                  <br />
                  <b className="text-foreground">{formatCampDay(part.at, "EEE d MMM")}</b>
                </p>
              </div>
            ) : null,
          )}
        </div>
      ) : (
        <p className="rounded-2xl border bg-card p-4 text-sm">
          No dates yet. A lead will add them.
        </p>
      )}
      <Link href="/year" className="text-sm font-semibold underline">
        The whole year: every event deadline
      </Link>
      <Link href="/water" className="text-sm font-semibold underline">
        Water plan: how much the camp brings
      </Link>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="heading text-sm">What to do this week</h2>
        <ul className="mt-2 flex flex-col">
          {todos.map((t) => (
            <li key={t.key} className="border-b py-2 last:border-0">
              <Link href={t.href} className="font-semibold underline">
                {t.title}
              </Link>
              <span className="block text-xs text-muted-foreground">{t.note}</span>
            </li>
          ))}
        </ul>
      </section>
      {anchors.length ? (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="heading text-sm">The weeks ahead</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {anchors.map((a) => (
              <li key={a.key} className="flex justify-between gap-3">
                <span>{a.label}</span>
                <b>
                  {formatCampDay(a.startsAt, "EEE d MMM")}
                  {a.isConfirmed ? "" : " · TBC"}
                </b>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {note ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          {note}. A lead will update them once they're set.
        </p>
      ) : null}
    </div>
  );
}
