// drizzle-kit check for the base config and every module config.
import { spawnSync } from "node:child_process";
import { loadEnv } from "./lib/load-env";
import { migrationConfigPaths } from "./lib/migrate";

loadEnv();
let failed = false;
for (const t of migrationConfigPaths()) {
  console.log(`▶ drizzle-kit check (${t.id})`);
  const r = spawnSync("pnpm", ["exec", "drizzle-kit", "check", "--config", t.configPath], {
    stdio: "inherit",
  });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
