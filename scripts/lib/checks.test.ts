import { pgEnum, pgTable, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  checkDrizzleConfig,
  checkMigrationSql,
  checkPermissionMatrix,
  checkSchema,
  checkServerActionFile,
} from "./checks";

const m = { id: "finance", route: "/finance", tablePrefix: "finance_" };
const people = pgTable("people", { id: uuid("id").primaryKey() });
const otherModule = pgTable("procurement_needs", { id: uuid("id").primaryKey() });

describe("schema checks", () => {
  it("accepts prefixed tables with FKs to own/base tables", () => {
    const own = pgTable("finance_budgets", {
      id: uuid("id").primaryKey(),
      personId: uuid("person_id").references(() => people.id),
    });
    const child = pgTable("finance_lines", {
      id: uuid("id").primaryKey(),
      budgetId: uuid("budget_id").references(() => own.id),
    });
    expect(
      checkSchema(m, { own, child, e: pgEnum("finance_status", ["a"]) }, new Set(["people"])),
    ).toEqual([]);
  });
  it("rejects unprefixed tables/enums, cross-module FKs and re-exported base tables", () => {
    const bad = pgTable("budgets", { id: uuid("id").primaryKey() });
    const cross = pgTable("finance_x", {
      id: uuid("id").primaryKey(),
      needId: uuid("need_id").references(() => otherModule.id),
    });
    const problems = checkSchema(
      m,
      { bad, cross, people, e: pgEnum("status", ["a"]) },
      new Set(["people"]),
    ).join("\n");
    expect(problems).toMatch(/table "budgets" must start with "finance_"/);
    expect(problems).toMatch(/foreign key to "procurement_needs"/);
    expect(problems).toMatch(/re-exports base table "people"/);
    expect(problems).toMatch(/enum "status"/);
  });
});

describe("migration SQL check (prefix per module)", () => {
  it("flags objects outside the module prefix", () => {
    const sql =
      'CREATE TABLE "finance_budgets" (id uuid);\nALTER TABLE "people" ADD COLUMN x int;\nCREATE INDEX "finance_ix" ON "tasks" USING btree ("id");';
    const problems = checkMigrationSql(m, "0001.sql", sql).join("\n");
    expect(problems).toMatch(/"people"/);
    expect(problems).toMatch(/"tasks"/);
    expect(problems).not.toMatch(/"finance_budgets"/);
  });
});

describe("drizzle config check", () => {
  it("requires the module's own folder, migrations table and filter", () => {
    expect(
      checkDrizzleConfig(m, {
        schema: "./src/modules/finance/schema.ts",
        out: "./src/modules/finance/migrations",
        migrations: { table: "__drizzle_migrations_finance" },
        tablesFilter: ["finance_*"],
      }),
    ).toEqual([]);
    expect(
      checkDrizzleConfig(m, { schema: "./src/x.ts", out: "./drizzle", migrations: {} }),
    ).toHaveLength(4);
  });
});

describe("server action scan", () => {
  it("accepts wrapped module actions", () => {
    const src =
      '"use server";\nimport { moduleAction } from "@/base/api";\nexport const go = moduleAction(\n  "finance",\n  { input, capability: "finance.view" },\n  async () => {},\n);\nexport type X = 1;';
    expect(checkServerActionFile("src/modules/finance/server/actions.ts", src)).toEqual([]);
  });
  it("rejects bare server actions, another module's id, and stray locations", () => {
    expect(
      checkServerActionFile(
        "src/modules/finance/server/a.ts",
        '"use server";\nexport async function go() {}',
      )[0],
    ).toMatch(/must be/);
    expect(
      checkServerActionFile(
        "src/modules/finance/server/a.ts",
        '"use server";\nexport const go = moduleAction("hello", {})',
      )[0],
    ).toMatch(/moduleAction\("finance"/);
    expect(checkServerActionFile("src/modules/finance/ui/a.ts", '"use server";\n')[0]).toMatch(
      /belong in/,
    );
  });
  it("ignores files without the directive", () => {
    expect(checkServerActionFile("src/lib/x.ts", "export async function go() {}")).toEqual([]);
  });
});

describe("checkPermissionMatrix", () => {
  const fin = {
    id: "fin",
    route: "/fin",
    tablePrefix: "fin_",
    permissions: ["fin.request.create", "fin.request.approve"],
  };
  const file = (source: string) => [{ path: "src/modules/fin/tests/permissions.test.ts", source }];

  it("passes when every capability has allow and deny personas (resource functions allowed)", () => {
    const src = `permissionMatrix(manifest, {
      "fin.request.create": { allow: ["member"], deny: ["waitlisted"] },
      "fin.request.approve": { allow: ["finance_approver"], deny: ["member"], resource: (a) => ({ requesterId: a.personId }) },
    });`;
    expect(checkPermissionMatrix(fin, file(src))).toEqual([]);
  });

  it("flags a missing test file, a missing capability and empty allow/deny lists", () => {
    expect(checkPermissionMatrix(fin, [])).toEqual([
      'module "fin": no permissionMatrix(...) test under src/modules/fin/tests/',
    ]);
    const src = `permissionMatrix(manifest, { "fin.request.create": { allow: [], deny: [ ] } });`;
    expect(checkPermissionMatrix(fin, file(src))).toEqual([
      'module "fin": capability "fin.request.create" needs at least one allow persona',
      'module "fin": capability "fin.request.create" needs at least one deny persona',
      'module "fin": capability "fin.request.approve" missing from permissionMatrix',
    ]);
  });

  it("modules without capabilities need no matrix", () => {
    expect(checkPermissionMatrix({ ...fin, permissions: [] }, [])).toEqual([]);
  });
});
