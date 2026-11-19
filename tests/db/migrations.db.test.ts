// "A module migrates on its own": drop just its tables + migrations table,
// re-run only its migrator, and the base is untouched.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { noop } from "@/lib/noop";
import { loadTargets } from "../../scripts/lib/migrate";
import { testDatabaseUrl } from "../support/test-env";

describe("per-module migrations", () => {
  it("lists base first, then modules, each with its own folder and table", async () => {
    const targets = await loadTargets();
    expect(targets[0]!.id).toBe("base");
    expect(targets.map((t) => t.table)).toEqual([
      "__drizzle_migrations_base",
      "__drizzle_migrations_applicants",
      "__drizzle_migrations_finance",
      "__drizzle_migrations_logistics",
      "__drizzle_migrations_mv",
      "__drizzle_migrations_obligations",
      "__drizzle_migrations_procurement",
      "__drizzle_migrations_registers",
      "__drizzle_migrations_shifts",
      "__drizzle_migrations_sound",
      "__drizzle_migrations_tickets",
    ]);
  });

  it("re-applies one module alone without touching the base", async () => {
    const sql = postgres(testDatabaseUrl(), { max: 1, onnotice: noop });
    try {
      const baseBefore = await sql`select count(*)::int as n from __drizzle_migrations_base`;
      await sql.unsafe(
        `drop table applicant_family_years, applicant_family_answers, applicant_family_approvals, applicant_documents, applicant_applications, __drizzle_migrations_applicants; drop type applicant_status; drop type applicant_family_decision;`,
      );
      const mod = (await loadTargets()).find((t) => t.id === "applicants")!;
      await migrate(drizzle(sql), {
        migrationsFolder: mod.out,
        migrationsTable: mod.table,
        migrationsSchema: mod.schema,
      });
      await migrate(drizzle(sql), {
        migrationsFolder: mod.out,
        migrationsTable: mod.table,
        migrationsSchema: mod.schema,
      }); // idempotent
      const tables =
        await sql`select tablename from pg_tables where schemaname = 'public' and tablename like 'applicant_%' order by 1`;
      expect(tables.map((t) => t.tablename)).toEqual([
        "applicant_applications",
        "applicant_documents",
        "applicant_family_answers",
        "applicant_family_approvals",
        "applicant_family_years",
      ]);
      expect(
        (await sql`select count(*)::int as n from __drizzle_migrations_applicants`)[0]!.n,
      ).toBe(4); // 0000, 0001_welcome_guide, 0002_family_fast_track, 0003_import_batches
      expect((await sql`select count(*)::int as n from __drizzle_migrations_base`)[0]!.n).toBe(
        baseBefore[0]!.n,
      );
    } finally {
      await sql.end();
    }
  });
});
