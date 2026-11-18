// Read side for travel and rides. Phones come from the base profile and only inside an accepted
// match (L3); everything else shows names only.
import { and, eq, inArray, or } from "drizzle-orm";
import type { ReadOnlyDb } from "@/base/api";
import { people } from "@/base/api/schema";
import { canSeePhone, type Match, offersFor, type Plan } from "../rules/rides";
import {
  logisticsRideMatches as matches,
  logisticsPlaces as places,
  logisticsTravelPlans as plans,
} from "../schema";

export type PlanRow = Plan & {
  personName: string;
  areaName: string | null;
  areaDetail: string | null;
  timeOfDay: "morning" | "afternoon" | "evening" | "flexible";
  carriesCargo: boolean;
  notes: string | null;
};

export async function allPlans(db: ReadOnlyDb, editionId: string): Promise<PlanRow[]> {
  return db
    .select({
      id: plans.id,
      personId: plans.personId,
      personName: people.displayName,
      direction: plans.direction,
      mode: plans.mode,
      travelDate: plans.travelDate,
      timeOfDay: plans.timeOfDay,
      areaPlaceId: plans.areaPlaceId,
      areaName: places.name,
      areaDetail: plans.areaDetail,
      seatsOffered: plans.seatsOffered,
      seatsNeeded: plans.seatsNeeded,
      carriesCargo: plans.carriesCargo,
      notes: plans.notes,
    })
    .from(plans)
    .innerJoin(people, eq(people.id, plans.personId))
    .leftJoin(places, eq(places.id, plans.areaPlaceId))
    .where(eq(plans.editionId, editionId));
}

export async function allMatches(db: ReadOnlyDb, planIds: string[]) {
  if (!planIds.length) return [];
  return db
    .select()
    .from(matches)
    .where(or(inArray(matches.driverPlanId, planIds), inArray(matches.passengerPlanId, planIds)));
}

export interface RideRow {
  id: string;
  direction: Plan["direction"];
  status: Match["status"];
  seats: number;
  /** I'm the driver here. */
  driving: boolean;
  otherName: string;
  otherEmail: string;
  /** Only once accepted, and only between the two of you. */
  otherPhone: string | null;
  travelDate: string | null;
  areaName: string | null;
}

/** Everything the travel screen needs for one person. */
export async function travelFor(db: ReadOnlyDb, editionId: string, personId: string) {
  const everyone = await allPlans(db, editionId);
  const mine = everyone.filter((p) => p.personId === personId);
  const ms = await allMatches(
    db,
    everyone.map((p) => p.id),
  );
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const myIds = new Set(mine.map((p) => p.id));
  const mineMatches = ms.filter((m) => myIds.has(m.driverPlanId) || myIds.has(m.passengerPlanId));
  const others = [
    ...new Set(
      mineMatches.map((m) => {
        const driving = myIds.has(m.driverPlanId);
        return byId.get(driving ? m.passengerPlanId : m.driverPlanId)?.personId ?? "";
      }),
    ),
  ].filter(Boolean);
  const contact = others.length
    ? await db
        .select({ id: people.id, email: people.email, phone: people.phoneE164 })
        .from(people)
        .where(inArray(people.id, others))
    : [];
  const contactOf = new Map(contact.map((c) => [c.id, c]));
  const rides: RideRow[] = mineMatches
    .filter((m) => m.status === "proposed" || m.status === "accepted")
    .map((m) => {
      const driving = myIds.has(m.driverPlanId);
      const driver = byId.get(m.driverPlanId);
      const passenger = byId.get(m.passengerPlanId);
      const other = driving ? passenger : driver;
      const c = contactOf.get(other?.personId ?? "");
      const seePhone = canSeePhone(personId, other?.personId ?? "", {
        status: m.status,
        driverPersonId: driver?.personId ?? "",
        passengerPersonId: passenger?.personId ?? "",
      });
      return {
        id: m.id,
        direction: driver?.direction ?? "to_burn",
        status: m.status,
        seats: m.seats,
        driving,
        otherName: other?.personName ?? "Someone",
        otherEmail: c?.email ?? "",
        otherPhone: seePhone ? (c?.phone ?? null) : null,
        travelDate: driver?.travelDate ?? null,
        areaName: driver?.areaName ?? null,
      };
    })
    .sort((a, b) => a.direction.localeCompare(b.direction) || a.status.localeCompare(b.status));
  const offers = mine
    .filter((p) => p.mode === "need_ride")
    .map((need) => {
      const asked = new Set(
        ms
          .filter(
            (m) =>
              m.passengerPlanId === need.id && (m.status === "proposed" || m.status === "accepted"),
          )
          .map((m) => m.driverPlanId),
      );
      const hasRide = ms.some((m) => m.passengerPlanId === need.id && m.status === "accepted");
      return {
        need,
        hasRide,
        offers: hasRide
          ? []
          : offersFor(need, everyone, ms).map((o) => ({
              ...o,
              plan: byId.get(o.plan.id) as PlanRow,
              asked: asked.has(o.plan.id),
            })),
      };
    });
  return { mine, rides, offers };
}

/** Counts for leads: who still needs a ride, per direction. */
export async function rideCounts(db: ReadOnlyDb, editionId: string) {
  const everyone = await allPlans(db, editionId);
  const ms = await allMatches(
    db,
    everyone.map((p) => p.id),
  );
  const riding = new Set(ms.filter((m) => m.status === "accepted").map((m) => m.passengerPlanId));
  const stuck = everyone.filter((p) => p.mode === "need_ride" && !riding.has(p.id));
  return {
    needRide: stuck.length,
    offering: everyone.filter((p) => p.mode === "offering_ride").length,
    planned: new Set(everyone.map((p) => p.personId)).size,
  };
}

export const planOf = async (db: ReadOnlyDb, editionId: string, planId: string) =>
  (
    await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.editionId, editionId)))
  )[0] ?? null;
