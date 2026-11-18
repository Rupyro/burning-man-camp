// Shared setup for finance DB tests: a camp with Kitchen + Gift projects, placeholder policies,
// budgets and the Kitchen "Spending 2027" project.
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
import { financeBudgets } from "../schema";
import { insertPlaceholderPolicies } from "../server/policies";

export async function financeCamp() {
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
    camp2: await createPerson({
      email: "camp2@example.test",
      name: "Cam Two",
      roles: ["camp_lead"],
    }),
    finance: await createPerson({
      email: "jory@example.test",
      name: "Jory",
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
  await insertPlaceholderPolicies(getDb(), EDITION.id);
  await getDb()
    .insert(financeBudgets)
    .values([
      { editionId: EDITION.id, teamId: kitchen, name: "Kitchen", amountCents: 6_000_000 },
      { editionId: EDITION.id, teamId: gifts, name: "Gift projects", amountCents: 100_000 },
    ]);
  await (await tasksApiFor(p.camp)).ensureProject({ teamKey: "kitchen", name: "Spending 2027" });
  return { ...p, kitchen, gifts };
}
