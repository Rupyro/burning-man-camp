import { can, type ModuleContext } from "@/base/api";
import { CAMP_TZ_LABEL, formatCampTime, instantToCampInput } from "@/lib/dates";
import { byNeighbor, inQuietHours } from "../../rules/sound";
import { getPlan, listLog } from "../../server/queries";
import { LogForm, PlanForm } from "../components/forms";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const [plan, log] = await Promise.all([
    getPlan(ctx.db, ctx.edition.id),
    listLog(ctx.db, ctx.edition.id),
  ]);
  const manager = can(ctx.actor, "sound.manage");
  const nowClock = instantToCampInput(ctx.now ?? new Date()).time;
  const quietNow = inQuietHours(nowClock, plan.quietFrom, plan.quietUntil);
  const top = byNeighbor(log).slice(0, 3);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Sound plan</h1>
      <section className="rounded-2xl border bg-card p-4" aria-label="The plan">
        <p className="text-sm">
          Quiet hours {plan.quietFrom}–{plan.quietUntil} {CAMP_TZ_LABEL}
          {quietNow ? " (quiet hours now)" : ""}. Keep it under {plan.maxDb} dB at the edge of camp.
        </p>
        {plan.speakersFace ? <p className="text-sm">Speakers face: {plan.speakersFace}</p> : null}
        {plan.notes ? <p className="text-sm text-muted-foreground">{plan.notes}</p> : null}
        {manager ? <PlanForm initial={plan} /> : null}
      </section>
      <section
        className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
        aria-label="Neighbor log"
      >
        <h2 className="font-semibold">Neighbor log ({log.length})</h2>
        <p className="text-sm text-muted-foreground">
          A neighbor came over about sound? Log it, and what we did. Be kind and act fast.
        </p>
        {top.length ? (
          <p className="text-sm">
            Most visits: {top.map((t) => `${t.neighbor} (${t.count})`).join(", ")}
          </p>
        ) : null}
        <ul className="flex flex-col">
          {log.map((e) => (
            <li key={e.id} className="border-b py-2 text-sm last:border-0">
              <b>{e.neighbor}</b> · {formatCampTime(e.at)}
              <span className="block">{e.what}</span>
              {e.action ? (
                <span className="block text-muted-foreground">We: {e.action}</span>
              ) : null}
              {e.loggedBy ? (
                <span className="block text-xs text-muted-foreground">Logged by {e.loggedBy}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <LogForm />
      </section>
    </main>
  );
}
