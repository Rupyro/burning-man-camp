"use server";
// Claim an open shift and tick its checklist (plan-shifts.md). Never assigns anyone else.
import { and, eq, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ForbiddenError, moduleAction, ValidationError } from "@/base/api";
import { claimProblem } from "../rules/contribution";
import {
  shiftsDutyTypes as dt,
  shiftsChecklistItems,
  shiftsChecklistTicks,
  shiftsSlots as sl,
  shiftsSignups as su,
} from "../schema";
import { myShifts, mySkillIds, settingsOf } from "./queries";

const DEAD = ["released", "swapped_out"] as const;

export const claimShift = moduleAction(
  "shifts",
  { input: z.object({ slotId: z.string().uuid() }), capability: "shifts.claim" },
  async (ctx, input) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const [slot] = await ctx.tx
      .select({
        id: sl.id,
        startsAt: sl.startsAt,
        endsAt: sl.endsAt,
        status: sl.status,
        requiredSkillId: dt.requiredSkillId,
        maxStaff: sql<number>`coalesce(${sl.maxStaff}, ${dt.maxStaff})`.mapWith(Number),
      })
      .from(sl)
      .innerJoin(dt, eq(dt.id, sl.dutyTypeId))
      .where(and(eq(sl.id, input.slotId), eq(sl.editionId, ctx.edition.id)))
      .for("update", { of: sl });
    if (!slot) throw new ValidationError("That shift isn't in this year's roster");
    const settings = await settingsOf(ctx.tx, ctx.edition.id);
    if (!settings) throw new ValidationError("Shifts aren't set up yet");
    const live = await ctx.tx
      .select({ personId: su.personId })
      .from(su)
      .where(and(eq(su.slotId, slot.id), notInArray(su.status, [...DEAD])));
    const mine = await myShifts(ctx.tx, ctx.edition.id, me);
    const problem = claimProblem({
      now: ctx.now,
      freezeAt: settings.freezeAt,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      slotStatus: slot.status,
      liveCount: live.length,
      maxStaff: slot.maxStaff,
      requiredSkillId: slot.requiredSkillId,
      mySkillIds: await mySkillIds(ctx.tx, me),
      alreadyOn: live.some((l) => l.personId === me),
      myShifts: mine,
    });
    if (problem) throw new ValidationError(problem);
    const [row] = await ctx.tx
      .insert(su)
      .values({ slotId: slot.id, personId: me, source: "claimed" })
      .returning({ id: su.id });
    if (live.length + 1 >= slot.maxStaff)
      await ctx.tx
        .update(sl)
        .set({ status: "filled", updatedAt: ctx.now })
        .where(eq(sl.id, slot.id));
    await ctx.audit.record({
      action: "shifts.claimed",
      entity: { type: "shifts.slot", id: slot.id },
      changes: { signup: [null, row?.id ?? ""] },
      significance: "activity",
    });
    return { ok: true as const };
  },
);

/** Tick or untick a checklist item; only people on the shift. */
export const tickItem = moduleAction(
  "shifts",
  {
    input: z.object({ slotId: z.string().uuid(), itemId: z.string().uuid(), ticked: z.boolean() }),
    capability: "shifts.view",
  },
  async (ctx, input) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const [on] = await ctx.tx
      .select({ id: su.id, dutyTypeId: sl.dutyTypeId })
      .from(su)
      .innerJoin(sl, eq(sl.id, su.slotId))
      .where(
        and(
          eq(su.slotId, input.slotId),
          eq(su.personId, me),
          eq(sl.editionId, ctx.edition.id),
          notInArray(su.status, [...DEAD]),
        ),
      );
    if (!on) throw new ForbiddenError("Only people on this shift can tick its checklist");
    const [item] = await ctx.tx
      .select({ id: shiftsChecklistItems.id })
      .from(shiftsChecklistItems)
      .where(
        and(
          eq(shiftsChecklistItems.id, input.itemId),
          eq(shiftsChecklistItems.dutyTypeId, on.dutyTypeId),
        ),
      );
    if (!item) throw new ValidationError("That item isn't on this shift's checklist");
    if (input.ticked)
      await ctx.tx
        .insert(shiftsChecklistTicks)
        .values({
          slotId: input.slotId,
          checklistItemId: item.id,
          tickedByPersonId: me,
          tickedAt: ctx.now,
        })
        .onConflictDoNothing();
    else
      await ctx.tx
        .delete(shiftsChecklistTicks)
        .where(
          and(
            eq(shiftsChecklistTicks.slotId, input.slotId),
            eq(shiftsChecklistTicks.checklistItemId, item.id),
          ),
        );
    return { ok: true as const };
  },
);
