// `pnpm vercel-build` (Vercel runs this instead of `build`): migrate production, then next build.
// Migrations are idempotent (drizzle records applied files per module). Never seeds real data;
// the optional demo re-seed only runs with DEMO_MODE=true and DEMO_RESEED=1 and is fake-only.
import { execFileSync } from "node:child_process";
import { runAllMigrations } from "./lib/migrate";
import { planVercelBuild } from "./lib/vercel-build-plan";

const plan = planVercelBuild(process.env);
for (const r of plan.reasons) console.log(`[vercel-build] ${r}`);

if (plan.migrate && plan.migrateUrl) await runAllMigrations(plan.migrateUrl);
if (plan.reseedDemo) {
  execFileSync("pnpm", ["seed:demo"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: plan.migrateUrl, SEED_ALLOW_REMOTE: "1" },
  });
}
execFileSync("node", ["scripts/sync-camp-art.mjs"], { stdio: "inherit" });
execFileSync("pnpm", ["exec", "next", "build"], { stdio: "inherit" });
