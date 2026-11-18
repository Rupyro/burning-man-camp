import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { MONEY_SYMBOL } from "@/lib/camp";
import { canMove, isOpen, NEED_STATUSES } from "../../rules/status";
import { getNeed, listSuppliers, namesOf } from "../../server/queries";
import { CriticalTag, dueText, HaveItLine, StatusChip } from "../components/bits";
import { EditNeedForm, NeedLeadActions } from "../components/need-forms";

const rand = (c: number | null) =>
  c === null
    ? ""
    : `${MONEY_SYMBOL}${(c / 100).toLocaleString("en-ZA", { maximumFractionDigits: 2 })}`;

/** One need: the have-it check, where it stands, and the tools for whoever may act on it. */
export async function NeedPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const n = await getNeed(ctx.db, ctx.edition.id, id);
  if (!n) notFound();
  const lead = can(ctx.actor, "procurement.need.manage", { teamId: n.teamId });
  const raiser = n.raisedByPersonId === ctx.actor.personId && n.status === "needed";
  const [names, suppliers] = await Promise.all([
    namesOf(ctx.db, [n.raisedByPersonId, n.ownerPersonId]),
    lead
      ? listSuppliers(ctx.db, can(ctx.actor, "procurement.supplier.contact"))
      : Promise.resolve([]),
  ]);
  const moves = NEED_STATUSES.filter((to) => to !== "purchase_requested" && canMove(n.status, to));
  const open = isOpen(n.status);
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
      <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <Link href="/procurement" className="text-sm underline">
          ← Kit and stock
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="heading text-lg">
            {n.quantityNeeded} {n.unit === "pcs" ? "×" : n.unit} {n.itemName}
          </h1>
          <span className="flex gap-1">
            {n.isCritical ? <CriticalTag /> : null}
            <StatusChip status={n.status} />
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {n.teamName} · {dueText(n.neededBy)}
          {n.raisedByPersonId ? ` · raised by ${names.get(n.raisedByPersonId) ?? "someone"}` : ""}
        </p>
        <HaveItLine check={n.check} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {n.supplierName ? (
            <>
              <dt className="text-muted-foreground">Supplier</dt>
              <dd>{n.supplierName}</dd>
            </>
          ) : null}
          {n.estimateCents ? (
            <>
              <dt className="text-muted-foreground">Estimate</dt>
              <dd>{rand(n.estimateCents)}</dd>
            </>
          ) : null}
          {n.ownerPersonId ? (
            <>
              <dt className="text-muted-foreground">Owner</dt>
              <dd>{names.get(n.ownerPersonId) ?? "someone"}</dd>
            </>
          ) : null}
          {n.status === "purchase_requested" ? (
            <>
              <dt className="text-muted-foreground">Money</dt>
              <dd>Waiting on a spend request in Money.</dd>
            </>
          ) : null}
          {n.spendRequestRefId ? (
            <>
              <dt className="text-muted-foreground">Spend request</dt>
              <dd>
                <Link href={`/finance/r/${n.spendRequestRefId}`} className="underline">
                  Open in Money
                </Link>
              </dd>
            </>
          ) : null}
        </dl>
        {n.notes ? <p className="text-sm">{n.notes}</p> : null}
        <Link href={`/procurement/i/${n.itemId}`} className="text-sm underline">
          See the stock for {n.itemName}
        </Link>
      </article>
      <aside className="flex flex-col gap-3">
        {lead && open ? (
          <section className="rounded-2xl border bg-card p-4" aria-labelledby="lead">
            <h2 id="lead" className="heading mb-2 text-sm">
              Lead tools
            </h2>
            <NeedLeadActions
              id={n.id}
              moves={moves}
              critical={n.isCritical}
              canAskFinance={(n.status === "needed" || n.status === "to_buy") && n.check.gap > 0}
              gap={n.check.gap}
              estimate={n.estimateCents ? String(n.estimateCents / 100) : ""}
            />
          </section>
        ) : null}
        {(lead || raiser) && open ? (
          <section className="rounded-2xl border bg-card p-4" aria-labelledby="edit">
            <h2 id="edit" className="heading mb-2 text-sm">
              Change the details
            </h2>
            <EditNeedForm
              id={n.id}
              lead={lead}
              suppliers={suppliers.map((x) => ({ id: x.id, name: x.name }))}
              values={{
                quantity: String(n.quantityNeeded),
                neededBy: n.neededBy ?? "",
                supplierId: n.supplierId ?? "",
                estimate: n.estimateCents ? String(n.estimateCents / 100) : "",
                notes: n.notes ?? "",
              }}
            />
          </section>
        ) : null}
        {!open ? (
          <p className="text-sm text-muted-foreground">
            This need is {n.status === "received" ? "done: it was received" : "cancelled"}.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
