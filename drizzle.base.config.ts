import { defineConfig } from "drizzle-kit";

// Base schema only. Each module has its own src/modules/<id>/drizzle.config.ts.
// Run through `pnpm db:generate` / `pnpm db:check` (they load .env.local first).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/base/schema/index.ts",
  out: "./src/base/schema/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_base", schema: "public" },
  strict: true,
  verbose: true,
});
