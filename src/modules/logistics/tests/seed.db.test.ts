import { beforeEach, describe, expect, it } from "vitest";
import {
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { logisticsPlaces, logisticsTravelPlans } from "../schema";
import { seed } from "../seed";
import { criticalGaps, listLoads } from "../server/queries";
import { travelFor } from "../server/rides";

describe("logistics seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("places, loads in several states, critical gaps and a ride board, once", async () => {
    const admin = await createPerson({ email: "admin@example.test", name: "A", roles: ["admin"] });
    const lead = await createPerson({ email: "lead@example.test", name: "L" });
    const member = await createPerson({ email: "member@example.test", name: "Sam" });
    for (let i = 0; i < 12; i++)
      await createPerson({
        email: `fake.p${String(i).padStart(2, "0")}@example.test`,
        name: `Fake ${i}`,
      });
    const ctx = {
      db: getDb(),
      edition: { id: EDITION.id, year: EDITION.year },
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    expect(await getDb().select().from(logisticsPlaces)).toHaveLength(7);
    const loads = await listLoads(getDb(), EDITION.id);
    expect(loads).toHaveLength(5);
    expect(new Set(loads.map((l) => l.status))).toEqual(
      new Set(["packing", "planned", "delivered"]),
    );
    expect(loads.at(-1)?.status).toBe("delivered");
    const gaps = await criticalGaps(getDb(), EDITION.id);
    expect(gaps.map((g) => g.reason).sort()).toEqual(["no_destination", "no_load", "no_load"]);
    expect(gaps[0]?.description).toBe("Fire extinguisher 9 kg");
    const view = await travelFor(getDb(), EDITION.id, member);
    expect(view.mine).toHaveLength(2);
    expect(view.offers[0]?.offers.length).toBeGreaterThan(0);
    expect(view.rides).toMatchObject([{ driving: true, status: "proposed" }]);
    expect((await getDb().select().from(logisticsTravelPlans)).length).toBe(16);
  });
});
