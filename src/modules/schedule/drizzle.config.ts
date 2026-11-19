import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/schedule/schema.ts",
  out: "./src/modules/schedule/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_schedule", schema: "public" },
  tablesFilter: ["schedule_*"],
  strict: true,
});
