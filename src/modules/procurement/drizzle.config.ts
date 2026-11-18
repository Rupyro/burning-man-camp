import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/procurement/schema.ts",
  out: "./src/modules/procurement/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_procurement", schema: "public" },
  tablesFilter: ["procurement_*"],
  strict: true,
});
