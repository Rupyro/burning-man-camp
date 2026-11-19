"use server";
import { z } from "zod";
import { moduleAction } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { isClockTime } from "../rules/sound";
import { soundNeighborLog, soundPlans } from "../schema";

const clock = z.string().refine(isClockTime, "Use a time like 03:00");
const text = (max: number) => z.string().trim().max(max);

export const savePlan = moduleAction(
  "sound",
  {
    input: z.object({
      quietFrom: clock,
      quietUntil: clock,
      maxDb: z.number().int().min(40).max(140),
      speakersFace: text(120).nullable(),
      notes: text(1000).nullable(),
    }),
    capability: "sound.manage",
  },
  async (ctx, input) => {
    const values = {
      ...input,
      speakersFace: input.speakersFace || null,
      notes: input.notes || null,
      updatedAt: ctx.now,
    };
    await ctx.tx
      .insert(soundPlans)
      .values({ editionId: ctx.edition.id, ...values })
      .onConflictDoUpdate({ target: soundPlans.editionId, set: values });
    await ctx.audit.record({
      action: "sound.plan.saved",
      entity: { type: "sound.plan", id: ctx.edition.id },
      changes: { plan: [null, values] },
      significance: "significant",
    });
    return { ok: true as const };
  },
);

export const logVisit = moduleAction(
  "sound",
  {
    input: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
      time: clock,
      neighbor: text(80).min(1, "Which camp or person?"),
      what: text(500).min(1, "What did they say?"),
      action: text(500).nullable(),
    }),
    capability: "sound.view",
  },
  async (ctx, input) => {
    await ctx.tx.insert(soundNeighborLog).values({
      editionId: ctx.edition.id,
      at: campInputToInstant(input.date, input.time),
      neighbor: input.neighbor,
      what: input.what,
      action: input.action || null,
      loggedByPersonId: ctx.actor.personId,
    });
    return { ok: true as const };
  },
);
