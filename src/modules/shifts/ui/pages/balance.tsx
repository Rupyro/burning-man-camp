import Link from "next/link";
import type { ModuleContext } from "@/base/api";
import { campBalance } from "../../server/queries";

/** Participation balance (plan Phase 4): who has planned enough, for duty and camp leads. */
export async function BalancePage({ ctx }: { ctx: ModuleContext }) {
  const rows = (await campBalance(ctx.db, ctx.edition.id)) ?? [];
  const behind = rows.filter((r) => !r.enough);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="heading text-lg">Participation balance</h1>
      <p className="text-sm text-muted-foreground">
        {behind.length} of {rows.length} confirmed members haven't planned enough yet. Planned
        shifts and pre-Burn credit count; leads mark shifts done at camp.
      </p>
      <section className="rounded-2xl border bg-card p-4" aria-label="Members">
        <ul className="flex flex-col">
          {[...behind, ...rows.filter((r) => r.enough)].map((r) => (
            <li key={r.personId} className="border-b py-2 text-sm last:border-0">
              <b>{r.name}</b> · {r.enough ? "on track" : "needs more"}
              <span className="block text-xs text-muted-foreground">
                Duty {r.c.dutyHoursPlanned + r.c.precreditHours} of {r.c.minDutyHours} hours planned
                ({r.c.dutyHoursDone} done) · build and strike {r.c.buildStrikeDaysPlanned} of{" "}
                {r.c.minBuildStrikeDays} days
              </span>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/shifts" className="text-sm underline">
        Back to shifts
      </Link>
    </div>
  );
}
