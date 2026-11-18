// Test command for Stryker's command runner (stryker.config.mjs). Stryker runs several of these
// at once, and the DB tests need a database to themselves, so each run claims a free slot with a
// Postgres advisory lock (held until the run ends) and uses camp_test_mut_<slot>.
// Exit code = test result, which is all Stryker needs.
import { spawn } from "node:child_process";
import postgres from "postgres";

const SLOTS = 16;
const LOCK_BASE = 727_000;
const base = new URL(
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/camp_test",
);
const admin = postgres(base.toString(), { max: 1, onnotice: () => undefined });

let slot = -1;
while (slot < 0) {
  for (let i = 0; i < SLOTS; i++) {
    const [row] = await admin`select pg_try_advisory_lock(${LOCK_BASE + i}) as ok`;
    if (row?.ok) {
      slot = i;
      break;
    }
  }
  if (slot < 0) await new Promise((r) => setTimeout(r, 200));
}
const name = `camp_test_mut_${slot}`;
const exists = await admin`select 1 from pg_database where datname = ${name}`;
if (exists.length === 0) await admin.unsafe(`create database "${name}"`);

const url = new URL(base);
url.pathname = `/${name}`;
const child = spawn(
  "pnpm",
  ["exec", "vitest", "run", "-c", "vitest.stryker.config.ts", "--bail", "1", "--silent"],
  { stdio: "inherit", env: { ...process.env, TEST_DATABASE_URL: url.toString() } },
);
const code = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 1)));
await admin.end(); // releases the advisory lock
process.exit(code);
