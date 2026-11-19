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
import { obligationDetails } from "../schema";
import { seed } from "../seed";

describe("obligations seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
    await addTeam("camp_infra");
  });

  it("creates the plan's obligations once, tentative, through base tasks", async () => {
    const admin = await createPerson({ email: "a@example.test", name: "A", roles: ["admin"] });
    const lead = await createPerson({ email: "l@example.test", name: "L" });
    const member = await createPerson({ email: "m@example.test", name: "M" });
    const ctx = {
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    const rows = await getDb().select().from(obligationDetails);
    expect(rows).toHaveLength(6);
    const mv = rows.find((r) => r.key === "mv_registration");
    expect(mv?.dateConfirmed).toBe(false);
    expect(mv?.previousYearDate).toBe("2026-04-05");
    const kinds = await getDb()
      .select({ kind: tasks.kind })
      .from(tasks)
      .where(eq(tasks.kind, "obligations.obligation"));
    expect(kinds).toHaveLength(6);
  });
});
