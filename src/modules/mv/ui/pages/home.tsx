import { can, type ModuleContext } from "@/base/api";
import { driverRoster } from "../../rules/mv";
import { listDrivers } from "../../server/queries";
import { ClearButton, OfferButton } from "../components/forms";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listDrivers(ctx.db, ctx.edition.id);
  const manager = can(ctx.actor, "mv.manage");
  const roster = driverRoster(rows);
  const offered = rows.some((r) => r.personId === ctx.actor.personId);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Art car drivers</h1>
      <p className="text-sm text-muted-foreground">
        Only cleared drivers drive the art car. {roster.cleared} cleared of {rows.length} offered.
      </p>
      {ctx.actor.personId ? <OfferButton offered={offered} /> : null}
      <section className="rounded-2xl border bg-card p-4" aria-label="Drivers">
        {roster.sorted.length ? (
          <ul className="flex flex-col">
            {roster.sorted.map((r) => (
              <li key={r.id} className="border-b py-2 text-sm last:border-0">
                <b>{r.name}</b> · {r.cleared ? "cleared" : "not cleared yet"}
                {r.note ? (
                  <span className="block text-xs text-muted-foreground">{r.note}</span>
                ) : null}
                {manager ? <ClearButton id={r.id} cleared={r.cleared} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody has offered yet.</p>
        )}
      </section>
    </main>
  );
}
