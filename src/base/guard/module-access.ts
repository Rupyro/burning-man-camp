import { audienceAllows, evaluateAccess } from "../authz/access";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { getModuleFlags, type ModuleFlag } from "../flags/flags";
import type { Registry } from "../registry/runtime";
import type { ModuleManifest } from "../registry/types";

export type ModuleGate =
  | { open: true; manifest: ModuleManifest; flag: ModuleFlag }
  | { open: false; reason: "unknown" | "disabled" | "audience" | "access" };

/** Flag on + audience + manifest access, evaluated on the server. */
export function gateFromFlag(
  actor: Actor,
  manifest: ModuleManifest | undefined,
  flag: ModuleFlag | undefined,
): ModuleGate {
  if (!manifest || !flag) return { open: false, reason: "unknown" };
  if (!flag.enabled) return { open: false, reason: "disabled" };
  if (!audienceAllows(actor, flag.audience)) return { open: false, reason: "audience" };
  if (!evaluateAccess(actor, manifest.access)) return { open: false, reason: "access" };
  return { open: true, manifest, flag };
}

export async function gateModule(
  db: DbOrTx,
  registry: Registry,
  actor: Actor,
  moduleId: string,
): Promise<ModuleGate> {
  const flags = await getModuleFlags(db, registry);
  return gateFromFlag(actor, registry.get(moduleId), flags.get(moduleId));
}
