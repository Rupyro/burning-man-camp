// Shared fixture for the people DB tests: a small camp written straight to the database.
import { eq } from "drizzle-orm";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { editionMembers, people, personSkills, roles, skills } from "@/base/schema";
import { firstRow } from "@/lib/rows";

export type PeopleIds = Record<
  "admin" | "camp" | "lead" | "gift" | "kitchen" | "cook" | "wait" | "hidden",
  string
>;

export const as = async (personId: string) => ({
  db: getDb(),
  actor: await actorFor(personId),
  edition: EDITION,
});

export async function peopleFixture(): Promise<PeopleIds> {
  await truncateAll();
  await createCamp();
  const db = getDb();
  await db
    .insert(roles)
    .values({ key: "kitchen_sensitive_viewer", label: "Diets", kind: "capability" });
  await db.insert(skills).values([
    { key: "carpentry", label: "Carpentry" },
    { key: "first_aid", label: "First aid" },
  ]);
  const ids: PeopleIds = {
    admin: await createPerson({ email: "admin@example.test", name: "Admin", roles: ["admin"] }),
    camp: await createPerson({
      email: "camp@example.test",
      name: "Camp Lead",
      roles: ["camp_lead"],
    }),
    lead: await createPerson({
      email: "lead@example.test",
      name: "Gift Lead",
      teams: [{ key: "gift_projects", role: "lead" }],
    }),
    gift: await createPerson({
      email: "gift@example.test",
      name: "Gift Member",
      teams: [{ key: "gift_projects", role: "member" }],
    }),
    kitchen: await createPerson({
      email: "kitchen@example.test",
      name: "Kitchen Member",
      teams: [{ key: "kitchen", role: "member" }],
    }),
    cook: await createPerson({
      email: "cook@example.test",
      name: "Cook",
      roles: ["kitchen_sensitive_viewer"],
      teams: [{ key: "kitchen", role: "lead" }],
    }),
    wait: await createPerson({ email: "wait@example.test", name: "Waiting", status: "waitlisted" }),
    hidden: await createPerson({ email: "hidden@example.test", name: "Hidden" }),
  };
  await db.update(people).set({ phoneE164: "+27820000001" }).where(eq(people.id, ids.gift));
  await db.update(people).set({ directoryVisibility: "hidden" }).where(eq(people.id, ids.hidden));
  await db
    .update(editionMembers)
    .set({ diet: "vegan", allergies: "peanuts" })
    .where(eq(editionMembers.personId, ids.gift));
  const carpentry = firstRow(await db.select().from(skills).where(eq(skills.key, "carpentry")));
  await db.insert(personSkills).values({ personId: ids.gift, skillId: carpentry.id });
  return ids;
}
