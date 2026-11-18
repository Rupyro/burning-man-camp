// Per test file (db project): point the app at the test DB, capture email, register modules.
import { afterAll } from "vitest";
import { testDatabaseUrl } from "./test-env";

const url = testDatabaseUrl();
process.env.DATABASE_URL = url;
process.env.DATABASE_URL_UNPOOLED = url;
process.env.EMAIL_ADAPTER = "memory";
process.env.BETTER_AUTH_SECRET ||= "test-secret-not-used-anywhere-else";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.MODULES_DISABLED = "";

const [{ resetEnvCache }, { registerModules }, { modules }, { closeDb }] = await Promise.all([
  import("@/lib/env"),
  import("@/base/registry/runtime"),
  import("@/modules"),
  import("@/base/db/client"),
]);
resetEnvCache();
registerModules(modules);

afterAll(async () => {
  await closeDb();
});
