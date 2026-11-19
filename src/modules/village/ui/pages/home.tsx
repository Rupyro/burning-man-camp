import { can, type ModuleContext } from "@/base/api";
import { openByPartner, RESOURCE_LABEL } from "../../rules/village";
import { listShares } from "../../server/queries";
import { AddShareForm, ReturnedButton } from "../components/forms";

export async function HomePage({ ctx }: { ctx: ModuleContext }) {
  const rows = await listShares(ctx.db, ctx.edition.id);
  const manager = can(ctx.actor, "village.manage");
  const open = openByPartner(rows);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Village</h1>
      <p className="text-sm text-muted-foreground">
        What we share with partner camps. Everything goes home with its owner at Exodus.
      </p>
      {open.length ? (
        <section role="status" className="rounded-2xl border bg-card p-4 text-sm">
          <b>Still out:</b>
          <ul className="list-disc pl-5">
            {open.map((p) => (
              <li key={p.partner}>
                {p.partner}: {p.theirs} of theirs with us, {p.ours} of ours with them
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {manager ? <AddShareForm /> : null}
      <section className="rounded-2xl border bg-card p-4" aria-label="Shares">
        <h2 className="font-semibold">Shares</h2>
        {rows.length ? (
          <ul className="mt-1 flex flex-col">
            {rows.map((r) => (
              <li key={r.id} className="border-b py-2 text-sm last:border-0">
                <b>{r.item}</b> × {r.quantity} ·{" "}
                {r.direction === "lend" ? "lent to" : "borrowed from"} {r.partner}
                {r.returned ? " · returned" : ""}
                <span className="block text-xs text-muted-foreground">
                  {RESOURCE_LABEL[r.resource]}
                  {r.notes ? ` · ${r.notes}` : ""}
                </span>
                {manager ? <ReturnedButton id={r.id} returned={r.returned} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing shared yet.</p>
        )}
      </section>
    </main>
  );
}
