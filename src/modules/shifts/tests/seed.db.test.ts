import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import {
  shiftsChecklistItems,
  shiftsDutyTypes,
  shiftsSettings,
  shiftsSignups,
  shiftsSlots,
} from "../schema";
import { seed } from "../seed";

describe("shifts seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("Sage's duties, checklists and Burn-week slots, once", async () => {
    const admin = await createPerson({ email: "admin@example.test", name: "A", roles: ["admin"] });
    const lead = await createPerson({ email: "lead@example.test", name: "L" });
    const member = await createPerson({ email: "member@example.test", name: "M" });
    for (let i = 0; i < 16; i++)
      await createPerson({
        email: `fake.p${String(i).padStart(2, "0")}@example.test`,
        name: `F${i}`,
      });
    const ctx = {
      db: getDb(),
      edition: { id: EDITION.id, year: EDITION.year },
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    const [settings] = await getDb().select().from(shiftsSettings);
    expect(settings?.freezeAt.toISOString()).toBe("2027-04-18T22:00:00.000Z");
    const duties = await getDb().select().from(shiftsDutyTypes);
    expect(duties.map((d) => d.key).sort()).toEqual([
      "art_car_crew",
      "art_car_driver",
      "art_car_sound",
      "build_crew",
      "kitchen_breakfast",
      "kitchen_dinner",
      "moop_afternoon",
      "moop_early",
      "strike_crew",
    ]);
    expect(
      duties
        .filter((d) => d.isSpecialist)
        .map((d) => d.key)
        .sort(),
    ).toEqual(["art_car_driver", "art_car_sound"]);
    const breakfast = duties.find((d) => d.key === "kitchen_breakfast");
    const slots = await getDb()
      .select()
      .from(shiftsSlots)
      .where(eq(shiftsSlots.dutyTypeId, breakfast?.id ?? ""));
    expect(slots).toHaveLength(6); // Mon–Sat
    expect(slots[0]?.startsAt.toISOString()).toBe("2027-04-26T07:00:00.000Z"); // 09:00 SAST
    expect((await getDb().select().from(shiftsChecklistItems)).length).toBeGreaterThan(30);
    expect((await getDb().select().from(shiftsSlots)).length).toBe(6 * 5 + 7 * 2 + 3 + 1);
    expect((await getDb().select().from(shiftsSignups)).length).toBe(17);
  });

  it("a re-seed releases the member's test claims and keeps their seeded ones", async () => {
    const admin = await createPerson({ email: "admin@example.test", name: "A", roles: ["admin"] });
    const lead = await createPerson({ email: "lead@example.test", name: "L" });
    const member = await createPerson({ email: "member@example.test", name: "M" });
    for (let i = 0; i < 16; i++)
      await createPerson({
        email: `fake.p${String(i).padStart(2, "0")}@example.test`,
        name: `F${i}`,
      });
    const ctx = {
      db: getDb(),
      edition: { id: EDITION.id, year: EDITION.year },
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    const [dinner] = await getDb()
      .select({ id: shiftsSlots.id })
      .from(shiftsSlots)
      .innerJoin(shiftsDutyTypes, eq(shiftsDutyTypes.id, shiftsSlots.dutyTypeId))
      .where(eq(shiftsDutyTypes.key, "kitchen_dinner"))
      .orderBy(shiftsSlots.startsAt)
      .offset(2)
      .limit(1);
    await getDb()
      .insert(shiftsSignups)
      .values({ slotId: dinner?.id ?? "", personId: member });
    await seed(ctx);
    const mine = await getDb()
      .select({ slotId: shiftsSignups.slotId, status: shiftsSignups.status })
      .from(shiftsSignups)
      .where(eq(shiftsSignups.personId, member));
    expect(mine.filter((s) => s.status !== "released")).toHaveLength(2);
    expect(mine.find((s) => s.slotId === dinner?.id)?.status).toBe("released");
  });
});
