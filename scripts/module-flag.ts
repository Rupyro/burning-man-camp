// pnpm module:flag <moduleId> on|off|pilot|admins|everyone
// Admin switch until B1's Settings → Modules screen. Audited as a system action.
import { Actor } from "../src/base/authz/actor";
import { closeDb, getDb } from "../src/base/db/client";
import { setModuleFlag } from "../src/base/flags/flags";
import { registerModules } from "../src/base/registry/runtime";
import { modules } from "../src/modules";
import { loadEnv } from "./lib/load-env";

loadEnv();
const [id, value] = process.argv.slice(2);
const change: { enabled?: boolean; audience?: "everyone" | "pilot" | "admins" } | null =
  value === "on"
    ? { enabled: true }
    : value === "off"
      ? { enabled: false }
      : value === "pilot" || value === "admins" || value === "everyone"
        ? { audience: value }
        : null;
if (!id || !change) {
  console.error("Usage: pnpm module:flag <moduleId> on|off|pilot|admins|everyone");
  process.exit(1);
}
const registry = registerModules(modules);
const flag = await setModuleFlag(getDb(), registry, Actor.system(), id, change);
console.log(`${id}: enabled=${flag.enabled} audience=${flag.audience}`);
await closeDb();
