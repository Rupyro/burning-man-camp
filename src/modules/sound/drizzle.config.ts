import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/sound/schema.ts",
  out: "./src/modules/sound/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_sound", schema: "public" },
  tablesFilter: ["sound_*"],
  strict: true,
});
