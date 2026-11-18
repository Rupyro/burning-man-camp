import { z } from "zod";

/**
 * Environment, validated with zod. Read lazily (getEnv) so `next build` and
 * pure unit tests don't need a database. Anything required throws on first use.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_ADAPTER: z.enum(["console", "memory"]).default("console"),
  EMAIL_FROM: z.string().optional(),
  EMAIL_DAILY_CAP: z.coerce.number().int().positive().default(95),
  CAMP_TIMEZONE: z.string().default("Africa/Johannesburg"),
  MODULES_DISABLED: z.string().optional(),
  /** Vercel Cron's bearer secret for /api/jobs/tick; unset = the route refuses every call. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Vercel AI Gateway key. Unset = "Ask the camp" uses the demo (keyword) router only. */
  AI_GATEWAY_API_KEY: z.string().min(8).optional(),
  /** Small model for "Ask the camp", as a gateway "provider/model" name. */
  ASK_AI_MODEL: z.string().default("openai/gpt-5-nano"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment (see .env.example):\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached env after changing process.env. */
export function resetEnvCache() {
  cached = undefined;
}

/** Module ids forced off by MODULES_DISABLED (comma-separated). Reads process.env directly. */
export function disabledModulesFromEnv(): Set<string> {
  return new Set(
    (process.env.MODULES_DISABLED ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}
