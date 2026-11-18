// Members batches: approving writes people through the existing member importer, stamped with the
// batch id; approving again adds nobody; undo removes only that batch's new people who have
// nothing else attached, and keeps (and counts) the rest.
import { eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { approveBatch, createBatch, decideRow, getBatch, undoBatch } from "@/base/ingest/batches";
import { editionMembers, memberAdminNotes, people } from "@/base/schema";

const CSV = [
  "Full name,Email,Phone",
  "demo river,River.Demo@example.org,082 000 0001",
  "Demo Sky,sky.demo@example.org,",
  "Demo Existing,existing@example.org,",
].join("\n");
let admin: string;
const ctx = async () => ({ db: getDb(), actor: await actorFor(admin), edition: EDITION });
const live = () =>
  getDb().select().from(people).where(isNull(people.deletedAt)).orderBy(people.email);

beforeEach(async () => {
  await truncateAll();
  await createCamp();
  admin = await createPerson({ email: "a@x.org", name: "Admin", roles: ["admin"] });
  await createPerson({ email: "existing@example.org", name: "Demo Existing", status: null });
});

async function approved() {
  const c = await ctx();
  const id = await createBatch(c, { kind: "members", fileName: "m.csv", csv: CSV });
  for (const r of (await getBatch(c, id)).rows)
    if (r.decision === "pending") await decideRow(c, { rowId: r.id, decision: "accept" });
  return { c, id, result: await approveBatch(c, id, {}) };
}

describe("members batches", () => {
  it("creates stamped people once and leaves existing people unstamped", async () => {
    const { c, id, result } = await approved();
    expect(result).toEqual({ added: 2, alreadyThere: 1 });
    const ps = await live();
    const byEmail = Object.fromEntries(ps.map((p) => [p.email, p]));
    expect(byEmail["river.demo@example.org"]?.importBatchId).toBe(id);
    expect(byEmail["river.demo@example.org"]?.displayName).toBe("demo river");
    expect(byEmail["existing@example.org"]?.importBatchId).toBeNull();
    expect((await getBatch(c, id)).batch.status).toBe("imported");
    expect(await approveBatch(c, id, {})).toEqual({ added: 0, alreadyThere: 3 });
    expect(await live()).toHaveLength(4);
  });

  it("undo removes only bare people from this batch and keeps the rest", async () => {
    const { c, id } = await approved();
    const sky = (await live()).find((p) => p.email === "sky.demo@example.org");
    const [m] = await getDb()
      .select()
      .from(editionMembers)
      .where(eq(editionMembers.personId, sky?.id ?? ""));
    await getDb()
      .insert(memberAdminNotes)
      .values({ editionMemberId: m?.id ?? "", authorPersonId: admin, body: "note" });
    expect(await undoBatch(c, id, {})).toEqual({ removed: 1, keptInUse: 1 });
    expect((await live()).map((p) => p.email)).toEqual([
      "a@x.org",
      "existing@example.org",
      "sky.demo@example.org",
    ]);
    const members = await getDb()
      .select()
      .from(editionMembers)
      .where(eq(editionMembers.editionId, EDITION.id));
    expect(members.some((m) => m.personId === sky?.id)).toBe(true);
    expect((await getBatch(c, id)).batch.status).toBe("rolled_back");
  });
});
