import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/tickets/schema.ts",
  out: "./src/modules/tickets/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_tickets", schema: "public" },
  tablesFilter: ["tickets_*"],
  strict: true,
});
