import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { tasks } from "@/base/api/schema";
import {
  addTeam,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import {
  procurementItems,
  procurementLocations,
  procurementNeeds,
  procurementStock,
  procurementSuppliers,
} from "../schema";
import { seed } from "../seed";
import { listItems, listNeeds } from "../server/queries";

describe("procurement seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    await addTeam("camp_infra", "Camp infrastructure");
  });

  it("~30 items, 6 places, 4 suppliers and needs in every status, once", async () => {
    const admin = await createPerson({ email: "a@example.test", name: "A", roles: ["admin"] });
    const lead = await createPerson({
      email: "l@example.test",
      name: "L",
      teams: [{ key: "gift_projects", role: "lead" }],
    });
    const member = await createPerson({
      email: "m@example.test",
      name: "Sam",
      teams: [{ key: "kitchen", role: "member" }],
    });
    const ctx = {
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    expect(await getDb().select().from(procurementItems)).toHaveLength(30);
    expect(await getDb().select().from(procurementLocations)).toHaveLength(6);
    expect(await getDb().select().from(procurementSuppliers)).toHaveLength(4);
    expect((await getDb().select().from(procurementStock)).length).toBeGreaterThan(30);
    const needs = await listNeeds(getDb(), EDITION.id);
    expect(new Set(needs.map((n) => n.status))).toEqual(
      new Set([
        "needed",
        "have_it",
        "to_buy",
        "to_borrow",
        "purchase_requested",
        "ordered",
        "received",
        "cancelled",
      ]),
    );
    const staple = needs.find((n) => n.itemName === "Staple gun");
    expect(staple?.check.text).toBe("We own 2 (1 broken or missing) in Container A. Buy 3.");
    expect(needs.find((n) => n.isCritical)?.itemName).toBe("Generator 5 kVA");
    const asked = needs.find((n) => n.status === "purchase_requested");
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, asked?.taskId ?? ""));
    expect(t).toMatchObject({
      kind: "procurement.buy",
      title: "Buy 2 pcs Cordless drill",
      sourceRefId: asked?.id,
    });
    expect(await getDb().select().from(procurementNeeds)).toHaveLength(10);
    const bottlenecks = (await listItems(getDb())).filter((x) => x.item.isBottleneck);
    expect(bottlenecks.length).toBeGreaterThanOrEqual(5);
  });
});
