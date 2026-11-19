import { can, type ModuleContext } from "@/base/api";
import { EVENT } from "@/lib/event";
import {
  EARLY_LABEL,
  gateMissing,
  PASS_LABEL,
  summarize,
  TICKET_LABEL,
  TICKET_STATES,
} from "../../rules/gate";
import { campTickets, getAllocations, myTickets } from "../../server/queries";
import { AllocationsForm, MyTicketsForm } from "../components/forms";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const personId = ctx.actor.personId;
  const mine = personId ? await myTickets(ctx.db, ctx.edition.id, personId) : null;
  const manager = can(ctx.actor, "tickets.manage");
  const early = EVENT.words.earlyPass;
  const missing = mine ? gateMissing(mine) : [];
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Tickets and passes</h1>
      {mine ? (
        <section className="rounded-2xl border bg-card p-4" aria-label="Yours">
          <h2 className="font-semibold">Yours</h2>
          <p className="mt-1 text-sm">
            {missing.length === 0
              ? "Gate-ready: you have everything you need to get in."
              : `Not Gate-ready yet: still need a ${missing.join(", ")}.`}
          </p>
          <MyTicketsForm initial={mine} earlyPass={early} />
        </section>
      ) : null}
      {manager ? <CampBoard ctx={ctx} early={early} /> : null}
    </main>
  );
}

async function CampBoard({ ctx, early }: { ctx: ModuleContext; early: string }) {
  const [rows, alloc] = await Promise.all([
    campTickets(ctx.db, ctx.edition.id),
    getAllocations(ctx.db, ctx.edition.id),
  ]);
  const s = summarize(rows, alloc);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4" aria-label="Camp board">
      <h2 className="font-semibold">Camp board</h2>
      <ul className="grid grid-cols-2 gap-2 text-sm" aria-label="Summary">
        <li>
          Gate-ready: <b>{s.gateReady}</b> of {s.people}
        </li>
        <li>
          Stewards tickets left to offer: <b>{s.stewardsLeft}</b> of {alloc.stewards}
        </li>
        <li>
          Vehicle passes still needed: <b>{s.vehiclePassesNeeded}</b>
        </li>
        <li>
          {early} requests waiting: <b>{s.earlyRequested}</b> ({s.earlyLeft} left)
        </li>
        {TICKET_STATES.map((t) => (
          <li key={t}>
            {TICKET_LABEL[t]}: <b>{s.ticket[t]}</b>
          </li>
        ))}
      </ul>
      <AllocationsForm initial={alloc} earlyPass={early} />
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Who</th>
            <th>Ticket</th>
            <th>Vehicle</th>
            <th>{early}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.personId} className="border-t">
              <td>{r.name}</td>
              <td>{TICKET_LABEL[r.ticket]}</td>
              <td>{PASS_LABEL[r.vehiclePass]}</td>
              <td>{EARLY_LABEL[r.earlyArrival]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
