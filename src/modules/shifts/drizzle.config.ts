import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/shifts/schema.ts",
  out: "./src/modules/shifts/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_shifts", schema: "public" },
  tablesFilter: ["shifts_*"],
  strict: true,
});
