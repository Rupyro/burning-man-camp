import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type ModuleContext } from "@/base/api";
import { ownerLabel } from "@/lib/camp";
import { formatCampDay } from "@/lib/dates";
import { categoryLabel } from "../../rules/csv";
import { haveIt } from "../../rules/have-it";
import { isOpen } from "../../rules/status";
import { getItem, listLocations, movementsOf, needsForItem } from "../../server/queries";
import { BottleneckTag, NeedCard } from "../components/bits";
import { CountForm } from "../components/need-forms";

const CONDITION = {
  good: "Good",
  needs_repair: "Needs repair",
  broken: "Broken",
  missing: "Missing",
} as const;
const REASON = {
  count: "Counted",
  purchase: "Bought",
  load: "Loaded",
  consumed: "Used up",
  broken: "Broke",
  returned: "Returned",
} as const;
/** One item: stock by place and condition, update a count on site, recent changes, needs. */
export async function ItemPage({ ctx, id }: { ctx: ModuleContext; id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const got = await getItem(ctx.db, id);
  if (!got || got.item.deletedAt) notFound();
  const { item, lines } = got;
  const [places, moves, needs] = await Promise.all([
    listLocations(ctx.db),
    movementsOf(ctx.db, id),
    needsForItem(ctx.db, ctx.edition.id, id),
  ]);
  const check = haveIt(0, lines, item.ownerLabel);
  const mayCount = can(ctx.actor, "procurement.stock.count");
  const open = needs.filter((n) => isOpen(n.status));
  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
      <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <Link href="/procurement" className="text-sm underline">
          ← Kit and stock
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="heading text-lg">{item.name}</h1>
          {item.isBottleneck ? <BottleneckTag /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {categoryLabel(item.category)} · {ownerLabel(item.ownerLabel)} · counted in {item.unit}
        </p>
        <p className="font-wordmark text-2xl">
          {check.usable} {item.unit} good
          <span className="ml-2 font-sans text-sm text-muted-foreground">
            {check.repairable ? `${check.repairable} need repair · ` : ""}
            {check.unusable ? `${check.unusable} broken or missing` : ""}
          </span>
        </p>
        <section aria-labelledby="where">
          <h2 id="where" className="heading text-sm">
            Where it is
          </h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock counted anywhere yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-b p-2">Place</th>
                  <th className="border-b p-2">Condition</th>
                  <th className="border-b p-2 text-right">How many</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={`${l.locationId}-${l.condition}`} className="border-b last:border-0">
                    <td className="p-2">{l.locationName}</td>
                    <td className="p-2">{CONDITION[l.condition]}</td>
                    <td className="p-2 text-right font-semibold">{l.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {item.notes ? <p className="text-sm">{item.notes}</p> : null}
        <section aria-labelledby="changes">
          <h2 id="changes" className="heading text-sm">
            Recent changes
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {moves.map((m) => (
              <li key={m.id}>
                <span className="text-muted-foreground">{formatCampDay(m.at)}</span> ·{" "}
                {REASON[m.reason]} {m.delta > 0 ? `+${m.delta}` : m.delta}{" "}
                {CONDITION[m.condition].toLowerCase()}
                {m.placeName ? ` at ${m.placeName}` : ""}
                {m.actorName ? ` by ${m.actorName}` : ""}
                {m.note ? ` (${m.note})` : ""}
              </li>
            ))}
            {moves.length === 0 ? <li className="text-muted-foreground">No changes yet.</li> : null}
          </ul>
        </section>
      </article>
      <aside className="flex flex-col gap-3">
        {mayCount && places.length ? (
          <section className="rounded-2xl border bg-card p-4" aria-labelledby="count">
            <h2 id="count" className="heading mb-2 text-sm">
              Update a count
            </h2>
            <CountForm
              itemId={item.id}
              unit={item.unit}
              places={places.map((p) => ({ id: p.id, name: p.name }))}
              placeId={lines[0]?.locationId}
            />
          </section>
        ) : null}
        <section aria-labelledby="needs" className="flex flex-col gap-2">
          <h2 id="needs" className="heading text-sm">
            Teams that need it ({open.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {open.map((n) => (
              <NeedCard key={n.id} n={n} />
            ))}
          </ul>
          {ctx.actor.teams.length ? (
            <Link href={`/procurement/new?item=${item.id}`} className="text-sm underline">
              Raise a need for this
            </Link>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
