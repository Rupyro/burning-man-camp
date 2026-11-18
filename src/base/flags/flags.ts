import { eq } from "drizzle-orm";
import { sectionSwitchedOffByPacks } from "@/lib/active-packs";
import { stableUuid } from "@/lib/crypto";
import { disabledModulesFromEnv } from "@/lib/env";
import { recordAudit } from "../audit/audit";
import type { ModuleAudience } from "../authz/access";
import type { Actor } from "../authz/actor";
import { can } from "../authz/permissions";
import type { DbOrTx } from "../db/client";
import { ForbiddenError } from "../errors";
import type { Registry } from "../registry/runtime";
import type { ModuleManifest } from "../registry/types";
import { moduleSettings } from "../schema";

export interface ModuleFlag {
  moduleId: string;
  enabled: boolean;
  audience: ModuleAudience;
  /** "pack": the camp picked no pack that brings this module (camp.config.ts camp.packs). */
  source: "db" | "default" | "env" | "pack";
}

function defaultFlag(m: ModuleManifest): ModuleFlag {
  return {
    moduleId: m.id,
    enabled: m.flag.defaultEnabled,
    audience: m.flag.pilotOnly ? "pilot" : "everyone",
    source: "default",
  };
}

/**
 * Flags for every registered module. Missing rows are created from manifest.flag;
 * MODULES_DISABLED (env) forces a module off without touching the row.
 */
export async function getModuleFlags(
  db: DbOrTx,
  registry: Registry,
): Promise<Map<string, ModuleFlag>> {
  const rows = await db.select().from(moduleSettings);
  const byId = new Map(rows.map((r) => [r.moduleId, r]));
  const missing = registry.modules.filter((m) => !byId.has(m.id));
  if (missing.length) {
    await db
      .insert(moduleSettings)
      .values(
        missing.map((m) => {
          const d = defaultFlag(m);
          return { moduleId: m.id, enabled: d.enabled, audience: d.audience };
        }),
      )
      .onConflictDoNothing();
  }
  const envOff = disabledModulesFromEnv();
  const flags = new Map<string, ModuleFlag>();
  for (const m of registry.modules) {
    const row = byId.get(m.id);
    let flag: ModuleFlag = row
      ? { moduleId: m.id, enabled: row.enabled, audience: row.audience, source: "db" }
      : defaultFlag(m);
    if (sectionSwitchedOffByPacks(m.id)) flag = { ...flag, enabled: false, source: "pack" };
    if (envOff.has(m.id)) flag = { ...flag, enabled: false, source: "env" };
    flags.set(m.id, flag);
  }
  return flags;
}

export async function getModuleFlag(
  db: DbOrTx,
  registry: Registry,
  moduleId: string,
): Promise<ModuleFlag | undefined> {
  return (await getModuleFlags(db, registry)).get(moduleId);
}

/** Admin-only (admin.settings). Never deletes data. Audited. */
export async function setModuleFlag(
  db: DbOrTx,
  registry: Registry,
  actor: Actor,
  moduleId: string,
  change: { enabled?: boolean; audience?: ModuleAudience },
): Promise<ModuleFlag> {
  if (!actor.isSystem && !can(actor, "admin.settings")) throw new ForbiddenError();
  const manifest = registry.get(moduleId);
  if (!manifest) throw new Error(`Unknown module "${moduleId}"`);
  const before = (await getModuleFlag(db, registry, moduleId)) ?? defaultFlag(manifest);
  const after = {
    enabled: change.enabled ?? before.enabled,
    audience: change.audience ?? before.audience,
  };
  await db
    .update(moduleSettings)
    .set({ ...after, updatedByPersonId: actor.personId, updatedAt: new Date() })
    .where(eq(moduleSettings.moduleId, moduleId));
  await recordAudit(
    db,
    { actor },
    {
      action: "module.flag_changed",
      entity: { type: "base.module", id: stableUuid(`module:${moduleId}`) },
      changes: {
        moduleId: [moduleId, moduleId],
        enabled: [before.enabled, after.enabled],
        audience: [before.audience, after.audience],
      },
      significance: "significant",
    },
  );
  return { moduleId, ...after, source: "db" };
}
