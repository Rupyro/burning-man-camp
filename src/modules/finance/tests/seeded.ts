// A test camp filled by the real finance seed (for the screen tests).
import { eq } from "drizzle-orm";
import { teams } from "@/base/api/schema";
import {
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
  const p = {
    camp: await createPerson({
      email: "camp@example.test",
      name: "Cam Lead",
      roles: ["camp_lead", "admin"],
    }),
    finance: await createPerson({
      email: "jules@example.test",
      name: "Jules",
      roles: ["finance_approver"],
    }),
    lead: await createPerson({
      email: "alex@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    }),
    giftLead: await createPerson({
      email: "remo@example.test",
      name: "Remo",
      teams: [{ key: "gift_projects", role: "lead" }],
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
    people: { admin: p.camp, lead: p.giftLead, member: p.member },
    tasks: await tasksApiFor(p.camp),
  });
  const [kitchen] = await getDb().select().from(teams).where(eq(teams.key, "kitchen"));
  return { ...p, kitchen: kitchen?.id ?? "" };
}
