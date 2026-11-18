import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { noop } from "../../src/lib/noop";

export interface MigrationTarget {
  id: string;
  configPath: string;
  out: string;
  table: string;
  schema: string;
}

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Base first, then every module that has a drizzle.config.ts, alphabetically. */
export function migrationConfigPaths(): { id: string; configPath: string }[] {
  const modulesDir = path.join(ROOT, "src/modules");
  const modules = readdirSync(modulesDir, { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && existsSync(path.join(modulesDir, d.name, "drizzle.config.ts")),
    )
    .map((d) => d.name)
    .sort();
  return [
    { id: "base", configPath: path.join(ROOT, "drizzle.base.config.ts") },
    ...modules.map((id) => ({ id, configPath: path.join(modulesDir, id, "drizzle.config.ts") })),
  ];
}

export async function loadTargets(): Promise<MigrationTarget[]> {
  const targets: MigrationTarget[] = [];
  for (const { id, configPath } of migrationConfigPaths()) {
    const mod = await import(pathToFileURL(configPath).href);
    const cfg = (mod.default ?? mod) as {
      out: string;
      migrations?: { table?: string; schema?: string };
    };
    const table = cfg.migrations?.table;
    if (!table)
      throw new Error(`${configPath}: migrations.table is required (one table per module)`);
    targets.push({
      id,
      configPath,
      out: path.resolve(ROOT, cfg.out),
      table,
      schema: cfg.migrations?.schema ?? "public",
    });
  }
  return targets;
}

/** Apply base, then each module, each with its own migrations folder and table. */
export async function runAllMigrations(url: string, log: (msg: string) => void = console.log) {
  const client = postgres(url, { max: 1, onnotice: noop });
  try {
    const db = drizzle(client);
    for (const t of await loadTargets()) {
      await migrate(db, {
        migrationsFolder: t.out,
        migrationsTable: t.table,
        migrationsSchema: t.schema,
      });
      log(`  ✓ ${t.id.padEnd(12)} ${path.relative(ROOT, t.out)}  (${t.table})`);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}
