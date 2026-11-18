import Link from "next/link";
import { notFound } from "next/navigation";
import type { ModuleContext } from "@/base/api";
import { formatCampDay } from "@/lib/dates";
import { categoryLabel } from "../../rules/csv";
import { shoppingList } from "../../rules/shopping";
import { STATUS_LABEL } from "../../rules/status";
import { editionTeams, listNeeds } from "../../server/queries";
import { PrintButton } from "../components/print-button";

// Self-contained print styles: only the list prints, A4, black on white (MODULE_RULEBOOK §10).
const PRINT_CSS = `@media print {
  @page { size: A4; margin: 15mm; }
  body * { visibility: hidden; }
  #shopping-list, #shopping-list * { visibility: visible; color: #000 !important; background: #fff !important; }
  #shopping-list { position: absolute; inset: 0 auto auto 0; width: 100%; }
  #shopping-list ::after { display: none !important; }
}`;

/** A team's shopping list (to buy, asked finance, ordered), grouped by type, print-friendly. */
export async function ListPage({ ctx, teamId }: { ctx: ModuleContext; teamId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) notFound();
  const a = ctx.actor;
  const team = (await editionTeams(ctx.db, ctx.edition.id)).find((t) => t.id === teamId);
  if (!team) notFound();
  if (!(a.isMemberOf(teamId) || a.hasRole("camp_lead") || a.isAdmin)) notFound();
  const needs = await listNeeds(ctx.db, ctx.edition.id, { teamIds: [teamId] });
  const groups = shoppingList(
    needs.map((n) => ({
      itemName: n.itemName,
      category: n.category,
      unit: n.unit,
      quantityNeeded: n.quantityNeeded,
      gap: n.check.gap,
      status: n.status,
      neededBy: n.neededBy,
      supplierName: n.supplierName,
    })),
  );
  const lines = groups.reduce((t, g) => t + g.lines.length, 0);
  return (
    <div className="flex flex-col gap-3">
      <style>{PRINT_CSS}</style>
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href="/procurement" className="text-sm underline">
          ← Kit and stock
        </Link>
        <PrintButton />
      </div>
      <article
        id="shopping-list"
        className="rounded-2xl border bg-card p-4 print:border-0 print:p-0"
      >
        <h1 className="heading text-lg">
          Shopping list: {team.name}, {ctx.edition.year}
        </h1>
        <p className="text-xs text-muted-foreground">
          Generated {formatCampDay(ctx.now, "d MMM yyyy, HH:mm")} camp time (SAST) · {lines} line
          {lines === 1 ? "" : "s"} · quantities are what's still missing after what we own
        </p>
        {groups.length === 0 ? <p className="mt-3 text-sm">Nothing to buy right now.</p> : null}
        {groups.map((g) => (
          <section key={g.category} className="mt-4 break-inside-avoid">
            <h2 className="heading text-sm">{categoryLabel(g.category)}</h2>
            <table className="w-full border-collapse text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 border-b p-1">✓</th>
                  <th className="border-b p-1">Item</th>
                  <th className="border-b p-1 text-right">Buy</th>
                  <th className="border-b p-1">Where from</th>
                  <th className="border-b p-1">By</th>
                  <th className="border-b p-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l) => (
                  <tr key={`${l.itemName}-${l.neededBy}`} className="border-b last:border-0">
                    <td className="p-1">☐</td>
                    <td className="p-1">{l.itemName}</td>
                    <td className="p-1 text-right font-semibold">
                      {l.gap} {l.unit}
                    </td>
                    <td className="p-1">{l.supplierName ?? ""}</td>
                    <td className="p-1">
                      {l.neededBy ? formatCampDay(new Date(`${l.neededBy}T10:00:00Z`)) : ""}
                    </td>
                    <td className="p-1 text-xs">{STATUS_LABEL[l.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </article>
    </div>
  );
}
