// "What to bring" ticks: only ever the caller's own rows, only items on the packing list.
import { and, eq } from "drizzle-orm";
import { isPackingKey } from "@/lib/packing";
import { type EngineCtx, nowOf } from "../engine/shared";
import { ForbiddenError, ValidationError } from "../errors";
import { packingTicks } from "../schema";

export async function myPackingTicks(ctx: EngineCtx): Promise<string[]> {
  if (!ctx.actor.personId) return [];
  const rows = await ctx.db
    .select({ key: packingTicks.itemKey })
    .from(packingTicks)
    .where(
      and(
        eq(packingTicks.editionId, ctx.edition.id),
        eq(packingTicks.personId, ctx.actor.personId),
      ),
    );
  return rows.map((r) => r.key);
}

export async function setMyPackingTick(ctx: EngineCtx, key: string, on: boolean) {
  const personId = ctx.actor.personId;
  if (!personId) throw new ForbiddenError();
  if (!isPackingKey(key)) throw new ValidationError("That isn't on the packing list");
  const mine = and(
    eq(packingTicks.editionId, ctx.edition.id),
    eq(packingTicks.personId, personId),
    eq(packingTicks.itemKey, key),
  );
  if (on)
    await ctx.db
      .insert(packingTicks)
      .values({ editionId: ctx.edition.id, personId, itemKey: key, tickedAt: nowOf(ctx) })
      .onConflictDoNothing();
  else await ctx.db.delete(packingTicks).where(mine);
  return { key, on };
}
