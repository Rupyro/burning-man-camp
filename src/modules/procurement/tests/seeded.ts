// A test camp filled by the real procurement seed (for the screen tests).
import { eq } from "drizzle-orm";
import { teams } from "@/base/api/schema";
import {
  addTeam,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import { seed } from "../seed";

export async function seededCamp() {
  await truncateAll();
  await createCamp();
  await addTeam("camp_infra", "Camp infrastructure");
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
      teams: [{ key: "kitchen", role: "member" }],
    }),
    outsider: await createPerson({ email: "o@example.test", name: "Olu" }),
  };
  await seed({
    db: getDb(),
    edition: EDITION,
    people: { admin: p.admin, lead: p.lead, member: p.member },
    tasks: await tasksApiFor(p.admin),
  });
  const id = async (key: string) =>
    (await getDb().select().from(teams).where(eq(teams.key, key)))[0]?.id ?? "";
  return {
    ...p,
    kitchen: await id("kitchen"),
    gifts: await id("gift_projects"),
    infra: await id("camp_infra"),
  };
}
