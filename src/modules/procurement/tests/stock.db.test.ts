// Catalogue, places, suppliers and stock counts through the guard (spec §2, §4, P1-P3, P7).
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, baseTables, getDb } from "@/base/api/testing-db";
import {
  procurementItems,
  procurementStock,
  procurementStockMovements,
  procurementSuppliers,
} from "../schema";
import { getItem, listItems, listLocations, listSuppliers } from "../server/queries";
import {
  createItem,
  createLocation,
  createSupplier,
  importCsv,
  setCount,
  updateItem,
} from "../server/stock";
import { procurementCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof procurementCamp>>;

describe("stock and catalogue", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("the plan's example: 2 staple guns in Container A, 1 broken, so 1 usable", async () => {
    const got = await getItem(getDb(), p.item.stapleGun);
    expect(got?.lines).toHaveLength(2);
    const [row] = (await listItems(getDb(), "staple")).filter(
      (x) => x.item.id === p.item.stapleGun,
    );
    expect(row?.check).toMatchObject({ usable: 1, unusable: 1 });
    expect(await getItem(getDb(), "01900000-0000-7000-8000-00000000dead")).toBeNull();
  });

  it("any confirmed member updates a count; the change is logged with who (P2)", async () => {
    await actAs(p.member);
    const r = await ok(
      setCount({
        itemId: p.item.stapleGun,
        locationId: p.loc.containerA,
        condition: "good",
        quantity: "3",
      }),
    );
    expect(r).toEqual({ ok: true, before: 1, after: 3 });
    const moves = await getDb().select().from(procurementStockMovements);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ delta: 2, reason: "count", actorPersonId: p.member });
    const audit = (await getDb().select().from(baseTables.auditEvents)).filter(
      (a) => a.action === "procurement.stock.counted",
    );
    expect(audit).toHaveLength(1);
    // Same count again: no new movement.
    await ok(
      setCount({
        itemId: p.item.stapleGun,
        locationId: p.loc.containerA,
        condition: "good",
        quantity: "3",
      }),
    );
    expect(await getDb().select().from(procurementStockMovements)).toHaveLength(1);
    // A new place and condition creates a row.
    await ok(
      setCount({
        itemId: p.item.stapleGun,
        locationId: p.loc.storage,
        condition: "needs_repair",
        quantity: "1,5",
      }),
    );
    const rows = await getDb()
      .select()
      .from(procurementStock)
      .where(eq(procurementStock.locationId, p.loc.storage));
    expect(rows[0]).toMatchObject({ quantity: 1.5, countedByPersonId: p.member });
  });

  it("refuses bad counts, unknown items and people who aren't confirmed", async () => {
    await actAs(p.member);
    for (const quantity of ["-1", "abc", "", "100000000"]) {
      await expect(
        ok(
          setCount({
            itemId: p.item.stapleGun,
            locationId: p.loc.containerA,
            condition: "good",
            quantity,
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    await expect(
      ok(
        setCount({
          itemId: "01900000-0000-7000-8000-00000000dead",
          locationId: p.loc.containerA,
          condition: "good",
          quantity: "1",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await actAs(p.waitlisted);
    await expect(
      ok(
        setCount({
          itemId: p.item.stapleGun,
          locationId: p.loc.containerA,
          condition: "good",
          quantity: "1",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("team leads, camp leads and admins manage the catalogue; members can't (P1)", async () => {
    await actAs(p.member);
    await expect(
      ok(createItem({ name: "Drill", category: "tool", unit: "pcs" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await actAs(p.lead);
    const { id } = await ok(createItem({ name: "Drill", category: "tool", unit: "pcs" }));
    await expect(
      ok(createItem({ name: "drill", category: "tool", unit: "pcs" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await actAs(p.admin);
    await ok(
      updateItem({
        id,
        name: "Cordless drill",
        category: "tool",
        unit: "pcs",
        isBottleneck: true,
      }),
    );
    const [row] = await getDb().select().from(procurementItems).where(eq(procurementItems.id, id));
    expect(row).toMatchObject({ name: "Cordless drill", isBottleneck: true, version: 2 });
    await expect(
      ok(updateItem({ id, name: "Staple gun", category: "tool", unit: "pcs" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ok(
        updateItem({
          id: "01900000-0000-7000-8000-00000000dead",
          name: "X",
          category: "tool",
          unit: "pcs",
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await actAs(p.camp);
    await ok(createLocation({ name: "Site: kitchen area", kind: "site_area" }));
    await expect(
      ok(createLocation({ name: "container a", kind: "container" })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await listLocations(getDb())).map((l) => l.name)).toContain("Site: kitchen area");
  });

  it("supplier phone numbers only for leads (P3)", async () => {
    await actAs(p.lead);
    await ok(
      createSupplier({
        name: "Fake Hardware",
        contactPhone: "555 0100",
        email: "shop@example.test",
      }),
    );
    expect(await getDb().select().from(procurementSuppliers)).toHaveLength(1);
    expect((await listSuppliers(getDb(), true))[0]?.contactPhone).toBe("555 0100");
    expect((await listSuppliers(getDb(), false))[0]?.contactPhone).toBeNull();
  });

  it("CSV import creates items and places by name and logs each count (P7)", async () => {
    await actAs(p.lead);
    const csv = [
      "name,category,unit,quantity,location,condition",
      "Staple gun,tool,pcs,2,Container A,good",
      "Gazebo,camping,pcs,4,Container B,good",
      "Gazebo,camping,pcs,1,Container B,broken",
    ].join("\n");
    expect(await ok(importCsv({ text: csv }))).toEqual({ ok: true, imported: 3, errors: [] });
    const names = (
      await getDb().select().from(procurementItems).orderBy(asc(procurementItems.name))
    ).map((i) => i.name);
    expect(names).toEqual(["Gazebo", "Generator 5 kVA", "Staple gun"]);
    expect((await listLocations(getDb())).map((l) => l.name)).toContain("Container B");
    expect(await getDb().select().from(procurementStockMovements)).toHaveLength(3);
    const bad = await ok(
      importCsv({
        text: "name,category,unit,quantity,location,condition\n,tool,pcs,x,,good",
      }),
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
    await actAs(p.member);
    await expect(ok(importCsv({ text: csv }))).rejects.toBeInstanceOf(ForbiddenError);
  });
});
