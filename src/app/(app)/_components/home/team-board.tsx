import Link from "next/link";
import { dueChip } from "@/base/landing/home-rules";
import { formatCampDay } from "@/lib/dates";
import { Section } from "./blocks";
import { Chip } from "./chip";

type Board = NonNullable<Awaited<ReturnType<typeof import("@/base/landing/home").getTeamBoard>>>;

/** Leads (spec B3 §4): late/blocked work in my teams, and readiness by project. */
export function TeamBoard({ board, now }: { board: Board; now: Date }) {
  const teams = board.teams.length > 2 ? "All teams" : board.teams.join(" & ");
  return (
    <div className="flex flex-col gap-6">
      <Section
        id="team"
        title={
          <>
            My team: <span className="text-accent">{teams}</span> — late &amp; blocked
          </>
        }
      >
        {board.problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing late or blocked. Nice.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium">Task</th>
                  <th className="p-2 font-medium">Owner</th>
                  <th className="hidden p-2 font-medium sm:table-cell">Project</th>
                  <th className="hidden p-2 font-medium sm:table-cell">Due</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {board.problems.map((t) => {
                  const chip = dueChip(t.dueAt, now);
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {t.title}
                        </Link>
                      </td>
                      <td className="p-2">{t.ownerName ?? "Nobody yet"}</td>
                      <td className="hidden p-2 sm:table-cell">{t.projectName}</td>
                      <td className="hidden p-2 sm:table-cell">
                        {t.dueAt ? formatCampDay(t.dueAt) : "—"}
                      </td>
                      <td className="p-2">
                        {t.status === "blocked" ? (
                          <Chip tone="blocked">
                            Blocked{t.blockedReason ? `: ${t.blockedReason}` : ""}
                          </Chip>
                        ) : chip ? (
                          <Chip tone="late">{chip.label}</Chip>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Link
          href="/reminders"
          className="min-h-11 self-start py-2 text-sm font-semibold underline"
        >
          Team reminders: what's due and nudge people
        </Link>
      </Section>
      <Section id="readiness" title="Readiness by project">
        <ul className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          {board.projects.map((p) => (
            <li key={p.id} className="text-sm">
              <span className="flex justify-between">
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
                <span>{p.percent}%</span>
              </span>
              <span
                className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${p.name} readiness`}
                aria-valuenow={p.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-bar-from to-bar-to"
                  style={{ width: `${p.percent}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
