// Decides what a Vercel build does before `next build` (docs/runbook.md "Deploys").
// Pure so it can be unit tested; scripts/vercel-build.ts runs the plan.

export interface BuildEnv {
  [key: string]: string | undefined;
  VERCEL_ENV?: string;
  DATABASE_URL_UNPOOLED?: string;
  DATABASE_URL?: string;
  DEMO_MODE?: string;
  DEMO_RESEED?: string;
}

export interface BuildPlan {
  migrate: boolean;
  /** Re-run the idempotent fake demo seed. Only ever with DEMO_MODE=true and DEMO_RESEED=1. */
  reseedDemo: boolean;
  /** Direct (unpooled) URL used for migrations; never the pooled one. */
  migrateUrl?: string;
  reasons: string[];
}

/** Production migrates when it has a direct URL. Previews and local builds never touch a DB. */
export function planVercelBuild(env: BuildEnv): BuildPlan {
  const reasons: string[] = [];
  const isProduction = env.VERCEL_ENV === "production";
  const url = env.DATABASE_URL_UNPOOLED?.trim();
  const migrate = isProduction && Boolean(url);
  if (!isProduction) reasons.push(`VERCEL_ENV=${env.VERCEL_ENV ?? "(unset)"}: skipping migrations`);
  else if (!url) reasons.push("DATABASE_URL_UNPOOLED is not set: skipping migrations");
  else reasons.push("production: running migrations (base first, then modules)");

  const reseedDemo = migrate && env.DEMO_MODE === "true" && env.DEMO_RESEED === "1";
  if (migrate && env.DEMO_RESEED === "1" && env.DEMO_MODE !== "true") {
    reasons.push("DEMO_RESEED=1 ignored: DEMO_MODE is not true");
  } else if (reseedDemo) {
    reasons.push("DEMO_MODE=true and DEMO_RESEED=1: re-running the idempotent fake demo seed");
  }
  return { migrate, reseedDemo, ...(migrate && url ? { migrateUrl: url } : {}), reasons };
}
