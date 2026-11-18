// Granularity (Nov 2 review): tool rows map to item-team links, per-year needs (with the new
// built / not_needed statuses) and stock at a place, all stamped and undone together; family
// years carry a role; accommodation options and build areas exist per year; officer and lead
// role assignments must name a year.
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  actorFor,
  addTeam,
  createCamp,
  createPerson,
  EDITION,
  getDb,
  truncateAll,
} from "@/base/api/testing-db";
import { approveBatch, createBatch, decideRow, getBatch, undoBatch } from "@/base/ingest/batches";
import {
  accommodationOptions,
  buildAreas,
  editionMembers,
  pastFamilyYears,
  roleAssignments,
  roles,
} from "@/base/schema";
import {
  procurementItems,
  procurementItemTeams,
  procurementLocations,
  procurementNeeds,
  procurementStock,
} from "@/modules/procurement/schema";
import { toolImporter } from "@/modules/procurement/server/import-batch";

let admin: string;
const ctx = async () => ({ db: getDb(), actor: await actorFor(admin), edition: EDITION });
const count = async (t: any) =>
  (await getDb().select({ n: sql<number>`count(*)::int` }).from(t))[0]?.n ?? 0;

beforeEach(async () => {
  await truncateAll();
  await createCamp();
  await addTeam("cloud", "Cloud");
  await addTeam("ossewas", "Ossewas");
  admin = await createPerson({ email: "a@x.org", name: "Admin", roles: ["admin"] });
});

async function decideAll(id: string) {
  const c = await ctx();
  for (const r of (await getBatch(c, id)).rows)
    if (r.decision === "pending") await decideRow(c, { rowId: r.id, decision: "accept" });
  return c;
}

describe("tool rows into needs, stock and teams", () => {
  it("maps departments, status, quantity and place, then undoes all of it", async () => {
    const csv = [
      "name,departments,situation,type,location",
      "Cloud feet x4,Cloud; Ossewas,Purchased,Tool,Main Stage",
      "Palm frame,Cloud,Built,Item,",
      "Old shelves,Various,Not necessary,Item,",
    ].join("\n");
    const c = await ctx();
    const id = await createBatch(c, { kind: "tools", fileName: "t.csv", csv });
    await decideAll(id);
    expect(await approveBatch(c, id, { tools: toolImporter })).toEqual({
      added: 3,
      alreadyThere: 0,
    });
    const needs = await getDb()
      .select({
        name: procurementItems.name,
        status: procurementNeeds.status,
        qty: procurementNeeds.quantityNeeded,
      })
      .from(procurementNeeds)
      .innerJoin(procurementItems, eq(procurementItems.id, procurementNeeds.itemId))
      .orderBy(procurementItems.name);
    expect(needs).toEqual([
      { name: "Cloud feet", status: "have_it", qty: 4 },
      { name: "Palm frame", status: "built", qty: 1 },
    ]);
    expect(await count(procurementItemTeams)).toBe(3);
    const stock = await getDb().select().from(procurementStock);
    expect(stock.map((s) => s.quantity)).toEqual([4]);
    expect((await getDb().select().from(procurementLocations)).map((l) => l.name)).toEqual([
      "Main Stage",
    ]);
    const shelves = (await getDb().select().from(procurementItems)).find(
      (i) => i.name === "Old shelves",
    );
    expect(shelves?.notes).toContain("Departments: Various");
    expect(shelves?.notes).toContain("Status: not needed");
    expect(await approveBatch(c, id, { tools: toolImporter })).toEqual({
      added: 0,
      alreadyThere: 3,
    });
    expect(await count(procurementNeeds)).toBe(2);
    expect(await undoBatch(c, id, { tools: toolImporter })).toEqual({ removed: 3, keptInUse: 0 });
    for (const t of [
      procurementItems,
      procurementNeeds,
      procurementStock,
      procurementItemTeams,
      procurementLocations,
    ])
      expect(await count(t)).toBe(0);
  });
});

describe("family roles", () => {
  it("keeps the role per year from a role column", async () => {
    const c = await ctx();
    const csv = "Name,Email,Years,Role\nAnn Demo,ann.demo@example.org,2024;2025,Kitchen lead";
    const id = await createBatch(c, { kind: "family", fileName: "f.csv", csv });
    await decideAll(id);
    await approveBatch(c, id, {});
    const rows = await getDb().select().from(pastFamilyYears).orderBy(pastFamilyYears.year);
    expect(rows.map((r) => [r.year, r.role])).toEqual([
      [2024, "Kitchen lead"],
      [2025, "Kitchen lead"],
    ]);
  });
});

describe("per-year tables", () => {
  it("stores accommodation options, the member's choice and tent mate, and build areas", async () => {
    const db = getDb();
    const mate = await createPerson({ email: "m@x.org", name: "Mate" });
    const [opt] = await db
      .insert(accommodationOptions)
      .values({
        editionId: EDITION.id,
        tentType: "Bell tent",
        size: "4m",
        sleeps: 2,
        priceCents: 350000,
      })
      .returning();
    await db
      .update(editionMembers)
      .set({ accommodationOptionId: opt?.id, tentMatePersonId: mate })
      .where(eq(editionMembers.personId, admin));
    const [m] = await db.select().from(editionMembers).where(eq(editionMembers.personId, admin));
    expect(m).toMatchObject({ accommodationOptionId: opt?.id, tentMatePersonId: mate });
    const [area] = await db
      .insert(buildAreas)
      .values({ editionId: EDITION.id, name: "Cloud" })
      .returning();
    const [item] = await db
      .insert(procurementItems)
      .values({ name: "Hammer", buildAreaId: area?.id })
      .returning();
    expect(item?.buildAreaId).toBe(area?.id);
    await expect(
      db.insert(buildAreas).values({ editionId: EDITION.id, name: "cloud" }),
    ).rejects.toThrow();
  });

  it("refuses an officer or lead role without a year", async () => {
    const db = getDb();
    const [lead] = await db.select().from(roles).where(eq(roles.key, "camp_lead"));
    const p = await createPerson({ email: "l@x.org", name: "Lead" });
    await expect(
      db.insert(roleAssignments).values({ personId: p, roleId: lead?.id ?? "" }),
    ).rejects.toThrow();
    await db
      .insert(roleAssignments)
      .values({ personId: p, roleId: lead?.id ?? "", editionId: EDITION.id });
    const [adminRole] = await db.select().from(roles).where(eq(roles.key, "admin"));
    await db.insert(roleAssignments).values({ personId: p, roleId: adminRole?.id ?? "" });
  });
});
