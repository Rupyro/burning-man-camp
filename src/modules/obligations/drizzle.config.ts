import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/obligations/schema.ts",
  out: "./src/modules/obligations/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_obligations", schema: "public" },
  tablesFilter: ["obligation_*"],
  strict: true,
});
