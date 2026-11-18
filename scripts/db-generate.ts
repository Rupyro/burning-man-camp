// pnpm db:generate                 → base schema
// pnpm db:generate --module shifts  → one module only
// pnpm db:generate --all           → base + every module
// Extra args after "--" go to drizzle-kit (e.g. -- --name add_notes).
import { spawnSync } from "node:child_process";
import { loadEnv } from "./lib/load-env";
import { migrationConfigPaths } from "./lib/migrate";

loadEnv();
const args = process.argv.slice(2);
const sep = args.indexOf("--");
const own = sep === -1 ? args : args.slice(0, sep);
const passthrough = sep === -1 ? [] : args.slice(sep + 1);
const moduleIdx = own.indexOf("--module");
const all = own.includes("--all");
const wanted = moduleIdx !== -1 ? own[moduleIdx + 1] : all ? null : "base";

const targets = migrationConfigPaths().filter((t) => wanted === null || t.id === wanted);
if (!targets.length) {
  console.error(`No drizzle config for "${wanted}"`);
  process.exit(1);
}
for (const t of targets) {
  console.log(`\n▶ drizzle-kit generate (${t.id})`);
  const r = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "generate", "--config", t.configPath, ...passthrough],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
