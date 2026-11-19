"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction, ValidationError } from "@/base/api";
import { mvDrivers } from "../schema";

/** Offer to drive, or withdraw the offer. Withdrawing also drops any clearance. */
export const offerToDrive = moduleAction(
  "mv",
  { input: z.object({ offer: z.boolean() }), capability: "mv.view" },
  async (ctx, { offer }) => {
    const personId = ctx.actor.personId;
    if (!personId) throw new ValidationError("Only members can offer to drive");
    if (offer) {
      await ctx.tx
        .insert(mvDrivers)
        .values({ editionId: ctx.edition.id, personId })
        .onConflictDoNothing();
    } else {
      await ctx.tx
        .delete(mvDrivers)
        .where(and(eq(mvDrivers.editionId, ctx.edition.id), eq(mvDrivers.personId, personId)));
    }
    return { ok: true as const };
  },
);

/** The DMV contact clears a driver (or takes the clearance back). Audited. */
export const setCleared = moduleAction(
  "mv",
  {
    input: z.object({
      id: z.string().uuid(),
      cleared: z.boolean(),
      note: z.string().trim().max(200),
    }),
    capability: "mv.manage",
  },
  async (ctx, { id, cleared, note }) => {
    await ctx.tx
      .update(mvDrivers)
      .set({ cleared, note })
      .where(and(eq(mvDrivers.id, id), eq(mvDrivers.editionId, ctx.edition.id)));
    await ctx.audit.record({
      action: cleared ? "mv.driver.cleared" : "mv.driver.uncleared",
      entity: { type: "mv.driver", id },
      changes: { cleared },
      significance: "significant",
    });
    return { ok: true as const };
  },
);
