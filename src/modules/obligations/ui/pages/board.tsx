import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import {
  AUTHORITY_LABEL,
  boardCounts,
  dueLabel,
  obligationState,
  sortForBoard,
} from "../../rules/status";
import { listObligations, type ObligationRow } from "../../server/queries";
import { DueText, StateChip } from "../components/chip";

const due = (r: ObligationRow) => dueLabel(r.dueAt, r.dateConfirmed, r.previousYearDate);

function Card({ r, now }: { r: ObligationRow; now: Date }) {
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/obligations/${r.taskId}`}
          className="font-medium underline [overflow-wrap:anywhere]"
        >
          {r.title}
        </Link>
        <StateChip state={obligationState(r, now)} />
      </div>
      <p className="mt-1 text-sm">
        <DueText {...due(r)} /> · {AUTHORITY_LABEL[r.authority]} · {r.ownerName ?? "No owner yet"}
      </p>
    </li>
  );
}

/** Members: phone-first cards. Managers on a laptop: counts + a full table (night theme). */
export async function BoardPage({ ctx }: { ctx: ModuleContext }) {
  const rows = sortForBoard(await listObligations(ctx.db, ctx.edition.id), ctx.now);
  const manager = can(ctx.actor, "obligations.manage");
  const mine = rows.filter((r) => r.ownerPersonId && r.ownerPersonId === ctx.actor.personId);
  const counts = boardCounts(rows, ctx.now);
  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-sunset p-4 text-white lg:bg-none lg:p-0 lg:text-foreground">
        <h1 className="heading text-lg">AfrikaBurn deadlines</h1>
        <p className="text-sm opacity-90">
          What the camp owes AfrikaBurn and others for {ctx.edition.year}. “TBC” dates are last
          year’s until AfrikaBurn publishes the new ones.
        </p>
      </header>

      {manager ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Summary">
          {(
            [
              ["Late", counts.late],
              ["Due in 14 days", counts.due_soon],
              ["No owner", counts.no_owner],
              ["Submitted", `${counts.done}/${counts.total}`],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-2xl border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-wordmark text-3xl">{n}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {mine.length ? (
        <section aria-labelledby="mine" className="flex flex-col gap-2">
          <h2 id="mine" className="heading text-sm">
            Yours ({mine.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {mine.map((r) => (
              <Card key={r.taskId} r={r} now={ctx.now} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="all" className="flex flex-col gap-2">
        <h2 id="all" className="heading text-sm">
          All camp deadlines ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deadlines yet.</p>
        ) : null}
        <ul className={`flex flex-col gap-2 ${manager ? "lg:hidden" : ""}`}>
          {rows.map((r) => (
            <Card key={r.taskId} r={r} now={ctx.now} />
          ))}
        </ul>
        {manager ? (
          <table className="hidden w-full border-collapse overflow-hidden rounded-2xl bg-card text-sm lg:table">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                {["Obligation", "Status", "Due", "Owner", "Authority", "Docs", "Source"].map(
                  (h) => (
                    <th key={h} className="border-b p-2">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.taskId} className="border-b last:border-0">
                  <td className="p-2">
                    <Link
                      href={`/obligations/${r.taskId}`}
                      className="font-medium underline [overflow-wrap:anywhere]"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-2">
                    <StateChip state={obligationState(r, ctx.now)} />
                  </td>
                  <td className="p-2">
                    <DueText {...due(r)} />
                  </td>
                  <td className="p-2">{r.ownerName ?? "—"}</td>
                  <td className="p-2">{AUTHORITY_LABEL[r.authority]}</td>
                  <td className="p-2">{r.documentCount || "—"}</td>
                  <td className="p-2">
                    {r.sourceUrl ? (
                      <a href={r.sourceUrl} className="underline" rel="noreferrer" target="_blank">
                        Rules
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
