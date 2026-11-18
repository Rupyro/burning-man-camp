import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import { auditEvents } from "../schema";

export interface AuditEntry {
  /** "<module>.<entity>.<verb>" or a base action such as "auth.login" */
  action: string;
  entity: { type: string; id: string };
  /** {field: [before, after]}; pass "[redacted]" for sensitive values */
  changes?: Record<string, [unknown, unknown]> | Record<string, unknown>;
  significance?: "activity" | "significant" | "security";
}

export interface AuditMeta {
  actor: Actor | null;
  /** Set when there's no Actor object yet (e.g. auth hooks). */
  actorPersonId?: string | null;
  actorKind?: "person" | "system" | "import";
  editionId?: string | null;
  requestId?: string | null;
}

/** Append one audit row. Call it with the transaction of the change so both commit together. */
export async function recordAudit(db: DbOrTx, meta: AuditMeta, entry: AuditEntry): Promise<void> {
  const actorKind = meta.actorKind ?? (meta.actor && !meta.actor.isSystem ? "person" : "system");
  await db.insert(auditEvents).values({
    actorPersonId: meta.actorPersonId ?? meta.actor?.personId ?? null,
    actorKind,
    action: entry.action,
    entityType: entry.entity.type,
    entityId: entry.entity.id,
    editionId: meta.editionId ?? meta.actor?.editionId ?? null,
    changes: entry.changes ?? null,
    significance: entry.significance ?? "activity",
    requestId: meta.requestId ?? null,
  });
}

export function createAuditApi(db: DbOrTx, meta: AuditMeta) {
  return { record: (entry: AuditEntry) => recordAudit(db, meta, entry) };
}
export type AuditApi = ReturnType<typeof createAuditApi>;
