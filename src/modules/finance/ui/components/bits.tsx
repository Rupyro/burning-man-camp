import Link from "next/link";
import { budgetLine } from "../../rules/budget-line";
import { formatRand } from "../../rules/money";
import { nextStepText, type SpendStatus, STATUS_LABEL } from "../../rules/status";
import type { SummaryRow } from "../../rules/summary";

const TONE: Record<SpendStatus, string> = {
  draft: "border border-current",
  submitted: "bg-ochre text-earth",
  needs_info: "bg-rust text-white",
  approved: "bg-dusk text-white",
  rejected: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  purchased: "bg-clay text-earth",
  closed: "bg-clay text-earth",
};

export function StatusChip({ status }: { status: SpendStatus }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export interface RequestCardRow {
  id: string;
  refCode: string;
  title: string;
  teamName: string;
  estimatedCents: number;
  status: SpendStatus;
  /** Approver of the waiting step, or null when nothing waits. */
  waitingOn: string | null;
}

/** Phone-first card: ref + amount on top, what, team, and what happens next. */
export function RequestCard({ r }: { r: RequestCardRow }) {
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/finance/r/${r.id}`}
          title={r.title}
          className="line-clamp-2 min-w-0 font-medium underline [overflow-wrap:anywhere]"
        >
          {r.title}
        </Link>
        <StatusChip status={r.status} />
      </div>
      <p className="mt-1 text-sm">
        <span className="font-mono">{r.refCode}</span> ·{" "}
        <strong>{formatRand(r.estimatedCents)}</strong> · {r.teamName}
      </p>
      <p className="text-xs text-muted-foreground">{nextStepText(r.status, r.waitingOn)}</p>
    </li>
  );
}

/** One team's budget: remaining up top, a bar of spent / approved / free. Totals only, no names. */
export function BudgetCard({ row }: { row: SummaryRow }) {
  const pct = (n: number) => (row.budgetCents ? Math.min(100, (n / row.budgetCents) * 100) : 0);
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{row.teamName}</h3>
        <span className={row.overBudget ? "text-rust" : ""}>
          <span className="font-wordmark text-xl">{formatRand(row.remainingCents)}</span>{" "}
          <span className="text-xs font-semibold">{row.overBudget ? "over budget" : "left"}</span>
        </span>
      </div>
      <div
        className="mt-2 flex h-2 overflow-hidden rounded-full bg-clay/40"
        role="img"
        aria-label={`${formatRand(row.actualCents)} spent and ${formatRand(row.committedCents)} approved of ${formatRand(row.budgetCents)}`}
      >
        <span className="bg-dusk" style={{ width: `${pct(row.actualCents)}%` }} />
        <span className="bg-ochre" style={{ width: `${pct(row.committedCents)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{budgetLine(row)}</p>
    </li>
  );
}

/** The three steps of asking for money, shown on Money and on the request form. */
export function RequestSteps() {
  const steps = [
    ["Ask", "Say what you need, roughly what it costs and which team it’s for."],
    ["Get a yes", "Small amounts within budget go to your team lead; bigger ones go to finance."],
    [
      "Buy it and add the receipt",
      "You'll get a task to buy it and add the receipt; do it once it's approved.",
    ],
  ] as const;
  return (
    <ol aria-label="How asking for money works" className="grid gap-3 sm:grid-cols-3">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-3 rounded-2xl border bg-card p-3 text-sm">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <span>
            <b className="block">{title}</b>
            <span className="text-muted-foreground">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
