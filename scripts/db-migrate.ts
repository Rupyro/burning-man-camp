import { loadEnv } from "./lib/load-env";
import { runAllMigrations } from "./lib/migrate";

loadEnv();
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (copy .env.example to .env.local)");
  process.exit(1);
}
console.log("Migrating (base first, then modules):");
await runAllMigrations(url);
