// Travel plans and the ride board through the guard: own plans only, matching, asking, answering,
// seats, phone visibility (L3, L4) and "My stuff" entries (spec §6).
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { people } from "@/base/api/schema";
import { ok } from "@/base/api/testing";
import { actAs, EDITION, getDb, landingFor } from "@/base/api/testing-db";
import { logisticsLoadItems } from "../schema";
import { rideCounts, travelFor } from "../server/rides";
import { answerRide, askRide, cancelRide, saveTravel } from "../server/travel";
import { logisticsCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof logisticsCamp>>;
const travel = (who: string) => travelFor(getDb(), EDITION.id, who);

async function driverAndPassenger(seats = 2) {
  await actAs(p.logiLead);
  const d = await ok(
    saveTravel({
      direction: "to_burn",
      mode: "offering_ride",
      travelDate: "2027-04-21",
      areaPlaceId: p.place.obs,
      seats,
    }),
  );
  await actAs(p.member);
  const s = await ok(
    saveTravel({
      direction: "to_burn",
      mode: "need_ride",
      travelDate: "2027-04-22",
      areaPlaceId: p.place.obs,
    }),
  );
  return { driver: d.id, passenger: s.id };
}

describe("travel and rides", () => {
  beforeEach(async () => {
    p = await logisticsCamp();
    await getDb()
      .update(people)
      .set({ phoneE164: "+27555000101" })
      .where(eq(people.id, p.logiLead));
    await getDb().update(people).set({ phoneE164: "+27555000102" }).where(eq(people.id, p.member));
  });

  it("one plan per direction, edited in place; waitlisted people can't add one", async () => {
    await actAs(p.member);
    const a = await ok(
      saveTravel({
        direction: "to_burn",
        mode: "need_ride",
        travelDate: "2027-04-22",
      }),
    );
    const b = await ok(saveTravel({ direction: "to_burn", mode: "own_arrangement" }));
    expect(b.id).toBe(a.id);
    await ok(saveTravel({ direction: "from_burn", mode: "need_ride", travelDate: "2027-05-03" }));
    expect((await travel(p.member)).mine).toHaveLength(2);
    await expect(
      ok(saveTravel({ direction: "to_burn", mode: "need_ride", travelDate: "22/04/2027" })),
    ).rejects.toThrow();
    await actAs(p.waitlisted);
    await expect(ok(saveTravel({ direction: "to_burn", mode: "need_ride" }))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("shows matching offers (±1 day, same area), then ask → accept shows phones to the pair only", async () => {
    const { driver, passenger } = await driverAndPassenger();
    const view = await travel(p.member);
    expect(view.offers[0]?.offers.map((o) => o.plan.personName)).toEqual(["Lex"]);
    const ask = await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    expect((await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }))).already).toBe(
      true,
    );
    // Asked but not accepted: no phones either way.
    expect((await travel(p.member)).rides[0]).toMatchObject({
      status: "proposed",
      otherPhone: null,
    });
    const driverView = await travel(p.logiLead);
    expect(driverView.rides[0]).toMatchObject({
      driving: true,
      otherName: "Sam",
      otherPhone: null,
    });
    // Only the driver answers.
    await expect(ok(answerRide({ matchId: ask.id, answer: "accepted" }))).rejects.toThrow(
      ForbiddenError,
    );
    await actAs(p.logiLead);
    await ok(answerRide({ matchId: ask.id, answer: "accepted" }));
    await expect(ok(answerRide({ matchId: ask.id, answer: "declined" }))).rejects.toThrow(
      ValidationError,
    );
    expect((await travel(p.member)).rides[0]).toMatchObject({
      status: "accepted",
      otherName: "Lex",
      otherPhone: "+27555000101",
    });
    expect((await travel(p.logiLead)).rides[0]?.otherPhone).toBe("+27555000102");
    // A third person sees neither phone anywhere.
    expect((await travel(p.other)).rides).toEqual([]);
    expect((await travel(p.member)).offers[0]).toMatchObject({ hasRide: true, offers: [] });
    expect(await rideCounts(getDb(), EDITION.id)).toEqual({ needRide: 0, offering: 1, planned: 2 });
  });

  it("a full car can't take more; the driver can't cut seats below what they agreed", async () => {
    const { driver, passenger } = await driverAndPassenger(1);
    const ask = await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    await actAs(p.other);
    const kim = await ok(
      saveTravel({
        direction: "to_burn",
        mode: "need_ride",
        travelDate: "2027-04-21",
      }),
    );
    await actAs(p.logiLead);
    await ok(answerRide({ matchId: ask.id, answer: "accepted" }));
    await actAs(p.other);
    expect((await travel(p.other)).offers[0]?.offers).toEqual([]);
    await expect(ok(askRide({ passengerPlanId: kim.id, driverPlanId: driver }))).rejects.toThrow(
      /full/,
    );
    await actAs(p.logiLead);
    await expect(
      ok(
        saveTravel({
          direction: "to_burn",
          mode: "offering_ride",
          travelDate: "2027-04-21",
          seats: 1,
          areaPlaceId: p.place.obs,
        }),
      ),
    ).resolves.toBeTruthy();
  });

  it("can't ask from someone else's plan or for a ride going the other way", async () => {
    const { driver, passenger } = await driverAndPassenger();
    await actAs(p.other);
    await expect(ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }))).rejects.toThrow(
      ForbiddenError,
    );
    const home = await ok(
      saveTravel({
        direction: "from_burn",
        mode: "need_ride",
        travelDate: "2027-05-03",
      }),
    );
    await expect(ok(askRide({ passengerPlanId: home.id, driverPlanId: driver }))).rejects.toThrow(
      /your way/,
    );
  });

  it("switching to 'sorted myself' cancels your open asks; either side can cancel; declined can re-ask", async () => {
    const { driver, passenger } = await driverAndPassenger();
    const ask = await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    await actAs(p.logiLead);
    await ok(answerRide({ matchId: ask.id, answer: "declined" }));
    await actAs(p.member);
    const again = await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    expect(again.id).toBe(ask.id);
    await ok(saveTravel({ direction: "to_burn", mode: "own_arrangement" }));
    expect((await travel(p.member)).rides).toEqual([]);
    await ok(saveTravel({ direction: "to_burn", mode: "need_ride", travelDate: "2027-04-21" }));
    await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    await actAs(p.other);
    await expect(ok(cancelRide({ matchId: ask.id }))).rejects.toThrow(ForbiddenError);
    await actAs(p.logiLead);
    expect((await ok(cancelRide({ matchId: ask.id }))).changed).toBe(true);
    expect((await ok(cancelRide({ matchId: ask.id }))).changed).toBe(false);
  });

  it("My stuff: drivers see asks, both see agreed rides, Logistics sees critical gaps", async () => {
    const { driver, passenger } = await driverAndPassenger();
    const ask = await ok(askRide({ passengerPlanId: passenger, driverPlanId: driver }));
    await getDb().insert(logisticsLoadItems).values({
      editionId: EDITION.id,
      description: "Generator 5 kVA",
      quantity: 2,
      isCritical: true,
    });
    const titles = async (who: string) =>
      (await landingFor(who)).myItems.filter((i) => i.moduleId === "logistics").map((i) => i.title);
    expect(await titles(p.logiLead)).toEqual(
      expect.arrayContaining([
        "Critical, not on its way: Generator 5 kVA × 2",
        "Sam asked for a seat",
      ]),
    );
    expect(await titles(p.member)).toEqual([]);
    await actAs(p.logiLead);
    await ok(answerRide({ matchId: ask.id, answer: "accepted" }));
    expect(await titles(p.member)).toEqual(["Riding with Lex"]);
    expect(await titles(p.other)).toEqual([]);
  });
});
