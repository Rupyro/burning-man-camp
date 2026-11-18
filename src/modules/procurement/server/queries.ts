// Read side for procurement (docs/specs/procurement.md §5). Plain functions over a db handle.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people, teams } from "@/base/api/schema";
import { type HaveIt, haveIt, type StockLine } from "../rules/have-it";
import type { NeedStatus } from "../rules/status";
import {
  procurementItems as items,
  procurementLocations as locations,
  procurementStockMovements as moves,
  procurementNeeds as needs,
  procurementStock as stock,
  procurementSuppliers as suppliers,
} from "../schema";

export type Item = typeof items.$inferSelect;

/** Stock lines (with place names) per item. */
export async function stockFor(db: ReadOnlyDb, itemIds: string[]) {
  const out = new Map<string, (StockLine & { locationId: string })[]>();
  if (!itemIds.length) return out;
  const rows = await db
    .select({
      itemId: stock.itemId,
      locationId: stock.locationId,
      locationName: locations.name,
      condition: stock.condition,
      quantity: stock.quantity,
    })
    .from(stock)
    .innerJoin(locations, eq(locations.id, stock.locationId))
    .where(inArray(stock.itemId, itemIds))
    .orderBy(asc(locations.name), asc(stock.condition));
  for (const r of rows) out.set(r.itemId, [...(out.get(r.itemId) ?? []), r]);
  return out;
}

/** The catalogue (optionally filtered by a name search), each with its good-stock total. */
export async function listItems(db: ReadOnlyDb, search = "") {
  const q = search.trim();
  const rows = await db
    .select()
    .from(items)
    .where(
      and(
        sql`${items.deletedAt} is null`,
        q ? sql`${items.name} ilike ${`%${q.replace(/[%_\\]/g, "\\$&")}%`}` : undefined,
      ),
    )
    .orderBy(asc(items.name))
    .limit(200);
  const s = await stockFor(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((item) => {
    const lines = s.get(item.id) ?? [];
    return { item, lines, check: haveIt(0, lines, item.ownerLabel) };
  });
}

export async function getItem(db: ReadOnlyDb, id: string) {
  const [item] = await db.select().from(items).where(eq(items.id, id));
  if (!item) return null;
  return { item, lines: (await stockFor(db, [id])).get(id) ?? [] };
}

export async function listLocations(db: ReadOnlyDb) {
  return db.select().from(locations).orderBy(asc(locations.name));
}

/** Suppliers; phone numbers only when the viewer may see them (P3). */
export async function listSuppliers(db: ReadOnlyDb, withContact: boolean) {
  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name));
  return rows.map((s) => (withContact ? s : { ...s, contactPhone: null }));
}

export interface NeedRow {
  id: string;
  teamId: string;
  teamName: string;
  itemId: string;
  itemName: string;
  category: Item["category"];
  unit: string;
  quantityNeeded: number;
  status: NeedStatus;
  isCritical: boolean;
  neededBy: string | null;
  ownerPersonId: string | null;
  raisedByPersonId: string | null;
  estimateCents: number | null;
  spendRequestRefId: string | null;
  supplierId: string | null;
  supplierName: string | null;
  taskId: string | null;
  notes: string | null;
  version: number;
  check: HaveIt;
}

/** Needs for an edition (optionally only some teams), with the have-it check worked out. */
export async function listNeeds(
  db: ReadOnlyDb,
  editionId: string,
  opts: { teamIds?: string[]; id?: string } = {},
): Promise<NeedRow[]> {
  if (opts.teamIds && !opts.teamIds.length) return [];
  const rows = await db
    .select({
      n: needs,
      teamName: teams.name,
      itemName: items.name,
      category: items.category,
      unit: items.unit,
      ownerLabel: items.ownerLabel,
      supplierName: suppliers.name,
    })
    .from(needs)
    .innerJoin(items, eq(items.id, needs.itemId))
    .innerJoin(teams, eq(teams.id, needs.teamId))
    .leftJoin(suppliers, eq(suppliers.id, needs.supplierId))
    .where(
      and(
        eq(needs.editionId, editionId),
        opts.teamIds ? inArray(needs.teamId, opts.teamIds) : undefined,
        opts.id ? eq(needs.id, opts.id) : undefined,
      ),
    )
    .orderBy(sql`${needs.isCritical} desc`, sql`${needs.neededBy} asc nulls last`, asc(items.name));
  const s = await stockFor(db, [...new Set(rows.map((r) => r.n.itemId))]);
  return rows.map(({ n, ownerLabel, ...r }) => ({
    id: n.id,
    teamId: n.teamId,
    teamName: r.teamName,
    itemId: n.itemId,
    itemName: r.itemName,
    category: r.category,
    unit: r.unit,
    quantityNeeded: n.quantityNeeded,
    status: n.status,
    isCritical: n.isCritical,
    neededBy: n.neededBy,
    ownerPersonId: n.ownerPersonId,
    raisedByPersonId: n.raisedByPersonId,
    estimateCents: n.estimateCents,
    spendRequestRefId: n.spendRequestRefId,
    supplierId: n.supplierId,
    supplierName: r.supplierName,
    taskId: n.taskId,
    notes: n.notes,
    version: n.version,
    check: haveIt(n.quantityNeeded, s.get(n.itemId) ?? [], ownerLabel),
  }));
}

export async function getNeed(db: ReadOnlyDb, editionId: string, id: string) {
  return (await listNeeds(db, editionId, { id }))[0] ?? null;
}

/** The record a need capability check needs. Unknown id → a team nobody leads. */
export async function needResource(db: ReadOnlyDb, editionId: string, id: string) {
  const [n] = await db
    .select({ teamId: needs.teamId })
    .from(needs)
    .where(and(eq(needs.id, id), eq(needs.editionId, editionId)));
  return { teamId: n?.teamId ?? "00000000-0000-0000-0000-000000000000" };
}

/** Teams the actor is on (to raise needs for), by name. */
export async function teamsOf(db: ReadOnlyDb, teamIds: string[]) {
  if (!teamIds.length) return [];
  return db
    .select({ id: teams.id, name: teams.name, key: teams.key })
    .from(teams)
    .where(inArray(teams.id, teamIds))
    .orderBy(asc(teams.name));
}

/** Every team this edition (for the camp lead's board and shopping lists). */
export async function editionTeams(db: ReadOnlyDb, editionId: string) {
  return db
    .select({ id: teams.id, name: teams.name, key: teams.key })
    .from(teams)
    .where(eq(teams.editionId, editionId))
    .orderBy(asc(teams.name));
}

/** Display names for a few people (safe field only). */
export async function namesOf(db: ReadOnlyDb, ids: (string | null)[]) {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Map<string, string>();
  const rows = await db
    .select({ id: people.id, name: people.displayName })
    .from(people)
    .where(inArray(people.id, want));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** The last few stock changes for an item, newest first, with place and person names. */
export async function movementsOf(db: ReadOnlyDb, itemId: string, limit = 10) {
  const rows = await db
    .select({
      id: moves.id,
      at: moves.at,
      delta: moves.delta,
      reason: moves.reason,
      condition: moves.condition,
      note: moves.note,
      placeName: locations.name,
      actorName: people.displayName,
    })
    .from(moves)
    .leftJoin(locations, eq(locations.id, moves.toLocationId))
    .leftJoin(people, eq(people.id, moves.actorPersonId))
    .where(eq(moves.itemId, itemId))
    .orderBy(sql`${moves.at} desc`)
    .limit(limit);
  return rows;
}

/** Open and recent needs for one item (any team), for the item page. */
export async function needsForItem(db: ReadOnlyDb, editionId: string, itemId: string) {
  return (await listNeeds(db, editionId)).filter((n) => n.itemId === itemId);
}
