"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { moduleAction, ValidationError } from "@/base/api";
import { campInputToInstant } from "@/lib/dates";
import { CATEGORIES } from "../rules/schedule";
import { scheduleEvents } from "../schema";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 14:00");

export const addEvent = moduleAction(
  "schedule",
  {
    input: z.object({
      title: z.string().trim().min(1, "Give it a name").max(120),
      description: z.string().trim().max(1000),
      category: z.enum(CATEGORIES),
      date: day,
      start: clock,
      end: clock,
      location: z.string().trim().max(120),
      hostPersonId: z.string().uuid().nullable(),
    }),
    capability: "schedule.manage",
  },
  async (ctx, input) => {
    const startsAt = campInputToInstant(input.date, input.start);
    let endsAt = campInputToInstant(input.date, input.end);
    // An end before the start means it runs past midnight.
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000);
    if (endsAt.getTime() - startsAt.getTime() > 12 * 3_600_000)
      throw new ValidationError("An event can run 12 hours at most");
    const [row] = await ctx.tx
      .insert(scheduleEvents)
      .values({
        editionId: ctx.edition.id,
        title: input.title,
        description: input.description,
        category: input.category,
        startsAt,
        endsAt,
        location: input.location || "At camp",
        hostPersonId: input.hostPersonId,
      })
      .returning({ id: scheduleEvents.id });
    return { ok: true as const, id: row?.id ?? null };
  },
);

export const removeEvent = moduleAction(
  "schedule",
  { input: z.object({ id: z.string().uuid() }), capability: "schedule.manage" },
  async (ctx, { id }) => {
    await ctx.tx
      .delete(scheduleEvents)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.editionId, ctx.edition.id)));
    await ctx.audit.record({
      action: "schedule.event.removed",
      entity: { type: "schedule.event", id },
      changes: {},
      significance: "significant",
    });
    return { ok: true as const };
  },
);
