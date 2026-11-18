"use server";
// Drop a shift, join standby, and take or pass on an offered place (automatic rule 1).
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  type ActionContext,
  ForbiddenError,
  getAutomationSettings,
  moduleAction,
  ValidationError,
} from "@/base/api";
import { claimProblem } from "../rules/contribution";
import { nextOnStandby, shouldOffer } from "../rules/standby";
import {
  shiftsDutyTypes as dt,
  shiftsStandby as sb,
  shiftsSlots as sl,
  shiftsSignups as su,
} from "../schema";
import { myShifts, mySkillIds, settingsOf } from "./queries";

const DEAD = ["released", "swapped_out"] as const;
const input = z.object({ slotId: z.string().uuid() });
type Ctx = Pick<ActionContext, "tx" | "edition" | "now">;

async function lockSlot(ctx: Ctx, slotId: string) {
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
    .where(and(eq(sl.id, slotId), eq(sl.editionId, ctx.edition.id)))
    .for("update", { of: sl });
  if (!slot) throw new ValidationError("That shift isn't in this year's roster");
  return slot;
}

const liveOn = (ctx: Ctx, slotId: string) =>
  ctx.tx
    .select({ id: su.id, personId: su.personId })
    .from(su)
    .where(and(eq(su.slotId, slotId), notInArray(su.status, [...DEAD])));

const standbyOf = (ctx: Ctx, slotId: string) =>
  ctx.tx.select().from(sb).where(eq(sb.slotId, slotId)).orderBy(asc(sb.createdAt));

/** Offer a free place to the first person waiting, when the camp has the rule on. */
async function offerNext(ctx: Ctx, slot: { id: string; startsAt: Date }, droppedBy: string | null) {
  const rows = await standbyOf(ctx, slot.id);
  const ruleOn = ((await getAutomationSettings(ctx.tx)).shift_standby_offer ?? 1) === 1;
  if (!shouldOffer({ ruleOn, startsAt: slot.startsAt, now: ctx.now, rows })) return null;
  const next = nextOnStandby(rows);
  if (!next) return null;
  await ctx.tx
    .update(sb)
    .set({
      status: "offered",
      offeredAt: ctx.now,
      droppedByPersonId: droppedBy,
      updatedAt: ctx.now,
    })
    .where(eq(sb.id, next.id));
  return next.personId;
}

/** Give up a shift you're on. The place goes back to open and to the first person on standby. */
export const dropShift = moduleAction(
  "shifts",
  { input, capability: "shifts.claim" },
  async (ctx, { slotId }) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const slot = await lockSlot(ctx, slotId);
    const settings = await settingsOf(ctx.tx, ctx.edition.id);
    if (!settings) throw new ValidationError("Shifts aren't set up yet");
    if (slot.startsAt <= ctx.now) throw new ValidationError("This shift has started");
    if (ctx.now >= settings.freezeAt)
      throw new ValidationError("Sign-ups are frozen. Ask for cover or talk to the duty lead");
    const mine = (await liveOn(ctx, slotId)).find((l) => l.personId === me);
    if (!mine) throw new ValidationError("You're not on this shift");
    await ctx.tx
      .update(su)
      .set({ status: "released", updatedAt: ctx.now })
      .where(eq(su.id, mine.id));
    if (slot.status === "filled")
      await ctx.tx.update(sl).set({ status: "open", updatedAt: ctx.now }).where(eq(sl.id, slot.id));
    const offeredTo = await offerNext(ctx, slot, me);
    await ctx.audit.record({
      action: "shifts.dropped",
      entity: { type: "shifts.slot", id: slot.id },
      changes: { signup: [mine.id, null], offeredTo: [null, offeredTo] },
      significance: "activity",
    });
    return { ok: true as const, offered: offeredTo !== null };
  },
);

/** Wait for a place on a full shift. */
export const joinStandby = moduleAction(
  "shifts",
  { input, capability: "shifts.claim" },
  async (ctx, { slotId }) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const slot = await lockSlot(ctx, slotId);
    const live = await liveOn(ctx, slotId);
    if (live.some((l) => l.personId === me))
      throw new ValidationError("You're already on this shift");
    if (live.length < slot.maxStaff)
      throw new ValidationError("This shift has room. Claim it instead");
    if (slot.startsAt <= ctx.now) throw new ValidationError("This shift has started");
    await ctx.tx.insert(sb).values({ slotId, personId: me }).onConflictDoNothing();
    return { ok: true as const };
  },
);

/** Stop waiting, or pass on an offered place (it then goes to the next person waiting). */
export const leaveStandby = moduleAction(
  "shifts",
  { input, capability: "shifts.claim" },
  async (ctx, { slotId }) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const slot = await lockSlot(ctx, slotId);
    const [row] = await ctx.tx
      .select()
      .from(sb)
      .where(
        and(eq(sb.slotId, slotId), eq(sb.personId, me), inArray(sb.status, ["waiting", "offered"])),
      );
    if (!row) throw new ValidationError("You're not on standby for this shift");
    await ctx.tx
      .update(sb)
      .set({
        status: row.status === "offered" ? "passed" : "left",
        decidedAt: ctx.now,
        updatedAt: ctx.now,
      })
      .where(eq(sb.id, row.id));
    if (row.status === "offered") await offerNext(ctx, slot, row.droppedByPersonId);
    return { ok: true as const };
  },
);

/** Say yes to an offered place. The same checks as claiming, then the duty lead is told. */
export const takeStandby = moduleAction(
  "shifts",
  { input, capability: "shifts.claim" },
  async (ctx, { slotId }) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    const slot = await lockSlot(ctx, slotId);
    const [row] = await ctx.tx
      .select()
      .from(sb)
      .where(and(eq(sb.slotId, slotId), eq(sb.personId, me), eq(sb.status, "offered")));
    if (!row) throw new ValidationError("This shift isn't on offer to you any more");
    const settings = await settingsOf(ctx.tx, ctx.edition.id);
    if (!settings) throw new ValidationError("Shifts aren't set up yet");
    const live = await liveOn(ctx, slotId);
    const problem = claimProblem({
      now: ctx.now,
      // An offer made before the freeze can still be taken.
      freezeAt: new Date(Math.max(settings.freezeAt.getTime(), slot.startsAt.getTime())),
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      slotStatus: slot.status,
      liveCount: live.length,
      maxStaff: slot.maxStaff,
      requiredSkillId: slot.requiredSkillId,
      mySkillIds: await mySkillIds(ctx.tx, me),
      alreadyOn: live.some((l) => l.personId === me),
      myShifts: await myShifts(ctx.tx, ctx.edition.id, me),
    });
    if (problem) throw new ValidationError(problem);
    await ctx.tx.insert(su).values({ slotId, personId: me, source: "claimed" });
    if (live.length + 1 >= slot.maxStaff)
      await ctx.tx
        .update(sl)
        .set({ status: "filled", updatedAt: ctx.now })
        .where(eq(sl.id, slotId));
    await ctx.tx
      .update(sb)
      .set({ status: "took", decidedAt: ctx.now, updatedAt: ctx.now })
      .where(eq(sb.id, row.id));
    await ctx.audit.record({
      action: "shifts.standby_took",
      entity: { type: "shifts.slot", id: slotId },
      changes: { standby: [row.id, row.id] },
      significance: "activity",
    });
    return { ok: true as const };
  },
);
