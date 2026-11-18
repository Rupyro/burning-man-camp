import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/finance/schema.ts",
  out: "./src/modules/finance/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_finance", schema: "public" },
  tablesFilter: ["finance_*"],
  strict: true,
});
