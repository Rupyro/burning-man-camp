import { loadEnv } from "../../scripts/lib/load-env";

/** The DB tests always run against a throwaway database, never DATABASE_URL. */
export function testDatabaseUrl(): string {
  loadEnv();
  const url =
    process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/camp_test";
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run DB tests against "${dbName}": TEST_DATABASE_URL must point at a *test* database`,
    );
  }
  return url;
}
