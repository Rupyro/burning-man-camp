import "server-only";
// Ingestion for the tool list: each approved row becomes a catalogue item, linked to its teams
// (departments), with this year's need (status, quantity) and stock at its place when known.
// Everything written is stamped with import_batch_id; undo removes exactly that. What has no
// home (unknown departments, a status without a team) stays in the item's notes.
import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import type { ModuleContext } from "@/base/api";
import { people, teams } from "@/base/api/schema";
import type { NeedStatus } from "../rules/status";
import {
  procurementItems as items,
  procurementItemTeams as itemTeams,
  procurementLocations as locations,
  procurementStockMovements as moves,
  procurementNeeds as needs,
  procurementStock as stock,
} from "../schema";

type Db = ModuleContext["db"];
interface Row {
  line: number;
  values: Record<string, unknown>;
  setResponsible: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The cleaner's status -> this year's need status. */
export const NEED_FROM_STATUS: Record<string, NeedStatus> = {
  purchased: "have_it",
  to_buy: "to_buy",
  to_check: "needed",
  not_needed: "not_needed",
  built: "built",
  rent: "to_borrow",
};

/** Notes for what has no column: unmatched departments, a status or place with nowhere to go. */
export function toolNotes(
  v: Record<string, unknown>,
  left: { departments: string[]; status: boolean; location: boolean; responsible: string | null },
): string {
  const parts = [
    left.departments.length ? `Departments: ${left.departments.join(", ")}` : "",
    left.location && str(v.location) ? `Location: ${str(v.location)}` : "",
    left.status && str(v.status) ? `Status: ${str(v.status).replaceAll("_", " ")}` : "",
    left.status && typeof v.qty === "number" ? `Quantity: ${v.qty}` : "",
    left.responsible ? `Responsible: ${left.responsible}` : "",
  ];
  return ["Imported from the 2026 tool list.", ...parts.filter(Boolean)].join("\n");
}

async function personByName(db: Db, rows: Row[]) {
  const names = rows.map((r) => str(r.values.responsible).toLowerCase()).filter(Boolean);
  const matches = names.length
    ? await db
        .select({ id: people.id, n: sql<string>`lower(${people.displayName})` })
        .from(people)
        .where(and(inArray(sql`lower(${people.displayName})`, names), isNull(people.deletedAt)))
    : [];
  const out = new Map<string, string | null>();
  for (const m of matches) out.set(m.n, out.has(m.n) ? null : m.id);
  return out;
}

async function teamsByName(db: Db, editionId: string | undefined) {
  if (!editionId) return new Map<string, string>();
  const ts = await db.select().from(teams).where(eq(teams.editionId, editionId));
  const out = new Map<string, string>();
  for (const t of ts) {
    out.set(t.name.toLowerCase(), t.id);
    out.set(t.key.toLowerCase(), t.id);
  }
  return out;
}

async function locationId(db: Db, name: string, batchId: string): Promise<string | null> {
  const [found] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(sql`lower(${locations.name})`, name.toLowerCase()));
  if (found) return found.id;
  const [made] = await db
    .insert(locations)
    .values({ name, kind: "site_area", importBatchId: batchId })
    .onConflictDoNothing()
    .returning({ id: locations.id });
  return made?.id ?? null;
}

async function apply(db: Db, batchId: string, rows: Row[], opts: { editionId?: string } = {}) {
  const personOf = await personByName(db, rows);
  const teamOf = await teamsByName(db, opts.editionId);
  let added = 0;
  let alreadyThere = 0;
  for (const r of rows) {
    const v = r.values;
    const name = str(v.name);
    if (!name) continue;
    const who = r.setResponsible ? str(v.responsible) : "";
    const personId = who ? (personOf.get(who.toLowerCase()) ?? null) : null;
    const deps = Array.isArray(v.departments)
      ? v.departments.filter((d) => typeof d === "string")
      : [];
    const teamIds = [...new Set(deps.flatMap((d) => teamOf.get(d.toLowerCase()) ?? []))];
    const unmatched = deps.filter((d) => !teamOf.has(d.toLowerCase()));
    const needStatus = NEED_FROM_STATUS[str(v.status)];
    const needTeam = teamIds[0];
    const canNeed = Boolean(needStatus && needTeam && opts.editionId);
    const qty = typeof v.qty === "number" && v.qty > 0 ? v.qty : null;
    const place = str(v.location);
    const canStock = Boolean(place && qty);
    const isTool = str(v.type).toLowerCase() === "tool";
    const [item] = await db
      .insert(items)
      .values({
        name,
        category: isTool ? "tool" : "other",
        isAsset: isTool,
        notes: toolNotes(v, {
          departments: unmatched,
          status: !canNeed,
          location: !canStock,
          responsible: who && !personId ? who : null,
        }),
        importBatchId: batchId,
        responsiblePersonId: personId,
      })
      .onConflictDoNothing()
      .returning({ id: items.id });
    if (!item) {
      alreadyThere++;
      continue;
    }
    added++;
    if (teamIds.length)
      await db
        .insert(itemTeams)
        .values(teamIds.map((teamId) => ({ itemId: item.id, teamId, importBatchId: batchId })))
        .onConflictDoNothing();
    if (canNeed && needStatus && needTeam && opts.editionId)
      await db.insert(needs).values({
        editionId: opts.editionId,
        teamId: needTeam,
        itemId: item.id,
        quantityNeeded: qty ?? 1,
        status: needStatus,
        ownerPersonId: personId,
        importBatchId: batchId,
      });
    if (canStock && qty) {
      const loc = await locationId(db, place, batchId);
      if (loc)
        await db
          .insert(stock)
          .values({ itemId: item.id, locationId: loc, quantity: qty, importBatchId: batchId })
          .onConflictDoNothing();
    }
  }
  return { added, alreadyThere };
}

async function undo(db: Db, batchId: string) {
  await db.delete(needs).where(eq(needs.importBatchId, batchId));
  await db.delete(stock).where(eq(stock.importBatchId, batchId));
  await db.delete(itemTeams).where(eq(itemTeams.importBatchId, batchId));
  const unused = (t: typeof stock | typeof moves | typeof needs) =>
    notExists(db.select({ x: sql`1` }).from(t).where(eq(t.itemId, items.id)));
  const removed = await db
    .delete(items)
    .where(and(eq(items.importBatchId, batchId), unused(stock), unused(moves), unused(needs)))
    .returning({ id: items.id });
  const kept = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.importBatchId, batchId));
  const placeUnused = (t: typeof stock) =>
    notExists(db.select({ x: sql`1` }).from(t).where(eq(t.locationId, locations.id)));
  await db.delete(locations).where(and(eq(locations.importBatchId, batchId), placeUnused(stock)));
  return { removed: removed.length, keptInUse: kept.length };
}

export const toolImporter = { apply, undo };
