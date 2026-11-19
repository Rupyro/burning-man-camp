"use server";
// Places, vehicles, loads and their items (docs/specs/logistics.md §2-§4, L1, L2, L8).
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type ActionContext, moduleAction, ValidationError } from "@/base/api";
import { people } from "@/base/api/schema";
import { canMoveLoad, isLoadOpen, LOAD_STATUSES, type LoadStatus } from "../rules/loads";
import {
  logisticsLoadItems as loadItems,
  logisticsLoads as loads,
  logisticsPlaces as places,
  logisticsVehicles as vehicles,
} from "../schema";

const id = z.string().uuid();
const optId = z.string().uuid().nullable().optional();
const text = (max: number) => z.string().trim().max(max);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-04-01");

function quantity(input: string): number {
  const n = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 99_999_999)
    throw new ValidationError("Use a quantity like 3 or 2.5");
  return Math.round(n * 100) / 100;
}

async function placeExists(ctx: ActionContext, placeId: string | null | undefined) {
  if (!placeId) return;
  const [p] = await ctx.tx.select({ id: places.id }).from(places).where(eq(places.id, placeId));
  if (!p) throw new ValidationError("Pick a place from the list");
}

async function vehicleExists(ctx: ActionContext, vehicleId: string | null | undefined) {
  if (!vehicleId) return;
  const [v] = await ctx.tx
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.editionId, ctx.edition.id)));
  if (!v) throw new ValidationError("Pick a vehicle from the list");
}

async function lockLoad(ctx: ActionContext, loadId: string) {
  const [row] = await ctx.tx
    .select()
    .from(loads)
    .where(and(eq(loads.id, loadId), eq(loads.editionId, ctx.edition.id)))
    .for("update");
  if (!row) throw new ValidationError("That load isn't in this year's plan");
  return row;
}

export const createPlace = moduleAction(
  "logistics",
  {
    input: z.object({
      name: text(120).min(1),
      kind: z.enum([
        "storage",
        "container_yard",
        "site",
        "pickup",
        "airport",
        "city_area",
        "supplier",
      ]),
      addressText: text(300).optional(),
    }),
    capability: "logistics.loads.manage",
  },
  async (ctx, input) => {
    const [dupe] = await ctx.tx
      .select({ id: places.id })
      .from(places)
      .where(sql`lower(${places.name}) = lower(${input.name})`);
    if (dupe) throw new ValidationError("There's already a place with that name");
    const [row] = await ctx.tx.insert(places).values(input).returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "logistics.place.created",
      entity: { type: "logistics.place", id: row.id },
      changes: { name: [null, row.name], kind: [null, row.kind] },
    });
    return { ok: true as const, id: row.id };
  },
);

export const createVehicle = moduleAction(
  "logistics",
  {
    input: z.object({
      label: text(80).min(1),
      kind: z.enum(["car", "truck", "trailer", "container_truck", "mutant_vehicle"]),
      driverPersonId: optId,
      seats: z.number().int().min(1).max(60).nullable().optional(),
      cargoNotes: text(300).optional(),
    }),
    capability: "logistics.loads.manage",
  },
  async (ctx, input) => {
    if (input.driverPersonId) {
      const [p] = await ctx.tx
        .select({ id: people.id })
        .from(people)
        .where(eq(people.id, input.driverPersonId));
      if (!p) throw new ValidationError("Pick a driver from the list");
    }
    const [row] = await ctx.tx
      .insert(vehicles)
      .values({ ...input, editionId: ctx.edition.id })
      .returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "logistics.vehicle.created",
      entity: { type: "logistics.vehicle", id: row.id },
      changes: { label: [null, row.label], kind: [null, row.kind] },
    });
    return { ok: true as const, id: row.id };
  },
);

const loadFields = z.object({
  name: text(120).min(1),
  direction: z.enum(["outbound", "return", "internal"]),
  vehicleId: optId,
  originPlaceId: optId,
  destinationPlaceId: optId,
  /** "YYYY-MM-DDTHH:mm" in camp time is converted by the form; we take an ISO string. */
  departsAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: text(1000).optional(),
});

export const createLoad = moduleAction(
  "logistics",
  { input: loadFields, capability: "logistics.loads.manage" },
  async (ctx, input) => {
    await Promise.all([
      placeExists(ctx, input.originPlaceId),
      placeExists(ctx, input.destinationPlaceId),
      vehicleExists(ctx, input.vehicleId),
    ]);
    const [row] = await ctx.tx
      .insert(loads)
      .values({
        ...input,
        departsAt: input.departsAt ? new Date(input.departsAt) : null,
        editionId: ctx.edition.id,
      })
      .returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "logistics.load.created",
      entity: { type: "logistics.load", id: row.id },
      changes: { name: [null, row.name], direction: [null, row.direction] },
    });
    return { ok: true as const, id: row.id };
  },
);

export const updateLoad = moduleAction(
  "logistics",
  {
    input: loadFields.partial().extend({ loadId: id, version: z.number().int() }),
    capability: "logistics.loads.manage",
  },
  async (ctx, { loadId, version, ...input }) => {
    const row = await lockLoad(ctx, loadId);
    if (row.version !== version)
      throw new ValidationError("Someone else changed this load. Reload and try again");
    if (!isLoadOpen(row.status)) throw new ValidationError("This load is finished");
    await Promise.all([
      placeExists(ctx, input.originPlaceId),
      placeExists(ctx, input.destinationPlaceId),
      vehicleExists(ctx, input.vehicleId),
    ]);
    const next = {
      ...input,
      departsAt:
        input.departsAt === undefined
          ? undefined
          : input.departsAt
            ? new Date(input.departsAt)
            : null,
    };
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      const before = row[k as keyof typeof row];
      const same =
        before instanceof Date && v instanceof Date ? +before === +v : (before ?? null) === v;
      if (!same) changes[k] = [before ?? null, v];
    }
    if (!Object.keys(changes).length) return { ok: true as const, changed: false };
    await ctx.tx
      .update(loads)
      .set({ ...next, updatedAt: ctx.now, version: row.version + 1 })
      .where(eq(loads.id, row.id));
    await ctx.audit.record({
      action: "logistics.load.updated",
      entity: { type: "logistics.load", id: row.id },
      changes,
    });
    return { ok: true as const, changed: true };
  },
);

/** Move a load along (L1). "Delivered" goes through confirmDelivery, which stamps who and when. */
export const moveLoad = moduleAction(
  "logistics",
  {
    input: z.object({ loadId: id, to: z.enum(LOAD_STATUSES) }),
    capability: "logistics.loads.manage",
  },
  async (ctx, input) => {
    if (input.to === "delivered")
      throw new ValidationError("Use “Confirm delivery” once it's on site");
    const row = await lockLoad(ctx, input.loadId);
    if (!canMoveLoad(row.status, input.to))
      throw new ValidationError(`A ${row.status.replace("_", " ")} load can't go to ${input.to}`);
    await setStatus(ctx, row, input.to);
    return { ok: true as const };
  },
);

async function setStatus(
  ctx: ActionContext,
  row: typeof loads.$inferSelect,
  to: LoadStatus,
  stamp?: { at: Date; by: string | null },
) {
  await ctx.tx
    .update(loads)
    .set({
      status: to,
      ...(stamp ? { deliveredConfirmedAt: stamp.at, deliveredConfirmedByPersonId: stamp.by } : {}),
      updatedAt: ctx.now,
      version: row.version + 1,
    })
    .where(eq(loads.id, row.id));
  await ctx.audit.record({
    action: to === "delivered" ? "logistics.load.delivered" : "logistics.load.moved",
    entity: { type: "logistics.load", id: row.id },
    changes: { status: [row.status, to] },
    significance: to === "delivered" || to === "cancelled" ? "significant" : "activity",
  });
}

/** Someone on site says it arrived (L2): Logistics team, any team lead, camp leads. */
export const confirmDelivery = moduleAction(
  "logistics",
  { input: z.object({ loadId: id }), capability: "logistics.delivery.confirm" },
  async (ctx, input) => {
    const row = await lockLoad(ctx, input.loadId);
    if (row.status === "delivered") return { ok: true as const, already: true };
    if (!canMoveLoad(row.status, "delivered"))
      throw new ValidationError("Only a load that's on the road can be delivered");
    await setStatus(ctx, row, "delivered", { at: ctx.now, by: ctx.actor.personId });
    return { ok: true as const, already: false };
  },
);

export const addItem = moduleAction(
  "logistics",
  {
    input: z.object({
      loadId: optId,
      description: text(200).min(1),
      quantity: z.string().max(20).optional(),
      unit: text(16).min(1).optional(),
      isCritical: z.boolean().optional(),
      neededBy: dateText.nullable().optional(),
    }),
    capability: "logistics.loads.manage",
  },
  async (ctx, input) => {
    if (input.loadId) {
      const load = await lockLoad(ctx, input.loadId);
      if (!isLoadOpen(load.status)) throw new ValidationError("This load is finished");
    }
    const [row] = await ctx.tx
      .insert(loadItems)
      .values({
        editionId: ctx.edition.id,
        loadId: input.loadId ?? null,
        description: input.description,
        quantity: quantity(input.quantity ?? "1"),
        unit: input.unit ?? "pcs",
        isCritical: input.isCritical ?? false,
        neededBy: input.neededBy ?? null,
      })
      .returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "logistics.item.added",
      entity: { type: "logistics.load_item", id: row.id },
      changes: { description: [null, row.description], loadId: [null, row.loadId] },
    });
    return { ok: true as const, id: row.id };
  },
);

async function lockItem(ctx: ActionContext, itemId: string) {
  const [row] = await ctx.tx
    .select()
    .from(loadItems)
    .where(and(eq(loadItems.id, itemId), eq(loadItems.editionId, ctx.edition.id)))
    .for("update");
  if (!row) throw new ValidationError("That item isn't in this year's plan");
  return row;
}

/** Put an item (often a critical gap) on a load, or take it off (loadId null). */
export const assignItem = moduleAction(
  "logistics",
  { input: z.object({ itemId: id, loadId: id.nullable() }), capability: "logistics.loads.manage" },
  async (ctx, input) => {
    const row = await lockItem(ctx, input.itemId);
    if (row.loadId === input.loadId) return { ok: true as const, changed: false };
    if (input.loadId) {
      const load = await lockLoad(ctx, input.loadId);
      if (!isLoadOpen(load.status)) throw new ValidationError("Pick a load that's still open");
    }
    await ctx.tx
      .update(loadItems)
      .set({
        loadId: input.loadId,
        packedAt: null,
        packedByPersonId: null,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(loadItems.id, row.id));
    await ctx.audit.record({
      action: "logistics.item.assigned",
      entity: { type: "logistics.load_item", id: row.id },
      changes: { loadId: [row.loadId, input.loadId] },
    });
    return { ok: true as const, changed: true };
  },
);

/** Tick an item as packed (or untick it). */
export const packItem = moduleAction(
  "logistics",
  { input: z.object({ itemId: id, packed: z.boolean() }), capability: "logistics.loads.manage" },
  async (ctx, input) => {
    const row = await lockItem(ctx, input.itemId);
    if (!row.loadId) throw new ValidationError("Put it on a load first");
    if ((row.packedAt !== null) === input.packed) return { ok: true as const, changed: false };
    await ctx.tx
      .update(loadItems)
      .set({
        packedAt: input.packed ? ctx.now : null,
        packedByPersonId: input.packed ? ctx.actor.personId : null,
        updatedAt: ctx.now,
        version: row.version + 1,
      })
      .where(eq(loadItems.id, row.id));
    await ctx.audit.record({
      action: input.packed ? "logistics.item.packed" : "logistics.item.unpacked",
      entity: { type: "logistics.load_item", id: row.id },
      changes: { packed: [!input.packed, input.packed] },
    });
    return { ok: true as const, changed: true };
  },
);
