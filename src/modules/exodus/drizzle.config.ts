import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/exodus/schema.ts",
  out: "./src/modules/exodus/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_exodus", schema: "public" },
  tablesFilter: ["exodus_*"],
  strict: true,
});
