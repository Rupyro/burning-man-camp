import Link from "next/link";
import { notFound } from "next/navigation";
import { reminderTeams, teamReminders } from "@/base/engine/reminders";
import { formatCampDay } from "@/lib/dates";
import { basePage } from "../_components/base-page";
import { NudgeButton } from "./nudge-button";

const DAY = 86_400_000;
const short = (name: string) => name.replace(/ \(demo.*\)$/, "");
function when(dueAt: Date | null, now: number) {
  if (!dueAt) return "No date";
  const d = Math.round((dueAt.getTime() - now) / DAY);
  if (d < 0) return `${-d} ${d === -1 ? "day" : "days"} late`;
  return d === 0 ? "Due today" : `Due in ${d} ${d === 1 ? "day" : "days"}`;
}

/** Team reminders (option A, 27 Oct 2026): by person, most late first; nudge = one alert. */
export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const want = (await searchParams).team;
  const data = await basePage(async (ctx) => {
    const teams = await reminderTeams(ctx);
    const team = teams.find((t) => t.key === want) ?? teams[0];
    return team ? { teams, me: ctx.actor.personId, view: await teamReminders(ctx, team.id) } : null;
  });
  if (!data) notFound();
  const { teams, me, view } = data;
  const now = Date.now();
  const all = view.people.flatMap((p) => p.tasks);
  const late = all.filter((t) => t.late).length;
  const soon = all.filter((t) => !t.late && t.dueAt && t.dueAt.getTime() < now + 14 * DAY).length;
  return (
    <div className="flex flex-col gap-5">
      <header className="bg-sunset rounded-2xl p-5">
        <h1 className="heading text-lg">{view.team.name}: what's due</h1>
        <p className="mt-1 text-sm">
          {late} late · {soon} due in the next 2 weeks. A nudge sends the person one alert; you can
          nudge again after 2 days.
        </p>
      </header>
      {teams.length > 1 ? (
        <nav aria-label="Team" className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/reminders?team=${t.key}`}
              aria-current={t.id === view.team.id ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-semibold aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {t.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {view.people.length === 0 ? (
        <p className="text-sm">Nobody in this team has open tasks with a date. Nice.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {view.people.map((p) => (
            <li key={p.personId} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="heading text-base">{short(p.name)}</span>
                  <span className="block text-sm">
                    {p.tasks.length} open{p.lateCount ? ` · ${p.lateCount} late` : ""}
                  </span>
                </span>
                {p.lateCount === 0 || p.personId === me ? null : p.nudgeAgainAt ? (
                  <span className="max-w-36 text-right text-xs">
                    Nudged · again from {formatCampDay(p.nudgeAgainAt, "EEE d MMM")}
                  </span>
                ) : (
                  <NudgeButton
                    teamId={view.team.id}
                    personId={p.personId}
                    name={short(p.name)}
                    late={p.lateCount}
                  />
                )}
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {p.tasks.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2 border-t pt-1">
                    <Link href={`/tasks/${t.id}`} className="[overflow-wrap:anywhere]">
                      {t.title}
                    </Link>
                    <span className={`shrink-0 ${t.late ? "font-semibold" : ""}`}>
                      {when(t.dueAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
