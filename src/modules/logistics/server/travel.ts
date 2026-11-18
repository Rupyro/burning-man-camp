"use server";
// Members' travel plans and the ride board (docs/specs/logistics.md §2-§5, L3, L4, L6).
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { type ActionContext, ForbiddenError, moduleAction, ValidationError } from "@/base/api";
import { seatsLeft } from "../rules/rides";
import {
  logisticsRideMatches as matches,
  logisticsPlaces as places,
  logisticsTravelPlans as plans,
} from "../schema";

const id = z.string().uuid();
const direction = z.enum(["to_burn", "from_burn"]);

async function myPlan(ctx: ActionContext, planId: string) {
  const [row] = await ctx.tx
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.editionId, ctx.edition.id)))
    .for("update");
  if (!row) throw new ValidationError("That travel plan isn't in this year's list");
  return row;
}

/** Add or change your own plan for one direction (one per person, direction and year). */
export const saveTravel = moduleAction(
  "logistics",
  {
    input: z.object({
      direction,
      mode: z.enum(["offering_ride", "need_ride", "own_arrangement"]),
      travelDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-04-21")
        .nullable()
        .optional(),
      timeOfDay: z.enum(["morning", "afternoon", "evening", "flexible"]).optional(),
      areaPlaceId: id.nullable().optional(),
      areaDetail: z.string().trim().max(120).optional(),
      seats: z.number().int().min(1).max(20).nullable().optional(),
      carriesCargo: z.boolean().optional(),
      notes: z.string().trim().max(500).optional(),
    }),
    capability: "logistics.travel.edit",
  },
  async (ctx, input) => {
    const me = ctx.actor.personId;
    if (!me) throw new ForbiddenError("Sign in first");
    if (input.areaPlaceId) {
      const [p] = await ctx.tx
        .select({ id: places.id })
        .from(places)
        .where(eq(places.id, input.areaPlaceId));
      if (!p) throw new ValidationError("Pick an area from the list");
    }
    if (input.seats && input.seats > 10 && input.mode === "need_ride")
      throw new ValidationError("Ask for up to 10 seats");
    const values = {
      mode: input.mode,
      travelDate: input.travelDate ?? null,
      timeOfDay: input.timeOfDay ?? "flexible",
      areaPlaceId: input.areaPlaceId ?? null,
      areaDetail: input.areaDetail || null,
      seatsOffered: input.mode === "offering_ride" ? (input.seats ?? 1) : null,
      seatsNeeded: input.mode === "need_ride" ? (input.seats ?? 1) : null,
      carriesCargo: input.carriesCargo ?? false,
      notes: input.notes || null,
    };
    const [old] = await ctx.tx
      .select()
      .from(plans)
      .where(
        and(
          eq(plans.editionId, ctx.edition.id),
          eq(plans.personId, me),
          eq(plans.direction, input.direction),
        ),
      )
      .for("update");
    if (!old) {
      const [row] = await ctx.tx
        .insert(plans)
        .values({ ...values, editionId: ctx.edition.id, personId: me, direction: input.direction })
        .returning();
      await ctx.audit.record({
        action: "logistics.travel.added",
        entity: { type: "logistics.travel_plan", id: row?.id ?? "" },
        changes: { mode: [null, values.mode], travelDate: [null, values.travelDate] },
      });
      return { ok: true as const, id: row?.id ?? "" };
    }
    // Changing what you're doing cancels rides that no longer make sense.
    const live = await ctx.tx
      .select()
      .from(matches)
      .where(or(eq(matches.driverPlanId, old.id), eq(matches.passengerPlanId, old.id)));
    const keepAsDriver = values.mode === "offering_ride";
    const keepAsPassenger = values.mode === "need_ride";
    const accepted = live.filter(
      (m) =>
        m.status === "accepted" &&
        ((m.driverPlanId === old.id && keepAsDriver) ||
          (m.passengerPlanId === old.id && keepAsPassenger)),
    );
    const seatsTaken = accepted
      .filter((m) => m.driverPlanId === old.id)
      .reduce((t, m) => t + m.seats, 0);
    if (keepAsDriver && (values.seatsOffered ?? 0) < seatsTaken)
      throw new ValidationError(`You've already said yes to ${seatsTaken} passenger seat(s)`);
    for (const m of live) {
      const stillFits =
        (m.driverPlanId === old.id && keepAsDriver) ||
        (m.passengerPlanId === old.id && keepAsPassenger);
      if (stillFits || m.status === "declined" || m.status === "cancelled") continue;
      await ctx.tx
        .update(matches)
        .set({
          status: "cancelled",
          decidedAt: ctx.now,
          updatedAt: ctx.now,
          version: m.version + 1,
        })
        .where(eq(matches.id, m.id));
    }
    const changes: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of Object.entries(values)) {
      const before = old[k as keyof typeof old];
      if ((before ?? null) !== v) changes[k] = [before ?? null, v];
    }
    if (!Object.keys(changes).length) return { ok: true as const, id: old.id };
    await ctx.tx
      .update(plans)
      .set({ ...values, updatedAt: ctx.now, version: old.version + 1 })
      .where(eq(plans.id, old.id));
    await ctx.audit.record({
      action: "logistics.travel.changed",
      entity: { type: "logistics.travel_plan", id: old.id },
      changes,
    });
    return { ok: true as const, id: old.id };
  },
);

/** Ask a driver for a seat, from your own "need a ride" plan (L4). */
export const askRide = moduleAction(
  "logistics",
  {
    input: z.object({ passengerPlanId: id, driverPlanId: id }),
    capability: "logistics.ride.ask",
  },
  async (ctx, input) => {
    const mine = await myPlan(ctx, input.passengerPlanId);
    if (mine.personId !== ctx.actor.personId) throw new ForbiddenError("That's not your plan");
    if (mine.mode !== "need_ride") throw new ValidationError("Say you need a ride first");
    const offer = await myPlan(ctx, input.driverPlanId);
    if (offer.mode !== "offering_ride" || offer.direction !== mine.direction)
      throw new ValidationError("That ride isn't going your way");
    if (offer.personId === mine.personId) throw new ValidationError("That's your own ride");
    const all = await ctx.tx.select().from(matches).where(eq(matches.driverPlanId, offer.id));
    const want = mine.seatsNeeded ?? 1;
    if (seatsLeft(offer, all) < want) throw new ValidationError("That ride is full");
    const existing = all.find((m) => m.passengerPlanId === mine.id);
    if (existing && (existing.status === "proposed" || existing.status === "accepted"))
      return { ok: true as const, id: existing.id, already: true };
    let matchId: string;
    if (existing) {
      await ctx.tx
        .update(matches)
        .set({
          status: "proposed",
          seats: want,
          askedAt: ctx.now,
          decidedAt: null,
          updatedAt: ctx.now,
          version: existing.version + 1,
        })
        .where(eq(matches.id, existing.id));
      matchId = existing.id;
    } else {
      const [row] = await ctx.tx
        .insert(matches)
        .values({ driverPlanId: offer.id, passengerPlanId: mine.id, seats: want, askedAt: ctx.now })
        .returning();
      matchId = row?.id ?? "";
    }
    await ctx.audit.record({
      action: "logistics.ride.asked",
      entity: { type: "logistics.ride_match", id: matchId },
      changes: { status: [existing?.status ?? null, "proposed"], seats: [null, want] },
    });
    return { ok: true as const, id: matchId, already: false };
  },
);

async function lockMatch(ctx: ActionContext, matchId: string) {
  const [m] = await ctx.tx.select().from(matches).where(eq(matches.id, matchId)).for("update");
  if (!m) throw new ValidationError("That ride request is gone");
  const driver = await myPlan(ctx, m.driverPlanId);
  const passenger = await myPlan(ctx, m.passengerPlanId);
  return { m, driver, passenger };
}

/** The driver says yes or no to a seat request. */
export const answerRide = moduleAction(
  "logistics",
  {
    input: z.object({ matchId: id, answer: z.enum(["accepted", "declined"]) }),
    capability: "logistics.travel.edit",
  },
  async (ctx, input) => {
    const { m, driver } = await lockMatch(ctx, input.matchId);
    if (driver.personId !== ctx.actor.personId)
      throw new ForbiddenError("Only the driver can answer this");
    if (m.status !== "proposed") throw new ValidationError("This request was already answered");
    if (input.answer === "accepted") {
      const all = await ctx.tx.select().from(matches).where(eq(matches.driverPlanId, driver.id));
      if (seatsLeft(driver, all) < m.seats) throw new ValidationError("Your car is full");
    }
    await ctx.tx
      .update(matches)
      .set({ status: input.answer, decidedAt: ctx.now, updatedAt: ctx.now, version: m.version + 1 })
      .where(eq(matches.id, m.id));
    await ctx.audit.record({
      action: `logistics.ride.${input.answer}`,
      entity: { type: "logistics.ride_match", id: m.id },
      changes: { status: [m.status, input.answer] },
    });
    return { ok: true as const };
  },
);

/** Either side calls it off (an asked or agreed ride). */
export const cancelRide = moduleAction(
  "logistics",
  { input: z.object({ matchId: id }), capability: "logistics.travel.edit" },
  async (ctx, input) => {
    const { m, driver, passenger } = await lockMatch(ctx, input.matchId);
    const me = ctx.actor.personId;
    if (me !== driver.personId && me !== passenger.personId)
      throw new ForbiddenError("That's not your ride");
    if (m.status !== "proposed" && m.status !== "accepted")
      return { ok: true as const, changed: false };
    await ctx.tx
      .update(matches)
      .set({ status: "cancelled", decidedAt: ctx.now, updatedAt: ctx.now, version: m.version + 1 })
      .where(eq(matches.id, m.id));
    await ctx.audit.record({
      action: "logistics.ride.cancelled",
      entity: { type: "logistics.ride_match", id: m.id },
      changes: { status: [m.status, "cancelled"] },
    });
    return { ok: true as const, changed: true };
  },
);
