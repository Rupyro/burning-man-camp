import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { tasks } from "@/base/api/schema";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  tasksApiFor,
  truncateAll,
} from "@/base/api/testing-db";
import {
  financeBudgets,
  financeReimbursements,
  financeRequestSteps,
  financeSpendRequests,
} from "../schema";
import { seed } from "../seed";
import { inboxFor, summaryFor } from "../server/queries";

describe("finance seed", () => {
  beforeEach(async () => {
    await truncateAll();
    await createCamp();
  });

  it("budgets, policies and requests in every state, once; nobody approved their own", async () => {
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
    await createPerson({
      email: "k@example.test",
      name: "Alex",
      teams: [{ key: "kitchen", role: "lead" }],
    });
    const fin = await createPerson({
      email: "f@example.test",
      name: "Jules",
      roles: ["finance_approver"],
    });
    const ctx = {
      db: getDb(),
      edition: EDITION,
      people: { admin, lead, member },
      tasks: await tasksApiFor(admin),
    };
    await seed(ctx);
    await seed(ctx);
    expect(await getDb().select().from(financeBudgets)).toHaveLength(2); // only kitchen + gifts exist here
    const reqs = await getDb().select().from(financeSpendRequests);
    expect(reqs.map((r) => r.refCode)).toEqual([
      "TST-SR-001",
      "TST-SR-002",
      "TST-SR-003",
      "TST-SR-004",
      "TST-SR-005",
      "TST-SR-006",
      "TST-SR-007",
      "TST-SR-008",
    ]);
    expect(new Set(reqs.map((r) => r.status))).toEqual(
      new Set(["submitted", "approved", "purchased", "closed", "draft", "needs_info", "rejected"]),
    );
    const steps = await getDb().select().from(financeRequestSteps);
    for (const a of steps) expect(a.decidedByPersonId).not.toBe(a.requesterPersonId);
    const pendingOn = new Set(
      steps.filter((x) => x.status === "pending").map((x) => x.spendRequestId),
    );
    for (const r of reqs) expect(pendingOn.has(r.id)).toBe(r.status === "submitted");
    expect(await getDb().select().from(financeReimbursements)).toHaveLength(1);
    const gas = reqs.find((r) => r.estimatedCents === 450_000);
    expect((await inboxFor(getDb(), EDITION.id, await actorFor(fin))).map((r) => r.id)).toContain(
      gas?.id,
    );
    const [t] = await getDb()
      .select()
      .from(tasks)
      .where(eq(tasks.id, gas?.taskId ?? ""));
    expect(t?.kind).toBe("finance.purchase");
    const s = await summaryFor(getDb(), EDITION.id);
    expect(s.rows.find((r) => r.teamName === "Kitchen")).toMatchObject({
      actualCents: 115_050 + 64_000,
      committedCents: 90_000,
    });
  });
});
