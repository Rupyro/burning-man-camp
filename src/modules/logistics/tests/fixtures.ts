// Shared setup for logistics DB tests: a camp with Kitchen, Gift projects and Logistics, people in
// each role, and three places (storage, the site, a pickup).
import { addTeam, createCamp, createPerson, getDb, truncateAll } from "@/base/api/testing-db";
import { logisticsPlaces } from "../schema";

export async function logisticsCamp() {
  await truncateAll();
  await createCamp();
  await addTeam("logistics", "Logistics");
  const p = {
    camp: await createPerson({
      email: "camp@example.test",
      name: "Cam Lead",
      roles: ["camp_lead"],
    }),
    admin: await createPerson({ email: "admin@example.test", name: "Ada", roles: ["admin"] }),
    logiLead: await createPerson({
      email: "lex@example.test",
      name: "Lex",
      teams: [{ key: "logistics", role: "lead" }],
    }),
    logi: await createPerson({
      email: "lee@example.test",
      name: "Lee",
      teams: [{ key: "logistics", role: "member" }],
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
    other: await createPerson({
      email: "kim@example.test",
      name: "Kim",
      teams: [{ key: "kitchen", role: "member" }],
    }),
    waitlisted: await createPerson({ email: "w@example.test", name: "Wes", status: "waitlisted" }),
  };
  const [storage, site, pickup] = await getDb()
    .insert(logisticsPlaces)
    .values([
      { name: "Cape Town storage", kind: "storage" },
      { name: "Tankwa site", kind: "site" },
      { name: "Observatory", kind: "city_area" },
    ])
    .returning();
  const place = { storage: storage?.id ?? "", site: site?.id ?? "", obs: pickup?.id ?? "" };
  return { ...p, place };
}
