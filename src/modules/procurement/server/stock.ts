"use server";
// Catalogue, places, suppliers and stock counts (docs/specs/procurement.md §2, §4).
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type ActionContext, moduleAction, ValidationError } from "@/base/api";
import { OWNER_KEYS } from "@/lib/camp-config";
import { isCampCategory, parseImport } from "../rules/csv";
import type { Condition } from "../rules/have-it";
import {
  procurementItems as items,
  procurementLocations as locations,
  procurementStockMovements as moves,
  procurementStock as stock,
  procurementSuppliers as suppliers,
} from "../schema";

const CONDITIONS = ["good", "needs_repair", "broken", "missing"] as const;
const OWNERS = OWNER_KEYS;
const qtyText = z.string().max(20);

function quantity(text: string): number {
  const n = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 99_999_999 || text.trim() === "")
    throw new ValidationError("Use a count like 3 or 2.5");
  return Math.round(n * 100) / 100;
}

/** Set one count (item, place, condition) and log the change as a movement. */
async function setOne(
  ctx: ActionContext,
  x: { itemId: string; locationId: string; condition: Condition; quantity: number; note?: string },
) {
  await ctx.tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`procurement_stock:${x.itemId}:${x.locationId}:${x.condition}`}))`,
  );
  const [old] = await ctx.tx
    .select()
    .from(stock)
    .where(
      and(
        eq(stock.itemId, x.itemId),
        eq(stock.locationId, x.locationId),
        eq(stock.condition, x.condition),
      ),
    );
  const before = old?.quantity ?? 0;
  if (old) {
    await ctx.tx
      .update(stock)
      .set({
        quantity: x.quantity,
        countedAt: ctx.now,
        countedByPersonId: ctx.actor.personId,
        updatedAt: ctx.now,
        version: old.version + 1,
      })
      .where(eq(stock.id, old.id));
  } else {
    await ctx.tx.insert(stock).values({
      itemId: x.itemId,
      locationId: x.locationId,
      condition: x.condition,
      quantity: x.quantity,
      countedAt: ctx.now,
      countedByPersonId: ctx.actor.personId,
    });
  }
  if (before !== x.quantity) {
    await ctx.tx.insert(moves).values({
      itemId: x.itemId,
      toLocationId: x.locationId,
      condition: x.condition,
      delta: Math.round((x.quantity - before) * 100) / 100,
      reason: "count",
      note: x.note ?? null,
      actorPersonId: ctx.actor.personId,
      at: ctx.now,
    });
  }
  return before;
}

/** A member on site updates a count from their phone (P2). */
export const setCount = moduleAction(
  "procurement",
  {
    input: z.object({
      itemId: z.string().uuid(),
      locationId: z.string().uuid(),
      condition: z.enum(CONDITIONS),
      quantity: qtyText,
      note: z.string().max(200).optional(),
    }),
    capability: "procurement.stock.count",
  },
  async (ctx, input) => {
    const q = quantity(input.quantity);
    const [item] = await ctx.tx
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, input.itemId));
    const [loc] = await ctx.tx
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.id, input.locationId));
    if (!item || !loc) throw new ValidationError("Pick an item and a place");
    const before = await setOne(ctx, { ...input, quantity: q });
    await ctx.audit.record({
      action: "procurement.stock.counted",
      entity: { type: "procurement.item", id: input.itemId },
      changes: { [`${input.condition}@${input.locationId}`]: [before, q] },
    });
    return { ok: true as const, before, after: q };
  },
);

const itemFields = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().refine(isCampCategory, "Pick one of the camp's categories"),
  unit: z.string().trim().min(1).max(16),
  ownerLabel: z.enum(OWNERS).optional(),
  isBottleneck: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

async function nameTaken(ctx: ActionContext, name: string, exceptId?: string) {
  const [x] = await ctx.tx
    .select({ id: items.id })
    .from(items)
    .where(sql`lower(${items.name}) = lower(${name})`);
  return x !== undefined && x.id !== exceptId;
}

export const createItem = moduleAction(
  "procurement",
  { input: itemFields, capability: "procurement.catalogue.manage" },
  async (ctx, input) => {
    if (await nameTaken(ctx, input.name))
      throw new ValidationError("That item is already in the catalogue");
    const [row] = await ctx.tx.insert(items).values(input).returning();
    if (!row) throw new ValidationError("Could not save");
    await ctx.audit.record({
      action: "procurement.item.created",
      entity: { type: "procurement.item", id: row.id },
      changes: { name: [null, row.name] },
    });
    return { ok: true as const, id: row.id };
  },
);

export const updateItem = moduleAction(
  "procurement",
  {
    input: itemFields.extend({ id: z.string().uuid() }),
    capability: "procurement.catalogue.manage",
  },
  async (ctx, { id, ...input }) => {
    const [old] = await ctx.tx.select().from(items).where(eq(items.id, id));
    if (!old) throw new ValidationError("No such item");
    if (await nameTaken(ctx, input.name, id)) throw new ValidationError("That name is taken");
    await ctx.tx
      .update(items)
      .set({ ...input, updatedAt: ctx.now, version: old.version + 1 })
      .where(eq(items.id, id));
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(input)) {
      const was = old[k as keyof typeof old];
      if (v !== undefined && v !== was) changes[k] = [was, v];
    }
    await ctx.audit.record({
      action: "procurement.item.updated",
      entity: { type: "procurement.item", id },
      changes,
    });
    return { ok: true as const };
  },
);

export const createLocation = moduleAction(
  "procurement",
  {
    input: z.object({
      name: z.string().trim().min(1).max(80),
      kind: z.enum(["container", "storage", "site_area", "person"]),
      description: z.string().max(500).optional(),
    }),
    capability: "procurement.catalogue.manage",
  },
  async (ctx, input) => {
    const [dup] = await ctx.tx
      .select({ id: locations.id })
      .from(locations)
      .where(sql`lower(${locations.name}) = lower(${input.name})`);
    if (dup) throw new ValidationError("That place already exists");
    const [row] = await ctx.tx.insert(locations).values(input).returning();
    await ctx.audit.record({
      action: "procurement.location.created",
      entity: { type: "procurement.location", id: row?.id ?? "" },
      changes: { name: [null, input.name] },
    });
    return { ok: true as const, id: row?.id ?? "" };
  },
);

export const createSupplier = moduleAction(
  "procurement",
  {
    input: z.object({
      name: z.string().trim().min(1).max(120),
      category: z.string().max(60).optional(),
      contactName: z.string().max(120).optional(),
      contactPhone: z.string().max(32).optional(),
      email: z.string().email().max(200).optional(),
      website: z.string().url().max(300).optional(),
      notes: z.string().max(1000).optional(),
    }),
    capability: "procurement.catalogue.manage",
  },
  async (ctx, input) => {
    const [row] = await ctx.tx.insert(suppliers).values(input).returning();
    await ctx.audit.record({
      action: "procurement.supplier.created",
      entity: { type: "procurement.supplier", id: row?.id ?? "" },
      changes: { name: [null, input.name] },
    });
    return { ok: true as const, id: row?.id ?? "" };
  },
);

/** CSV import of the catalogue and counts (P7). New items and places are created by name. */
export const importCsv = moduleAction(
  "procurement",
  {
    input: z.object({ text: z.string().max(500_000) }),
    capability: "procurement.catalogue.manage",
  },
  async (ctx, input) => {
    const parsed = parseImport(input.text);
    if (parsed.errors.length) return { ok: false as const, imported: 0, errors: parsed.errors };
    const itemIds = new Map<string, string>();
    const placeIds = new Map<string, string>();
    for (const r of parsed.rows) {
      const ik = r.name.toLowerCase();
      if (!itemIds.has(ik)) {
        const [found] = await ctx.tx
          .select({ id: items.id })
          .from(items)
          .where(sql`lower(${items.name}) = ${ik}`);
        const id =
          found?.id ??
          (
            await ctx.tx
              .insert(items)
              .values({ name: r.name, category: r.category, unit: r.unit })
              .returning()
          )[0]?.id;
        itemIds.set(ik, id ?? "");
      }
      const pk = r.location.toLowerCase();
      if (!placeIds.has(pk)) {
        const [found] = await ctx.tx
          .select({ id: locations.id })
          .from(locations)
          .where(sql`lower(${locations.name}) = ${pk}`);
        const id =
          found?.id ??
          (await ctx.tx.insert(locations).values({ name: r.location }).returning())[0]?.id;
        placeIds.set(pk, id ?? "");
      }
      await setOne(ctx, {
        itemId: itemIds.get(ik) ?? "",
        locationId: placeIds.get(pk) ?? "",
        condition: r.condition,
        quantity: r.quantity,
        note: "CSV import",
      });
    }
    await ctx.audit.record({
      action: "procurement.catalogue.imported",
      entity: { type: "procurement.catalogue", id: ctx.edition.id },
      changes: { rows: [null, parsed.rows.length], items: [null, itemIds.size] },
      significance: "significant",
    });
    return { ok: true as const, imported: parsed.rows.length, errors: [] };
  },
);
