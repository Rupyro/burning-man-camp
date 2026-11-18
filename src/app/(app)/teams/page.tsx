import Link from "next/link";
import { getNow } from "@/base/guard/request";
import { noticeEndChoices } from "@/base/teams/notice-choices";
import { noticesForLead } from "@/base/teams/notices";
import { listTeams } from "@/base/teams/teams";
import { formatCampDay } from "@/lib/dates";
import { basePage } from "../_components/base-page";
import { EndNoticeButton, NoticeComposer } from "../_components/team-notice";

const when = (at: Date) => formatCampDay(at, "EEE d MMM, HH:mm");

export default async function TeamsPage() {
  const now = getNow();
  const [teams, led] = await basePage((ctx) =>
    Promise.all([listTeams(ctx), noticesForLead({ ...ctx, now })]),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Teams</h1>
      {led.length ? (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Team notice</h2>
          <p className="text-sm text-muted-foreground">
            Your team sees it at the top of every page until the time you pick, or until they tap
            "Got it".
          </p>
          <NoticeComposer
            teams={led.map((t) => ({ id: t.id, name: t.name }))}
            choices={noticeEndChoices(now)}
          />
          {led.flatMap((t) =>
            t.notices.map((n) => {
              const read = n.readers.filter((r) => r.readAt);
              return (
                <article key={n.id} className="flex flex-col gap-2 border-t pt-3">
                  <p className="font-medium">{n.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {led.length > 1 ? `${t.name} · ` : ""}
                    {n.ended ? `Ended ${when(n.endsAt)}` : `Showing until ${when(n.endsAt)}`} ·
                    posted by {n.authorName}
                  </p>
                  {n.ended ? null : <EndNoticeButton noticeId={n.id} />}
                  <details>
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
                      Read by {read.length} of {n.readers.length}
                    </summary>
                    <ul className="flex flex-col gap-1 text-sm">
                      {n.readers.map((r) => (
                        <li key={r.name} className="flex justify-between gap-3">
                          <span>{r.name}</span>
                          <span className={r.readAt ? "" : "text-muted-foreground"}>
                            {r.readAt ? `✓ ${when(r.readAt)}` : "Not yet"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            }),
          )}
        </section>
      ) : null}
      <ul className="flex flex-col gap-3">
        {teams.map((t) => (
          <li key={t.id} className="rounded-2xl border bg-card p-3">
            <h2 className="font-medium">{t.name}</h2>
            {t.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody yet.</p>
            ) : (
              <p className="text-sm">
                {t.members.map((m, i) => (
                  <span key={m.personId}>
                    {i ? ", " : ""}
                    <Link
                      href={`/people/${m.personId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {m.displayName}
                    </Link>
                    {m.role === "member" ? "" : ` (${m.role.replace("_", "-")})`}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
