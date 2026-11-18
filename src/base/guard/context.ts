import { inArray } from "drizzle-orm";
import { type AuditApi, createAuditApi } from "../audit/audit";
import type { Actor } from "../authz/actor";
import type { Db, Tx } from "../db/client";
import { createModuleTasksApi } from "../engine/module-tasks";
import { createEventsApi, type EventsApi } from "../events/emit";
import { createMembershipApi, type MembershipApi } from "../people/membership";
import type { Registry } from "../registry/runtime";
import type { ModuleContext, ModuleId, ModuleTasksApi } from "../registry/types";
import { people } from "../schema";

/**
 * What a module action / event handler gets: the module context plus the base
 * APIs bound to the transaction. B0 ships audit, events and people; tasks,
 * notify, alerts, documents and anchors arrive in B1/B2.
 */
export interface ActionContext extends ModuleContext {
  moduleId: ModuleId;
  tx: Tx;
  audit: AuditApi;
  events: EventsApi;
  /** The task engine in this transaction, as the acting person (base permissions apply). */
  tasks: ModuleTasksApi;
  /** Edition membership changes a module may ask for (the applicant joining). */
  membership: MembershipApi;
  people: {
    /** Safe display names only. Contacts come later via people.contacts() + member.view_contacts. */
    displayNames(personIds: string[]): Promise<Map<string, string>>;
  };
}

export interface ContextInput {
  db: Db;
  registry: Registry;
  moduleId: string;
  actor: Actor;
  edition: { id: string; year: number };
  now: Date;
  emitted: string[];
  requestId?: string;
}

export function buildActionContext(tx: Tx, input: ContextInput): ActionContext {
  return {
    moduleId: input.moduleId as ModuleId,
    actor: input.actor,
    edition: input.edition,
    now: input.now,
    db: input.db,
    tx,
    audit: createAuditApi(tx, {
      actor: input.actor,
      editionId: input.edition.id || null,
      requestId: input.requestId,
    }),
    events: createEventsApi(tx, {
      moduleId: input.moduleId,
      actor: input.actor,
      editionId: input.edition.id || null,
      now: input.now,
      registry: input.registry,
      emitted: input.emitted,
    }),
    tasks: createModuleTasksApi({
      db: tx,
      actor: input.actor,
      edition: input.edition,
      now: input.now,
    }),
    membership: createMembershipApi(tx, {
      actor: input.actor,
      editionId: input.edition.id,
      now: input.now,
      requestId: input.requestId,
    }),
    people: {
      async displayNames(ids) {
        if (!ids.length) return new Map();
        const rows = await tx
          .select({ id: people.id, displayName: people.displayName })
          .from(people)
          .where(inArray(people.id, ids));
        return new Map(rows.map((r) => [r.id, r.displayName]));
      },
    },
  };
}
