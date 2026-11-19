"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction } from "@/base/api";
import { DIRECTIONS, RESOURCES } from "../rules/village";
import { villageShares } from "../schema";

export const addShare = moduleAction(
  "village",
  {
    input: z.object({
      partner: z.string().trim().min(1, "Which camp?").max(80),
      direction: z.enum(DIRECTIONS),
      resource: z.enum(RESOURCES),
      item: z.string().trim().min(1, "Say what it is").max(120),
      quantity: z.number().int().min(1).max(100_000),
      notes: z.string().trim().max(300),
    }),
    capability: "village.manage",
  },
  async (ctx, input) => {
    const [row] = await ctx.tx
      .insert(villageShares)
      .values({ editionId: ctx.edition.id, ...input })
      .returning({ id: villageShares.id });
    return { ok: true as const, id: row?.id ?? null };
  },
);

/** Mark a share returned (or not, to undo). */
export const setReturned = moduleAction(
  "village",
  {
    input: z.object({ id: z.string().uuid(), returned: z.boolean() }),
    capability: "village.manage",
  },
  async (ctx, { id, returned }) => {
    await ctx.tx
      .update(villageShares)
      .set({ returned })
      .where(and(eq(villageShares.id, id), eq(villageShares.editionId, ctx.edition.id)));
    return { ok: true as const };
  },
);
