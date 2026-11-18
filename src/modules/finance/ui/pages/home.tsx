import Link from "next/link";
import { can, type ModuleContext } from "@/base/api";
import { REASON_LABEL } from "../../rules/decision-reasons";
import { formatRand } from "../../rules/money";
import { nextStepText } from "../../rules/status";
import {
  autoApprovedSince,
  inboxFor,
  reasonCounts,
  summaryFor,
  teamsOf,
  visibleRequests,
} from "../../server/queries";
import { BudgetCard, RequestCard, RequestSteps, StatusChip } from "../components/bits";
import { BudgetForm, CsvButton } from "../components/lead-forms";

/** Members: phone-first cards. Leads on a laptop: counters, team budgets and a requests table. */
const DECIDED: Record<string, string> = {
  approved: "approved",
  rejected: "turned down",
  needs_info: "sent back",
};

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const me = ctx.actor.personId;
  const weekAgo = new Date(ctx.now.getTime() - 7 * 86_400_000);
  const [inbox, visible, summary, myTeams, reasons, small] = await Promise.all([
    inboxFor(ctx.db, ctx.edition.id, ctx.actor),
    visibleRequests(ctx.db, ctx.edition.id, ctx.actor),
    summaryFor(ctx.db, ctx.edition.id), // shown to leads only (F2)
    teamsOf(ctx.db, ctx.actor),
    can(ctx.actor, "finance.manage") ? reasonCounts(ctx.db, ctx.edition.id) : Promise.resolve([]),
    autoApprovedSince(ctx.db, ctx.edition.id, ctx.actor, weekAgo),
  ]);
  const mine = visible.filter((r) => r.requesterPersonId === me);
  const lead = can(ctx.actor, "finance.report.view");
  const money = can(ctx.actor, "finance.manage");
  const others = visible.filter((r) => r.requesterPersonId !== me);
  const t = summary.total;
  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl bg-sunset p-4 text-white lg:bg-none lg:p-0 lg:text-foreground">
        <h1 className="heading text-lg">Money</h1>
        <p className="text-sm opacity-90">
          {lead
            ? `Team budgets for ${ctx.edition.year}, what you’ve asked to spend, and what’s waiting on you.`
            : "What you’ve asked to spend, and where each request is."}
        </p>
        {myTeams.length ? (
          <Link
            href="/finance/new"
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold text-earth lg:bg-primary lg:text-primary-foreground"
          >
            Request money
          </Link>
        ) : null}
      </header>
      {myTeams.length ? <RequestSteps /> : null}

      {lead ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Camp totals">
          {(
            [
              ["Budget", t.budgetCents],
              ["Spent", t.actualCents],
              ["Approved, not bought", t.committedCents],
              ["Left", t.remainingCents],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="rounded-2xl border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-wordmark text-2xl">{formatRand(n)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {inbox.length ? (
        <section aria-labelledby="inbox" className="flex flex-col gap-2">
          <h2 id="inbox" className="heading text-sm">
            Waiting for you ({inbox.length})
          </h2>
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {inbox.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ) : null}

      {small.items.length ? (
        <section
          aria-labelledby="small"
          className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
        >
          <h2 id="small" className="heading text-sm">
            Approved this week without you
          </h2>
          <p className="text-sm text-muted-foreground">
            These were under the small-request limit, so they were approved straight away. You can
            still question any of them.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {small.items.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <Link href={`/finance/r/${r.id}`} className="underline-offset-4 hover:underline">
                  {r.title}, {r.requesterName}
                </Link>
                <span className="font-semibold">{formatRand(r.estimatedCents)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold">Total {formatRand(small.totalCents)}</p>
          {can(ctx.actor, "admin.settings") ? (
            <Link
              href="/settings"
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              Change the limit
            </Link>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="mine" className="flex flex-col gap-2">
        <h2 id="mine" className="heading text-sm">
          Your requests ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Ask when your team needs to buy something.
          </p>
        ) : null}
        <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2">
          {mine.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </ul>
      </section>

      {lead ? (
        <section aria-labelledby="budgets" className="flex flex-col gap-2">
          <h2 id="budgets" className="heading text-sm">
            Camp budget by team
          </h2>
          <ul className="flex flex-col gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {summary.rows.map((row) => (
              <BudgetCard key={row.teamId} row={row} />
            ))}
          </ul>
        </section>
      ) : null}

      {money && reasons.length ? (
        <section aria-labelledby="reasons" className="flex flex-col gap-2">
          <h2 id="reasons" className="heading text-sm">
            Decisions by reason
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {reasons.map((x) => (
              <li
                key={`${x.status}-${x.reasonCode}`}
                className="rounded-2xl border bg-card px-3 py-2"
              >
                {x.count} {DECIDED[x.status] ?? x.status}:{" "}
                {x.reasonCode ? REASON_LABEL[x.reasonCode] : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lead && others.length ? (
        <section aria-labelledby="all" className="flex flex-col gap-2">
          <h2 id="all" className="heading text-sm">
            {money ? "All requests" : "Your teams’ requests"} ({others.length})
          </h2>
          <ul className="flex flex-col gap-2 lg:hidden">
            {others.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </ul>
          <table className="hidden w-full border-collapse overflow-hidden rounded-2xl bg-card text-sm lg:table">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                {["Ref", "What", "Team", "Asked by", "Amount", "Status", "Next"].map((h) => (
                  <th key={h} className="border-b p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {others.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-2 font-mono">{r.refCode}</td>
                  <td className="max-w-xs p-2">
                    <Link
                      href={`/finance/r/${r.id}`}
                      title={r.title}
                      className="line-clamp-2 font-medium underline [overflow-wrap:anywhere]"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="p-2">{r.teamName}</td>
                  <td className="p-2">{r.requesterName}</td>
                  <td className="p-2 text-right font-semibold">{formatRand(r.estimatedCents)}</td>
                  <td className="p-2">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="p-2 text-xs">{nextStepText(r.status, r.waitingOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {money ? (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
          <BudgetForm teams={summary.rows.map((r) => ({ id: r.teamId, name: r.teamName }))} />
          <CsvButton />
        </section>
      ) : null}
    </div>
  );
}
