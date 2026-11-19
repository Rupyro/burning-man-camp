import { can, type ModuleContext } from "@/base/api";
import { activeEvent } from "@/lib/active-packs";
import { fuelTotal, KIND_LABEL, KINDS, stakesLeft } from "../../rules/registers";
import { listItems } from "../../server/queries";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listItems(ctx.db, ctx.edition.id);
  const manager = can(ctx.actor, "registers.manage");
  // The event's fuel storage limit, when its pack sets one.
  const limit = activeEvent.fuel;
  const fuel = fuelTotal(rows, limit?.storageLimit);
  const stakes = stakesLeft(rows);
  const unit = limit?.unit ?? "gal";
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Registers</h1>
      <p className="text-sm text-muted-foreground">
        Where the fuel and fire are, and every stake in the ground.
        {manager ? " Leads keep these up to date." : ""}
      </p>
      {fuel.overLimit ? (
        <p role="alert" className="rounded-2xl border bg-card p-4 text-sm font-semibold">
          {fuel.total} {unit} of fuel stored: more than the {limit?.storageLimit} {unit} limit.
        </p>
      ) : null}
      {KINDS.map((kind) => {
        const lines = rows.filter((r) => r.kind === kind);
        return (
          <section key={kind} className="rounded-2xl border bg-card p-4" aria-label={kind}>
            <h2 className="font-semibold">{KIND_LABEL[kind]}</h2>
            {kind === "fuel" && lines.length ? (
              <p className="text-xs text-muted-foreground">
                {fuel.total} {unit} in all
                {limit ? ` (limit ${limit.storageLimit} ${unit})` : ""}
              </p>
            ) : null}
            {kind === "stake" && lines.length ? (
              <p className="text-xs text-muted-foreground">
                {stakes.left ? `${stakes.left} still in the ground` : "All pulled"}
              </p>
            ) : null}
            {lines.length ? (
              <ul className="mt-1 flex flex-col">
                {lines.map((r) => (
                  <li key={r.id} className="border-b py-2 text-sm last:border-0">
                    <b>{r.label}</b> · {r.quantity}
                    {kind === "fuel" ? ` ${unit}` : ""}
                    {kind === "stake" ? ` in, ${r.pulled} pulled` : ""}
                    <span className="block text-xs text-muted-foreground">
                      {[r.location, r.owner ? `owner ${r.owner}` : "", r.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            )}
          </section>
        );
      })}
    </main>
  );
}
