import postgres from "postgres";
import { runAllMigrations } from "../../scripts/lib/migrate";
import { noop } from "../../src/lib/noop";
import { testDatabaseUrl } from "./test-env";

/** Once per `pnpm test:db`: wipe the test database and apply base + every module's migrations. */
export default async function setup() {
  const url = testDatabaseUrl();
  const sql = postgres(url, { max: 1, onnotice: noop });
  await sql.unsafe("drop schema if exists public cascade; create schema public;");
  await sql.end();
  await runAllMigrations(url, noop);
}
