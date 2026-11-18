// A demo re-seed removes requests made while click-testing (past the seeded refs) and leaves the rest.
import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { EDITION, getDb, tasksApiFor } from "@/base/api/testing-db";
import { financeRequestSteps, financeSpendRequests as sr } from "../schema";
import { seed } from "../seed";
import { seededCamp } from "./seeded";

describe("finance demo tidy", () => {
  it("removes test requests on re-seed, keeps the seeded story", async () => {
    const p = await seededCamp();
    const rows = await getDb().select().from(sr).orderBy(asc(sr.refSeq));
    const last = rows.at(-1);
    if (!last) throw new Error("no seeded requests");
    const { id: _id, taskId: _t, createdAt: _c, updatedAt: _u, ...copy } = last;
    const [made] = await getDb()
      .insert(sr)
      .values({ ...copy, refSeq: 99, refCode: "TEST-999", status: "submitted" })
      .returning({ id: sr.id });
    const [step] = await getDb().select().from(financeRequestSteps).limit(1);
    if (step && made) {
      const { id: _s, ...st } = step;
      await getDb()
        .insert(financeRequestSteps)
        .values({ ...st, spendRequestId: made.id });
    }
    const before = rows.map((r) => r.status);
    await seed({
      db: getDb(),
      edition: EDITION,
      people: { admin: p.camp, lead: p.giftLead, member: p.member },
      tasks: await tasksApiFor(p.camp),
    });
    expect(await getDb().select().from(sr).where(eq(sr.refCode, "TEST-999"))).toEqual([]);
    const after = await getDb().select().from(sr).orderBy(asc(sr.refSeq));
    expect(after.slice(0, rows.length).map((r) => r.status)).toEqual(before);
  });
});
