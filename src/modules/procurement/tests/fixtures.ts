// Shared setup for procurement DB tests: a camp with Kitchen + Gift projects, a few people,
// two places and the plan's staple-gun example (2 in Container A, 1 of them broken).
import { eq } from "drizzle-orm";
import { teams } from "@/base/api/schema";
import { createCamp, createPerson, getDb, truncateAll } from "@/base/api/testing-db";
import { procurementItems, procurementLocations, procurementStock } from "../schema";

export async function procurementCamp() {
  await truncateAll();
  await createCamp();
  const team = async (key: string) =>
    (await getDb().select().from(teams).where(eq(teams.key, key)))[0]?.id ?? "";
  const kitchen = await team("kitchen");
  const gifts = await team("gift_projects");
  const p = {
    camp: await createPerson({
      email: "camp@example.test",
      name: "Cam Lead",
      roles: ["camp_lead"],
    }),
    admin: await createPerson({ email: "admin@example.test", name: "Ada", roles: ["admin"] }),
    lead: await createPerson({
      email: "remo@example.test",
      name: "Remo",
      teams: [{ key: "gift_projects", role: "lead" }],
    }),
    kitchenLead: await createPerson({
      email: "alex@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    }),
    member: await createPerson({
      email: "sam@example.test",
      name: "Sam",
      teams: [{ key: "gift_projects", role: "member" }],
    }),
    waitlisted: await createPerson({ email: "w@example.test", name: "Wes", status: "waitlisted" }),
  };
  const db = getDb();
  const [containerA, storage] = await db
    .insert(procurementLocations)
    .values([
      { name: "Container A", kind: "container" },
      { name: "Cape Town storage", kind: "storage" },
    ])
    .returning();
  const [stapleGun, generator] = await db
    .insert(procurementItems)
    .values([
      { name: "Staple gun", category: "tool", isBottleneck: true },
      { name: "Generator 5 kVA", category: "electrical" },
    ])
    .returning();
  const loc = { containerA: containerA?.id ?? "", storage: storage?.id ?? "" };
  const item = { stapleGun: stapleGun?.id ?? "", generator: generator?.id ?? "" };
  await db.insert(procurementStock).values([
    { itemId: item.stapleGun, locationId: loc.containerA, condition: "good", quantity: 1 },
    { itemId: item.stapleGun, locationId: loc.containerA, condition: "broken", quantity: 1 },
  ]);
  return { ...p, kitchen, gifts, loc, item };
}
