import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { formatCampDay, instantToCampInput } from "@/lib/dates";
import { NEXT_LABEL, REASON_LABEL } from "../../rules/decision-reasons";
import { formatRand } from "../../rules/money";
import { approverText, canCancel, canEdit, nextStepText } from "../../rules/status";
import { budgetChoices, expenseOf, getRequest, stepsOf } from "../../server/queries";
import { StatusChip } from "../components/bits";
import { RequestForm } from "../components/forms";
import {
  DecisionForm,
  ExpenseForm,
  RequesterButtons,
  ResubmitButton,
  SettleForm,
} from "../components/request-actions";

const DECISION = {
  approved: "approved",
  rejected: "turned it down",
  needs_info: "sent it back",
} as const;
const PAID_WITH = {
  personal: "own money",
  camp_card: "camp card",
  camp_cash: "camp cash",
  supplier_invoice: "supplier invoice",
} as const;

export async function DetailPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getRequest(ctx.db, ctx.edition.id, id);
  if (
    !r ||
    !can(ctx.actor, "finance.spend.view", { requesterId: r.requesterPersonId, teamId: r.teamId })
  )
    notFound();
  const approver = r.waitingOn;
  const [steps, spent, budgets] = await Promise.all([
    stepsOf(ctx.db, r.id),
    expenseOf(ctx.db, r.id),
    budgetChoices(ctx.db, ctx.edition.id),
  ]);
  const lastRound = steps.at(-1)?.round;
  const round = steps.filter((s) => s.round === lastRound);
  const history = steps
    .flatMap((s) =>
      s.status !== "pending" && s.decidedAt
        ? [{ ...s, decidedAt: s.decidedAt, status: s.status }]
        : [],
    )
    .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime());
  const mine = r.requesterPersonId === ctx.actor.personId;
  const mayDecide =
    r.status === "submitted" &&
    can(ctx.actor, "finance.spend.approve", {
      approver: approver ?? "none",
      requesterId: r.requesterPersonId,
      teamId: r.teamId,
    });
  const owed = spent?.reimbursement?.status === "owed" ? spent.reimbursement : null;
  const maySettle =
    owed !== null && can(ctx.actor, "finance.manage", { payeeId: owed.payeePersonId });
  const cancelLabel = !mine
    ? null
    : r.status === "rejected"
      ? "Put it away"
      : canCancel(r.status)
        ? "Cancel request"
        : null;
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
      <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <Link href="/finance" className="text-sm underline">
          ← Money
        </Link>
        <div className="flex items-start justify-between gap-2">
          <h1 className="heading text-lg [overflow-wrap:anywhere]">{r.title}</h1>
          <StatusChip status={r.status} />
        </div>
        <p className="font-wordmark text-3xl">{formatRand(r.estimatedCents)}</p>
        <p className="text-sm font-semibold">{nextStepText(r.status, approver)}</p>
        {r.autoApproved ? (
          <p className="text-sm">
            Approved straight away because it's under the camp's small-request limit. Keep your
            receipt and add it when you get back.
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-mono">{r.refCode}</dd>
          <dt className="text-muted-foreground">Team</dt>
          <dd>{r.teamName}</dd>
          <dt className="text-muted-foreground">Asked by</dt>
          <dd>{r.requesterName}</dd>
          {r.supplierName ? (
            <>
              <dt className="text-muted-foreground">From</dt>
              <dd>{r.supplierName}</dd>
            </>
          ) : null}
          {r.neededBy ? (
            <>
              <dt className="text-muted-foreground">Needed by</dt>
              <dd>{r.neededBy}</dd>
            </>
          ) : null}
        </dl>
        {r.justification ? <p className="whitespace-pre-line text-sm">{r.justification}</p> : null}

        {round.length ? (
          <section>
            <h2 className="heading text-xs">Who says yes</h2>
            <ol className="flex flex-col gap-1 text-sm">
              {round.map((step, i) => {
                const now =
                  step.status === "pending" && round.findIndex((x) => x.status === "pending") === i;
                return (
                  <li key={step.id} className="flex gap-2">
                    <span aria-hidden>{step.status === "approved" ? "✓" : now ? "→" : "·"}</span>
                    <span>
                      {i + 1}. {approverText(step.approver)}
                      {now ? " (waiting)" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {history.length ? (
          <section>
            <h2 className="heading text-xs">What happened</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {history.map((h) => (
                <li key={h.id}>
                  <strong>{h.deciderName}</strong> {DECISION[h.status]} on{" "}
                  {formatCampDay(h.decidedAt)}
                  {h.reasonCode ? ` · ${REASON_LABEL[h.reasonCode]}` : ""}
                  {h.nextStep ? ` → ${NEXT_LABEL[h.nextStep]}` : ""}
                  {h.capAmountCents ? ` (${formatRand(h.capAmountCents)})` : ""}
                  {h.comment ? `: “${h.comment}”` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {spent ? (
          <section>
            <h2 className="heading text-xs">What it cost</h2>
            <p className="text-sm">
              {formatRand(spent.expense.amountCents)} on {spent.expense.spentOn},{" "}
              {PAID_WITH[spent.expense.paidWith]}.
              {spent.expense.receiptUrl ? (
                <>
                  {" "}
                  <a
                    href={spent.expense.receiptUrl}
                    className="underline"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Receipt
                  </a>
                </>
              ) : null}
            </p>
            {spent.reimbursement ? (
              <p className="text-sm">
                Pay-back:{" "}
                {spent.reimbursement.status === "owed" ? "owed" : spent.reimbursement.status}
                {spent.reimbursement.methodNote ? ` (${spent.reimbursement.methodNote})` : ""}
              </p>
            ) : null}
          </section>
        ) : null}
        {r.taskId && mine ? (
          <Link href={`/tasks/${r.taskId}`} className="text-sm underline">
            Open my task for this
          </Link>
        ) : null}
      </article>

      <aside className="flex flex-col gap-4">
        {mayDecide ? (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="heading mb-2 text-sm">Your call</h2>
            <DecisionForm
              id={r.id}
              estimatedCents={r.estimatedCents}
              currentBudgetId={r.budgetId}
              budgets={budgets.map((b) => ({ id: b.id, label: b.teamName ?? b.name }))}
            />
          </section>
        ) : null}
        {mine &&
        r.status === "rejected" &&
        (history.at(-1)?.nextStep === "resubmit_lower" ||
          history.at(-1)?.nextStep === "move_budget") ? (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="heading mb-2 text-sm">Try again</h2>
            <ResubmitButton id={r.id} />
          </section>
        ) : null}
        {mine && r.status === "approved" ? (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="heading mb-2 text-sm">Bought it?</h2>
            <ExpenseForm id={r.id} today={instantToCampInput(ctx.now).date} />
          </section>
        ) : null}
        {maySettle && owed ? (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="heading mb-2 text-sm">Pay back {formatRand(owed.amountCents)}</h2>
            <SettleForm reimbursementId={owed.id} />
          </section>
        ) : null}
        {mine && canEdit(r.status) ? (
          <section className="rounded-2xl border bg-card p-4">
            <h2 className="heading mb-2 text-sm">
              {r.status === "draft" ? "Edit draft" : "Answer and resend"}
            </h2>
            <RequestForm
              id={r.id}
              values={{
                title: r.title,
                amount: (r.estimatedCents / 100).toFixed(2),
                justification: r.justification ?? "",
                supplierName: r.supplierName ?? "",
                neededBy: r.neededBy ?? "",
              }}
            />
          </section>
        ) : null}
        {cancelLabel ? (
          <RequesterButtons id={r.id} canSubmit={false} cancelLabel={cancelLabel} />
        ) : null}
      </aside>
    </div>
  );
}
