import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/village/schema.ts",
  out: "./src/modules/village/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_village", schema: "public" },
  tablesFilter: ["village_*"],
  strict: true,
});
