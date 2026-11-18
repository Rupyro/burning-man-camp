import { can, type ModuleContext } from "@/base/api";
import { formatCampDay } from "@/lib/dates";
import { formatRand } from "../../rules/money";
import { listFees } from "../../server/fee-queries";
import { RecordFeeButton } from "../components/fee-actions";

/** Camp fees (applicants spec §6): who owes, who paid. Recording a payment can make someone join. */
export async function FeesPage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listFees(ctx.db, ctx.edition.id);
  const due = rows.filter((r) => r.status === "due");
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="heading text-lg">Camp fees</h1>
        <p className="text-sm text-muted-foreground">
          Fees appear when a lead accepts an applicant. Payment happens outside the app; record it
          here once it has arrived. Demo: no real money moves.
        </p>
      </header>
      <p className="text-sm font-semibold">
        {due.length} due · {formatRand(due.reduce((a, r) => a + r.amountCents, 0))} outstanding
      </p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">No camp fees yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3 text-sm"
            >
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRand(r.amountCents)} ·{" "}
                  {r.status === "paid" && r.paidAt
                    ? `Paid ${formatCampDay(r.paidAt, "d MMM yyyy")}`
                    : r.status === "waived"
                      ? "Waived"
                      : "Due"}
                </span>
              </span>
              {r.status === "due" &&
              can(ctx.actor, "finance.fees.manage", { personId: r.personId }) ? (
                <RecordFeeButton id={r.id} name={r.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
