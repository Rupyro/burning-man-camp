// pnpm check:modules: manifests, table/enum prefixes, FKs, per-module drizzle configs,
// module migrations, guarded route folders and server-action wrapping.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { buildRegistry } from "../src/base/registry/runtime";
import * as baseSchema from "../src/base/schema";
import { modules } from "../src/modules";
import {
  checkDrizzleConfig,
  checkMigrationSql,
  checkPermissionMatrix,
  checkRouteFolder,
  checkSchema,
  checkServerActionFile,
  listFiles,
} from "./lib/checks";

const ROOT = path.resolve(import.meta.dirname, "..");
const problems: string[] = [];

try {
  buildRegistry(modules);
} catch (error) {
  problems.push(error instanceof Error ? error.message : String(error));
}

const baseTables = new Set(
  Object.values(baseSchema)
    .filter((v) => is(v, PgTable))
    .map((t) => getTableName(t as PgTable)),
);
const registered = new Set<string>(modules.map((m) => m.id));
const moduleDirs = readdirSync(path.join(ROOT, "src/modules"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
for (const dir of moduleDirs) {
  if (!registered.has(dir))
    problems.push(`src/modules/${dir}/ is not listed in src/modules/index.ts`);
}

for (const m of modules) {
  const dir = path.join(ROOT, "src/modules", m.id);
  for (const required of ["manifest.ts", "permissions.ts", "README.md", "ui/router.tsx"]) {
    if (!existsSync(path.join(dir, required)))
      problems.push(`module "${m.id}": missing ${required}`);
  }
  const schemaPath = path.join(dir, "schema.ts");
  if (existsSync(schemaPath)) {
    problems.push(...checkSchema(m, await import(pathToFileURL(schemaPath).href), baseTables));
    const cfgPath = path.join(dir, "drizzle.config.ts");
    if (!existsSync(cfgPath))
      problems.push(`module "${m.id}": has schema.ts but no drizzle.config.ts`);
    else
      problems.push(...checkDrizzleConfig(m, (await import(pathToFileURL(cfgPath).href)).default));
    const migDir = path.join(dir, "migrations");
    if (existsSync(migDir)) {
      for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql"))) {
        problems.push(...checkMigrationSql(m, f, readFileSync(path.join(migDir, f), "utf8")));
      }
    } else
      problems.push(`module "${m.id}": no migrations/ yet (run pnpm db:generate --module ${m.id})`);
  }
  const testsDir = path.join(dir, "tests");
  const testFiles = existsSync(testsDir)
    ? listFiles(testsDir)
        .filter((f) => /\.test\.tsx?$/.test(f))
        .map((f) => ({ path: f, source: readFileSync(f, "utf8") }))
    : [];
  problems.push(...checkPermissionMatrix(m, testFiles));
  const routerPath = path.join(dir, "ui/router.tsx");
  problems.push(
    ...checkRouteFolder(
      ROOT,
      m,
      existsSync(routerPath) ? readFileSync(routerPath, "utf8") : undefined,
    ),
  );
}

for (const file of listFiles(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
  problems.push(...checkServerActionFile(path.relative(ROOT, file), readFileSync(file, "utf8")));
}

if (problems.length) {
  console.error(
    `✗ check:modules found ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `✓ check:modules: ${modules.length} module(s) OK (${modules.map((m) => m.id).join(", ")})`,
);
