// The rules ESLint can't see (MODULE_RULEBOOK.md §2, §5, §11). Used by `pnpm check:modules`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, isPgEnum, PgTable } from "drizzle-orm/pg-core";

export interface ManifestLike {
  id: string;
  route: string;
  tablePrefix: string;
}

/** Tables + enums a schema module exports. */
export function collectSchema(schemaExports: Record<string, unknown>) {
  const tables: { name: string; fks: string[] }[] = [];
  const enums: string[] = [];
  for (const value of Object.values(schemaExports)) {
    if (is(value, PgTable)) {
      const cfg = getTableConfig(value);
      tables.push({
        name: cfg.name,
        fks: cfg.foreignKeys.map((fk) => getTableName(fk.reference().foreignTable)),
      });
    } else if (isPgEnum(value)) {
      enums.push(value.enumName);
    }
  }
  return { tables, enums };
}

export function checkSchema(
  manifest: ManifestLike,
  schemaExports: Record<string, unknown>,
  baseTables: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const where = `module "${manifest.id}" schema`;
  const { tables, enums } = collectSchema(schemaExports);
  const own = new Set(tables.map((t) => t.name));
  for (const t of tables) {
    if (baseTables.has(t.name)) {
      problems.push(
        `${where}: re-exports base table "${t.name}" (import it from @/base/api/schema for FKs, don't export it)`,
      );
      continue;
    }
    if (!t.name.startsWith(manifest.tablePrefix))
      problems.push(`${where}: table "${t.name}" must start with "${manifest.tablePrefix}"`);
    for (const fk of t.fks) {
      if (!own.has(fk) && !baseTables.has(fk)) {
        problems.push(
          `${where}: "${t.name}" has a foreign key to "${fk}", which is neither its own nor a base table (use a soft reference)`,
        );
      }
    }
  }
  for (const e of enums) {
    if (!e.startsWith(manifest.tablePrefix))
      problems.push(`${where}: enum "${e}" must start with "${manifest.tablePrefix}"`);
  }
  return problems;
}

const SQL_OBJECT_RE =
  /\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|TYPE|VIEW|MATERIALIZED VIEW|INDEX|UNIQUE INDEX)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:"public"\.)?"([^"]+)"/gi;
const SQL_ON_RE = /\bON\s+(?:"public"\.)?"([^"]+)"/gi;

/** Fallback-style belt and braces: every object a module migration touches carries its prefix. */
export function checkMigrationSql(manifest: ManifestLike, file: string, sql: string): string[] {
  const problems: string[] = [];
  for (const re of [SQL_OBJECT_RE, SQL_ON_RE]) {
    for (const m of sql.matchAll(re)) {
      const name = m[1];
      if (!name) continue;
      if (!name.startsWith(manifest.tablePrefix)) {
        problems.push(
          `module "${manifest.id}" migration ${file}: touches "${name}" without the "${manifest.tablePrefix}" prefix`,
        );
      }
    }
  }
  return problems;
}

export function checkDrizzleConfig(
  manifest: ManifestLike,
  cfg: { schema?: unknown; out?: string; migrations?: { table?: string }; tablesFilter?: unknown },
): string[] {
  const where = `module "${manifest.id}" drizzle.config.ts`;
  const problems: string[] = [];
  const dir = `./src/modules/${manifest.id}`;
  if (cfg.schema !== `${dir}/schema.ts`)
    problems.push(`${where}: schema must be "${dir}/schema.ts"`);
  if (cfg.out !== `${dir}/migrations`) problems.push(`${where}: out must be "${dir}/migrations"`);
  if (cfg.migrations?.table !== `__drizzle_migrations_${manifest.id}`)
    problems.push(`${where}: migrations.table must be "__drizzle_migrations_${manifest.id}"`);
  const filter = Array.isArray(cfg.tablesFilter) ? cfg.tablesFilter : [cfg.tablesFilter];
  if (!filter.includes(`${manifest.tablePrefix}*`))
    problems.push(`${where}: tablesFilter must include "${manifest.tablePrefix}*"`);
  return problems;
}

/** src/app/(app)/<route>/ must hold exactly layout.tsx (guarded) and [[...slug]]/page.tsx (re-export). */
export function checkRouteFolder(
  root: string,
  manifest: ManifestLike,
  routerSource?: string,
): string[] {
  const where = `module "${manifest.id}" route ${manifest.route}`;
  const dir = path.join(root, "src/app/(app)", manifest.route.slice(1));
  if (!existsSync(dir)) return [`${where}: missing route folder src/app/(app)${manifest.route}/`];
  const problems: string[] = [];
  const files = listFiles(dir)
    .map((f) => path.relative(dir, f).split(path.sep).join("/"))
    .sort();
  const expected = ["[[...slug]]/page.tsx", "layout.tsx"];
  if (files.join("|") !== expected.join("|"))
    problems.push(
      `${where}: must contain exactly ${expected.join(" and ")} (found: ${files.join(", ")})`,
    );
  const layout = path.join(dir, "layout.tsx");
  if (
    existsSync(layout) &&
    !new RegExp(`export default guardModuleLayout\\("${manifest.id}"\\)`).test(
      readFileSync(layout, "utf8"),
    )
  ) {
    problems.push(
      `${where}: layout.tsx must be \`export default guardModuleLayout("${manifest.id}")\``,
    );
  }
  const page = path.join(dir, "[[...slug]]/page.tsx");
  if (
    existsSync(page) &&
    !readFileSync(page, "utf8").includes(
      `export { default } from "@/modules/${manifest.id}/ui/router"`,
    )
  ) {
    problems.push(
      `${where}: [[...slug]]/page.tsx must re-export "@/modules/${manifest.id}/ui/router"`,
    );
  }
  if (routerSource !== undefined && !routerSource.includes(`guardModulePage("${manifest.id}"`)) {
    problems.push(
      `module "${manifest.id}": ui/router.tsx must export guardModulePage("${manifest.id}", …)`,
    );
  }
  return problems;
}

const USE_SERVER_RE = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/;
const EXPORT_RE = /^export\s+(?!type\b|interface\b)(.*)$/gm;
const WRAPPED_RE =
  /^const\s+\w+\s*=\s*(moduleAction|sessionAction|publicAction)\(\s*(?:"([a-z0-9]+)")?/;

/** Every exported server action is wrapped in the base guard (rulebook rule 3). */
export function checkServerActionFile(relPath: string, source: string): string[] {
  if (!USE_SERVER_RE.test(source)) return [];
  const problems: string[] = [];
  const posix = relPath.split(path.sep).join("/");
  const moduleMatch = posix.match(/^src\/modules\/([^/]+)\/server\//);
  const inBase = /^src\/base\/(?:.+\/)?server\//.test(posix);
  if (!moduleMatch && !inBase) {
    problems.push(
      `${posix}: "use server" files belong in src/modules/<id>/server/ or src/base/**/server/`,
    );
  }
  for (const m of source.matchAll(EXPORT_RE)) {
    const rest = m[1];
    if (rest === undefined) continue;
    const start = (m.index ?? 0) + m[0].length - rest.length;
    const wrapped = source.slice(start, start + 300).match(WRAPPED_RE);
    if (!wrapped) {
      problems.push(
        `${posix}: export "${rest.slice(0, 50)}…" must be \`export const x = moduleAction(…)\` (or a base equivalent)`,
      );
      continue;
    }
    if (moduleMatch && (wrapped[1] !== "moduleAction" || wrapped[2] !== moduleMatch[1])) {
      problems.push(`${posix}: module actions must use moduleAction("${moduleMatch[1]}", …)`);
    }
  }
  return problems;
}

export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** The `{ ... }` block that starts at or after `from`, with nested braces balanced. */
function balancedBlock(source: string, from: number): string | null {
  const start = source.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

const NON_EMPTY_LIST = (key: "allow" | "deny") => new RegExp(`\\b${key}\\s*:\\s*\\[\\s*["'\`]`);

/**
 * Every declared capability must appear in the module's permissionMatrix(...) test with at
 * least one allow and one deny persona (MODULE_RULEBOOK.md §11). Static, so a module can't pass
 * by simply not having the test file.
 */
export function checkPermissionMatrix(
  manifest: ManifestLike & { permissions: readonly string[] },
  testFiles: readonly { path: string; source: string }[],
): string[] {
  if (manifest.permissions.length === 0) return [];
  const matrices = testFiles.filter((f) => /\bpermissionMatrix\s*\(/.test(f.source));
  if (matrices.length === 0) {
    return [
      `module "${manifest.id}": no permissionMatrix(...) test under src/modules/${manifest.id}/tests/`,
    ];
  }
  const problems: string[] = [];
  for (const cap of manifest.permissions) {
    const quoted = new RegExp(`["'\`]${cap.replaceAll(".", "\\.")}["'\`]\\s*:`);
    const hit = matrices
      .map((f) => {
        const m = quoted.exec(f.source);
        return m ? balancedBlock(f.source, m.index + m[0].length) : null;
      })
      .find((b): b is string => b !== null);
    if (!hit) {
      problems.push(`module "${manifest.id}": capability "${cap}" missing from permissionMatrix`);
      continue;
    }
    if (!NON_EMPTY_LIST("allow").test(hit))
      problems.push(
        `module "${manifest.id}": capability "${cap}" needs at least one allow persona`,
      );
    if (!NON_EMPTY_LIST("deny").test(hit))
      problems.push(`module "${manifest.id}": capability "${cap}" needs at least one deny persona`);
  }
  return problems;
}
