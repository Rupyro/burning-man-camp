import { describe, expect, it } from "vitest";
import { planVercelBuild } from "./vercel-build-plan";

const url = "postgres://u:p@db.example/x";

describe("planVercelBuild", () => {
  it("migrates in production with a direct URL", () => {
    const plan = planVercelBuild({ VERCEL_ENV: "production", DATABASE_URL_UNPOOLED: url });
    expect(plan.migrate).toBe(true);
    expect(plan.migrateUrl).toBe(url);
    expect(plan.reseedDemo).toBe(false);
  });

  it("never migrates previews or local builds", () => {
    for (const VERCEL_ENV of ["preview", "development", undefined]) {
      const plan = planVercelBuild({ VERCEL_ENV, DATABASE_URL_UNPOOLED: url });
      expect(plan.migrate).toBe(false);
      expect(plan.migrateUrl).toBeUndefined();
    }
  });

  it("skips production without the unpooled URL, even if the pooled one is set", () => {
    const plan = planVercelBuild({
      VERCEL_ENV: "production",
      DATABASE_URL: url,
      DATABASE_URL_UNPOOLED: "  ",
    });
    expect(plan.migrate).toBe(false);
    expect(plan.reasons.join()).toMatch(/UNPOOLED/);
  });

  it("re-seeds demo data only with DEMO_MODE=true and DEMO_RESEED=1", () => {
    const base = { VERCEL_ENV: "production", DATABASE_URL_UNPOOLED: url };
    expect(planVercelBuild({ ...base, DEMO_MODE: "true", DEMO_RESEED: "1" }).reseedDemo).toBe(true);
    expect(planVercelBuild({ ...base, DEMO_MODE: "true" }).reseedDemo).toBe(false);
    expect(planVercelBuild({ ...base, DEMO_MODE: "false", DEMO_RESEED: "1" }).reseedDemo).toBe(
      false,
    );
    expect(
      planVercelBuild({
        VERCEL_ENV: "preview",
        DATABASE_URL_UNPOOLED: url,
        DEMO_MODE: "true",
        DEMO_RESEED: "1",
      }).reseedDemo,
    ).toBe(false);
  });
});
