"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction, ValidationError } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { exodusDepartures } from "../schema";

/** Set (or change) when I leave and whether I stay for the final sweep. */
export const setMyDeparture = moduleAction(
  "exodus",
  {
    input: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the day"),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00"),
      staysForSweep: z.boolean(),
      travel: z.string().trim().max(200),
    }),
    capability: "exodus.view",
  },
  async (ctx, input) => {
    const personId = ctx.actor.personId;
    if (!personId) throw new ValidationError("Only members can set a departure");
    const values = {
      departsAt: campInputToInstant(input.date, input.time),
      staysForSweep: input.staysForSweep,
      travel: input.travel,
      updatedAt: new Date(),
    };
    await ctx.tx
      .insert(exodusDepartures)
      .values({ editionId: ctx.edition.id, personId, ...values })
      .onConflictDoUpdate({
        target: [exodusDepartures.editionId, exodusDepartures.personId],
        set: values,
      });
    return { ok: true as const };
  },
);

export const clearMyDeparture = moduleAction(
  "exodus",
  { input: z.object({}), capability: "exodus.view" },
  async (ctx) => {
    const personId = ctx.actor.personId;
    if (!personId) return { ok: true as const };
    await ctx.tx
      .delete(exodusDepartures)
      .where(
        and(
          eq(exodusDepartures.editionId, ctx.edition.id),
          eq(exodusDepartures.personId, personId),
        ),
      );
    return { ok: true as const };
  },
);
