import "server-only";
import { registerModules } from "@/base/api";
import { modules } from "@/modules";

/** Wire the composition root into the base registry (idempotent). */
export function ensureRegistry() {
  return registerModules(modules);
}
