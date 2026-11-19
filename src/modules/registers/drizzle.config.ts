import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/registers/schema.ts",
  out: "./src/modules/registers/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_registers", schema: "public" },
  tablesFilter: ["registers_*"],
  strict: true,
});
