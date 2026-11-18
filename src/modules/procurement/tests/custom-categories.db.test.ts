// Plan PR 11: procurement_items.category is text, checked by the app (rules/csv.ts isCampCategory).
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/base/api";
import { ok } from "@/base/api/testing";
import { actAs, getDb } from "@/base/api/testing-db";
import { categoryLabel } from "../rules/csv";
import { procurementItems } from "../schema";
import { createItem, updateItem } from "../server/stock";
import { procurementCamp } from "./fixtures";

let p: Awaited<ReturnType<typeof procurementCamp>>;

describe("custom material categories", () => {
  beforeEach(async () => {
    p = await procurementCamp();
  });

  it("the column is text with default 'other', and the old enum type is gone", async () => {
    const col = await getDb().execute(
      sql`select data_type, character_maximum_length as len, column_default as def
          from information_schema.columns
          where table_name = 'procurement_items' and column_name = 'category'`,
    );
    expect(col[0]).toMatchObject({ data_type: "character varying", len: 40 });
    expect(String(col[0]?.def)).toContain("'other'");
    const types = await getDb().execute(
      sql`select 1 from pg_type where typname = 'procurement_item_category'`,
    );
    expect(types).toHaveLength(0);
    const [row] = await getDb()
      .insert(procurementItems)
      .values({ name: "No category given" })
      .returning();
    expect(row?.category).toBe("other");
  });

  it("the app only accepts the camp's categories", async () => {
    await actAs(p.lead);
    const { id } = await ok(
      createItem({ name: "PA cable", category: "sound_lighting", unit: "pcs" }),
    );
    await expect(
      ok(createItem({ name: "Ice", category: "bar_supplies", unit: "bag" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      ok(updateItem({ id, name: "PA cable", category: "Not A Key", unit: "pcs" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("a stored category the camp doesn't use any more still reads, with its key in words", async () => {
    const [row] = await getDb()
      .insert(procurementItems)
      .values({ name: "Glow sticks", category: "glow_gear" })
      .returning();
    const [back] = await getDb()
      .select()
      .from(procurementItems)
      .where(eq(procurementItems.id, row?.id ?? ""));
    expect(back?.category).toBe("glow_gear");
    expect(categoryLabel(back?.category ?? "")).toBe("Glow gear");
  });
});
