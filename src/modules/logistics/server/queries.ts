// Read side for logistics (docs/specs/logistics.md §5). Plain functions over a db handle.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { type GapItem, gaps, type LoadStatus } from "../rules/loads";
import {
  logisticsLoadItems as loadItems,
  logisticsLoads as loads,
  logisticsPlaces as places,
  logisticsVehicles as vehicles,
} from "../schema";

export type Place = typeof places.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type LoadItem = typeof loadItems.$inferSelect;

export const listPlaces = (db: ReadOnlyDb) => db.select().from(places).orderBy(asc(places.name));

export const listVehicles = (db: ReadOnlyDb, editionId: string) =>
  db
    .select({
      id: vehicles.id,
      label: vehicles.label,
      kind: vehicles.kind,
      seats: vehicles.seats,
      cargoNotes: vehicles.cargoNotes,
      driverName: people.displayName,
    })
    .from(vehicles)
    .leftJoin(people, eq(people.id, vehicles.driverPersonId))
    .where(eq(vehicles.editionId, editionId))
    .orderBy(asc(vehicles.label));

export interface LoadRow {
  id: string;
  name: string;
  direction: "outbound" | "return" | "internal";
  status: LoadStatus;
  departsAt: Date | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  originPlaceId: string | null;
  originName: string | null;
  destinationPlaceId: string | null;
  destinationName: string | null;
  notes: string | null;
  deliveredConfirmedAt: Date | null;
  deliveredByName: string | null;
  itemCount: number;
  packedCount: number;
  criticalCount: number;
  version: number;
}

function loadQuery(db: ReadOnlyDb) {
  const origin = sql<
    string | null
  >`(select name from logistics_places where id = ${loads.originPlaceId})`;
  const dest = sql<
    string | null
  >`(select name from logistics_places where id = ${loads.destinationPlaceId})`;
  return db
    .select({
      id: loads.id,
      name: loads.name,
      direction: loads.direction,
      status: loads.status,
      departsAt: loads.departsAt,
      vehicleId: loads.vehicleId,
      vehicleLabel: vehicles.label,
      originPlaceId: loads.originPlaceId,
      originName: origin,
      destinationPlaceId: loads.destinationPlaceId,
      destinationName: dest,
      notes: loads.notes,
      deliveredConfirmedAt: loads.deliveredConfirmedAt,
      deliveredByName: people.displayName,
      itemCount: sql<number>`(select count(*)::int from logistics_load_items i where i.load_id = ${loads.id})`,
      packedCount: sql<number>`(select count(*)::int from logistics_load_items i where i.load_id = ${loads.id} and i.packed_at is not null)`,
      criticalCount: sql<number>`(select count(*)::int from logistics_load_items i where i.load_id = ${loads.id} and i.is_critical)`,
      version: loads.version,
    })
    .from(loads)
    .leftJoin(vehicles, eq(vehicles.id, loads.vehicleId))
    .leftJoin(people, eq(people.id, loads.deliveredConfirmedByPersonId));
}

/** Loads for the edition: open ones first by departure (undated last), then finished ones. */
export async function listLoads(db: ReadOnlyDb, editionId: string): Promise<LoadRow[]> {
  return loadQuery(db)
    .where(eq(loads.editionId, editionId))
    .orderBy(
      sql`case when ${loads.status} in ('delivered','cancelled') then 1 else 0 end`,
      sql`${loads.departsAt} asc nulls last`,
      asc(loads.name),
    );
}

export async function getLoad(db: ReadOnlyDb, editionId: string, id: string) {
  const [row] = await loadQuery(db).where(and(eq(loads.id, id), eq(loads.editionId, editionId)));
  return row ?? null;
}

/** A load's items, critical first, then unpacked, then by name. */
export const itemsOf = (db: ReadOnlyDb, loadId: string) =>
  db
    .select()
    .from(loadItems)
    .where(eq(loadItems.loadId, loadId))
    .orderBy(
      sql`${loadItems.isCritical} desc`,
      sql`${loadItems.packedAt} is not null`,
      asc(loadItems.description),
    );

/** Critical gaps for the edition (L8), soonest needed first, with what's wrong. */
export async function criticalGaps(db: ReadOnlyDb, editionId: string) {
  const rows = await db
    .select({
      id: loadItems.id,
      description: loadItems.description,
      isCritical: loadItems.isCritical,
      neededBy: loadItems.neededBy,
      quantity: loadItems.quantity,
      unit: loadItems.unit,
      sourceRefType: loadItems.sourceRefType,
      sourceRefId: loadItems.sourceRefId,
      loadId: loadItems.loadId,
      loadName: loads.name,
      loadStatus: loads.status,
      destinationPlaceId: loads.destinationPlaceId,
    })
    .from(loadItems)
    .leftJoin(loads, eq(loads.id, loadItems.loadId))
    .where(and(eq(loadItems.editionId, editionId), eq(loadItems.isCritical, true)));
  return gaps(
    rows.map((r) => ({
      ...r,
      load:
        r.loadId && r.loadStatus
          ? { status: r.loadStatus, hasDestination: r.destinationPlaceId !== null }
          : null,
    })) satisfies GapItem[],
  );
}

/** Loads you can still put things on (not delivered or cancelled). */
export async function openLoads(db: ReadOnlyDb, editionId: string) {
  return (await listLoads(db, editionId)).filter(
    (l) => l.status !== "delivered" && l.status !== "cancelled",
  );
}

export async function placesByIds(db: ReadOnlyDb, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}
