// Family batches write past family years (stamped, once) and undo removes exactly those; tool
// batches set procurement_items.responsible_person_id when the name matches one person.
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
import { pastFamilyYearsFor } from "@/base/ingest/family-importer";
import { pastFamilyYears } from "@/base/schema";
import { procurementItems } from "@/modules/procurement/schema";
import { toolImporter } from "@/modules/procurement/server/import-batch";

let admin: string;
let ann: string;
const ctx = async () => ({ db: getDb(), actor: await actorFor(admin), edition: EDITION });

beforeEach(async () => {
  await truncateAll();
  await createCamp();
  admin = await createPerson({ email: "a@x.org", name: "Admin", roles: ["admin"] });
  ann = await createPerson({ email: "ann.demo@example.org", name: "Ann Demo" });
});

async function decideAll(id: string) {
  const c = await ctx();
  for (const r of (await getBatch(c, id)).rows)
    if (r.decision === "pending")
      await decideRow(c, {
        rowId: r.id,
        decision: "accept",
        setResponsible: Boolean((r.cleaned as { responsible?: string }).responsible),
      });
  return c;
}

describe("family batches", () => {
  it("writes each year once, links people by email, and undoes exactly the batch", async () => {
    const c = await ctx();
    await getDb().insert(pastFamilyYears).values({ email: "ann.demo@example.org", year: 2023 }); // typed by hand
    const csv =
      "Name,Email,Years\nAnn Demo,Ann.Demo@example.org,2023;2024\nBo Demo,bo.demo@example.org,'25";
    const id = await createBatch(c, { kind: "family", fileName: "f.csv", csv });
    await decideAll(id);
    expect(await approveBatch(c, id, {})).toEqual({ added: 2, alreadyThere: 1 });
    expect(await approveBatch(c, id, {})).toEqual({ added: 0, alreadyThere: 3 });
    expect(
      await pastFamilyYearsFor(getDb(), { personId: ann, email: "ann.demo@example.org" }),
    ).toEqual([2023, 2024]);
    const rows = await getDb().select().from(pastFamilyYears);
    expect(rows.find((r) => r.year === 2024)?.personId).toBe(ann);
    expect(await undoBatch(c, id, {})).toEqual({ removed: 2, keptInUse: 0 });
    expect((await getDb().select().from(pastFamilyYears)).map((r) => r.year)).toEqual([2023]);
  });
});

describe("responsible person on tool items", () => {
  it("sets the person when the name matches, else keeps a note", async () => {
    const c = await ctx();
    const csv = "name,situation,type\nPegs,Ann Demo,Tool\nRope,Zed Nobody,Item";
    const id = await createBatch(c, { kind: "tools", fileName: "t.csv", csv });
    await decideAll(id);
    await approveBatch(c, id, { tools: toolImporter });
    const items = await getDb().select().from(procurementItems).orderBy(procurementItems.name);
    expect(items.map((i) => [i.name, i.responsiblePersonId])).toEqual([
      ["Pegs", ann],
      ["Rope", null],
    ]);
    expect(items[0]?.notes ?? "").not.toContain("Responsible:");
    expect(items[1]?.notes).toContain("Responsible: Zed Nobody");
  });
});
