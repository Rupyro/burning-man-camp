// The database refuses negative stock, non-positive needs and duplicate stock rows (spec §2).
import { beforeEach, describe, expect, it } from "vitest";
import { teams } from "@/base/api/schema";
import { createCamp, EDITION, getDb, truncateAll } from "@/base/api/testing-db";
import {
  procurementItems,
  procurementLocations,
  procurementNeeds,
  procurementStock,
} from "../schema";

let itemId: string;
let locationId: string;
let teamId: string;

describe("procurement tables", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    const [team] = await getDb().select().from(teams);
    teamId = team?.id ?? "";
    const [item] = await getDb()
      .insert(procurementItems)
      .values({ name: "Staple gun", category: "tool" })
      .returning();
    const [loc] = await getDb()
      .insert(procurementLocations)
      .values({ name: "Container A" })
      .returning();
    itemId = item?.id ?? "";
    locationId = loc?.id ?? "";
  });

  it("one stock row per item, place and condition; never negative", async () => {
    await getDb()
      .insert(procurementStock)
      .values({ itemId, locationId, condition: "good", quantity: 1.5 });
    await expect(
      getDb()
        .insert(procurementStock)
        .values({ itemId, locationId, condition: "good", quantity: 1 }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(procurementStock)
        .values({ itemId, locationId, condition: "broken", quantity: -1 }),
    ).rejects.toThrow();
    const [row] = await getDb().select().from(procurementStock);
    expect(row?.quantity).toBe(1.5);
  });

  it("item names are unique ignoring case", async () => {
    await expect(getDb().insert(procurementItems).values({ name: "STAPLE GUN" })).rejects.toThrow();
  });

  it("a need must ask for more than zero, and any estimate must be positive", async () => {
    const need = { editionId: EDITION.id, teamId, itemId };
    await expect(
      getDb()
        .insert(procurementNeeds)
        .values({ ...need, quantityNeeded: 0 }),
    ).rejects.toThrow();
    await expect(
      getDb()
        .insert(procurementNeeds)
        .values({ ...need, quantityNeeded: 1, estimateCents: 0 }),
    ).rejects.toThrow();
    await getDb()
      .insert(procurementNeeds)
      .values({ ...need, quantityNeeded: 4 });
    expect(await getDb().select().from(procurementNeeds)).toHaveLength(1);
  });
});
