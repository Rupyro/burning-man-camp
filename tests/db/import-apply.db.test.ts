// Stage (d)/(e): approving a tool-list batch writes procurement items stamped with the batch id;
// approving again adds nothing; undo removes exactly that batch's rows and nothing typed by hand.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { ValidationError } from "@/base/errors";
import { approveBatch, createBatch, decideRow, getBatch, undoBatch } from "@/base/ingest/batches";
import { auditEvents, people } from "@/base/schema";
import { procurementItems } from "@/modules/procurement/schema";
import { toolImporter } from "@/modules/procurement/server/import-batch";

const CSV = [
  "name,departments,situation,type,location",
  "Cloud feet x4,Cloud; Ossewas,Purchased,Tool,Stage",
  "Bolts,Various,Sam Demo,Item,",
  "Rope,Various,to be bought,Item,",
  "rope,Various,to be bought,Item,",
].join("\n");
const importers = { tools: toolImporter };
let admin: string;
const ctx = async () => ({ db: getDb(), actor: await actorFor(admin), edition: EDITION });
const items = () => getDb().select().from(procurementItems).orderBy(procurementItems.name);

beforeEach(async () => {
  await truncateAll();
  await createCamp();
  admin = await createPerson({ email: "a@x.org", name: "Admin", roles: ["admin"] });
});

async function reviewed() {
  const c = await ctx();
  const id = await createBatch(c, { kind: "tools", fileName: "t.csv", csv: CSV });
  const rows = (await getBatch(c, id)).rows;
  await decideRow(c, {
    rowId: rows[1]?.id ?? "",
    decision: "fix",
    fix: { name: "Bolts M8" },
    setResponsible: true,
  });
  await decideRow(c, { rowId: rows[2]?.id ?? "", decision: "accept" });
  await decideRow(c, { rowId: rows[3]?.id ?? "", decision: "skip" });
  return { c, id };
}

describe("tool-list import and undo", () => {
  it("writes accepted and fixed rows, stamped, once", async () => {
    await getDb().insert(procurementItems).values({ name: "Rope" }); // typed in by hand
    const { c, id } = await reviewed();
    const r1 = await approveBatch(c, id, importers);
    expect(r1).toEqual({ added: 2, alreadyThere: 1 });
    const after = await items();
    expect(after.map((i) => [i.name, i.importBatchId === id])).toEqual([
      ["Bolts M8", true],
      ["Cloud feet", true],
      ["Rope", false],
    ]);
    expect(after[0]?.notes).toContain("Responsible: Sam Demo");
    expect(after[1]).toMatchObject({ category: "tool", isAsset: true });
    expect(after[1]?.notes).toContain("Quantity: 4");
    expect((await getBatch(c, id)).batch.status).toBe("imported");
    expect(await approveBatch(c, id, importers)).toEqual({ added: 0, alreadyThere: 3 });
    expect(await items()).toHaveLength(3);
  });

  it("sets who is responsible when the name matches a person", async () => {
    await createPerson({ email: "s@x.org", name: "Sam Demo" });
    const { c, id } = await reviewed();
    await approveBatch(c, id, importers);
    const sam = (await getDb().select().from(people)).find((p) => p.displayName === "Sam Demo");
    const bolts = (await items()).find((i) => i.name === "Bolts M8");
    expect(bolts?.responsiblePersonId).toBe(sam?.id);
    expect(bolts?.notes).not.toContain("Responsible:");
  });

  it("undo removes only this batch's rows, keeps rows in use, and logs it", async () => {
    await getDb().insert(procurementItems).values({ name: "Hammer" });
    const { c, id } = await reviewed();
    await approveBatch(c, id, importers);
    expect(await undoBatch(c, id, importers)).toEqual({ removed: 3, keptInUse: 0 });
    expect((await items()).map((i) => i.name)).toEqual(["Hammer"]);
    expect((await getBatch(c, id)).batch.status).toBe("rolled_back");
    const log = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "ingest.batch.undo"));
    expect(log).toHaveLength(1);
    await expect(undoBatch(c, id, importers)).rejects.toBeInstanceOf(ValidationError);
    await expect(approveBatch(c, id, importers)).rejects.toBeInstanceOf(ValidationError);
  });

  it("member batches without an edition are approved but not written", async () => {
    const c = { db: getDb(), actor: await actorFor(admin) };
    const id = await createBatch(c, {
      kind: "members",
      fileName: "m.csv",
      csv: "Full name,Email\nAnn,ann@x.org",
    });
    expect(await approveBatch(c, id, importers)).toEqual({ added: 0, alreadyThere: 0 });
    expect((await getBatch(c, id)).batch.status).toBe("approved");
    await expect(undoBatch(c, id, importers)).rejects.toBeInstanceOf(ValidationError);
  });
});
