// A test camp filled by the real logistics seed (for the screen tests).
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
  await addTeam("logistics", "Logistics");
  const p = {
    admin: await createPerson({ email: "admin@example.test", name: "Ada", roles: ["admin"] }),
    lead: await createPerson({ email: "lead@example.test", name: "Remo" }),
    member: await createPerson({
      email: "member@example.test",
      name: "Sam",
      teams: [{ key: "kitchen", role: "member" }],
    }),
    camp: await createPerson({ email: "camp@example.test", name: "Cam", roles: ["camp_lead"] }),
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
  };
  const fake: string[] = [];
  for (let i = 0; i < 12; i++)
    fake.push(
      await createPerson({
        email: `fake.p${String(i).padStart(2, "0")}@example.test`,
        name: `Fake ${String(i).padStart(2, "0")}`,
      }),
    );
  await seed({
    db: getDb(),
    edition: { id: EDITION.id, year: EDITION.year },
    people: { admin: p.admin, lead: p.lead, member: p.member },
    tasks: await tasksApiFor(p.admin),
  });
  return { ...p, fake };
}
