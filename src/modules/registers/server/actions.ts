"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction, ValidationError } from "@/base/api";
import { KINDS } from "../rules/registers";
import { registersItems } from "../schema";

export const addItem = moduleAction(
  "registers",
  {
    input: z.object({
      kind: z.enum(KINDS),
      label: z.string().trim().min(1, "Say what it is").max(120),
      quantity: z.number().int().min(1).max(100_000),
      location: z.string().trim().max(120),
      notes: z.string().trim().max(500),
      ownerPersonId: z.string().uuid().nullable(),
    }),
    capability: "registers.manage",
  },
  async (ctx, input) => {
    const [row] = await ctx.tx
      .insert(registersItems)
      .values({ editionId: ctx.edition.id, ...input })
      .returning({ id: registersItems.id });
    return { ok: true as const, id: row?.id ?? null };
  },
);

/** Count stakes pulled at strike; can't pull more than went in. */
export const setPulled = moduleAction(
  "registers",
  {
    input: z.object({ id: z.string().uuid(), pulled: z.number().int().min(0) }),
    capability: "registers.manage",
  },
  async (ctx, { id, pulled }) => {
    const where = and(eq(registersItems.id, id), eq(registersItems.editionId, ctx.edition.id));
    const [row] = await ctx.tx
      .select({ kind: registersItems.kind, quantity: registersItems.quantity })
      .from(registersItems)
      .where(where);
    if (row?.kind !== "stake") throw new ValidationError("Only stake lines are counted");
    if (pulled > row.quantity) throw new ValidationError("More pulled than went in");
    await ctx.tx.update(registersItems).set({ pulled }).where(where);
    return { ok: true as const };
  },
);

export const removeItem = moduleAction(
  "registers",
  { input: z.object({ id: z.string().uuid() }), capability: "registers.manage" },
  async (ctx, { id }) => {
    await ctx.tx
      .delete(registersItems)
      .where(and(eq(registersItems.id, id), eq(registersItems.editionId, ctx.edition.id)));
    await ctx.audit.record({
      action: "registers.item.removed",
      entity: { type: "registers.item", id },
      changes: {},
      significance: "significant",
    });
    return { ok: true as const };
  },
);
