import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/applicants/schema.ts",
  out: "./src/modules/applicants/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  migrations: { table: "__drizzle_migrations_applicants", schema: "public" },
  tablesFilter: ["applicant_*"],
  strict: true,
});
