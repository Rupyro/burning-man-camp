// The database refuses duplicate travel plans, self-matches, bad seats and repeat event items (spec §2).
import { beforeEach, describe, expect, it } from "vitest";
import { createCamp, createPerson, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import { logisticsLoadItems, logisticsRideMatches, logisticsTravelPlans } from "../schema";

let a: string;

describe("logistics tables", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    a = await createPerson({ email: "a@example.test", name: "A" });
  });

  it("one travel plan per person, direction and edition; seats in range", async () => {
    const plan = {
      editionId: EDITION.id,
      personId: a,
      direction: "to_burn" as const,
      mode: "need_ride" as const,
    };
    const [p] = await getDb().insert(logisticsTravelPlans).values(plan).returning();
    await expect(getDb().insert(logisticsTravelPlans).values(plan)).rejects.toThrow();
    await expect(
      getDb()
        .insert(logisticsTravelPlans)
        .values({ ...plan, direction: "from_burn", seatsNeeded: 0 }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(logisticsRideMatches)
        .values({ driverPlanId: p?.id ?? "", passengerPlanId: p?.id ?? "" }),
    ).rejects.toThrow();
  });

  it("load items: positive quantities, one row per source event", async () => {
    const item = {
      editionId: EDITION.id,
      description: "2 pcs Generator 5 kVA",
      sourceEventId: "01900000-0000-7000-8000-0000000000e1",
    };
    await getDb().insert(logisticsLoadItems).values(item);
    await expect(getDb().insert(logisticsLoadItems).values(item)).rejects.toThrow();
    await expect(
      getDb()
        .insert(logisticsLoadItems)
        .values({ editionId: EDITION.id, description: "x", quantity: 0 }),
    ).rejects.toThrow();
  });
});
