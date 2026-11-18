import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/logistics/schema.ts",
  out: "./src/modules/logistics/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_logistics", schema: "public" },
  tablesFilter: ["logistics_*"],
  strict: true,
});
