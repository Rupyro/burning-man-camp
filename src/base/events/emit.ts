import { eventContracts } from "@/contracts/events";
import type { Actor } from "../authz/actor";
import type { DbOrTx } from "../db/client";
import type { Registry } from "../registry/runtime";
import { domainEventDeliveries, domainEvents } from "../schema";

export interface EmitScope {
  moduleId: string;
  actor: Actor;
  editionId: string | null;
  now: Date;
  registry: Registry;
  /** Ids emitted in this transaction, dispatched by the guard after commit. */
  emitted: string[];
}

/**
 * Outbox write: one domain_events row plus one pending delivery per handling
 * module, inside the caller's transaction. The emitter never knows who listens.
 */
export function createEventsApi(db: DbOrTx, scope: EmitScope) {
  return {
    async emit(name: string, payload: unknown): Promise<string> {
      const contract = (
        eventContracts as Record<string, { parse: (v: unknown) => unknown } | undefined>
      )[name];
      if (!contract) throw new Error(`Event "${name}" has no contract in src/contracts/events`);
      if (!name.startsWith(`${scope.moduleId}.`)) {
        throw new Error(
          `Module "${scope.moduleId}" can't emit "${name}" (events are owned by their emitter)`,
        );
      }
      const manifest = scope.registry.get(scope.moduleId);
      if (!manifest?.events?.emits?.includes(name)) {
        throw new Error(`"${name}" is not listed in ${scope.moduleId} manifest.events.emits`);
      }
      const parsed = contract.parse(payload) as { v: number };
      const [row] = await db
        .insert(domainEvents)
        .values({
          name,
          version: parsed.v,
          payload: parsed,
          emittedByModule: scope.moduleId,
          actorPersonId: scope.actor.personId,
          editionId: scope.editionId,
          occurredAt: scope.now,
        })
        .returning({ id: domainEvents.id });
      if (!row) throw new Error(`Event ${name} was not stored`);
      const handlers = scope.registry.handlersOf(name);
      if (handlers.length) {
        await db.insert(domainEventDeliveries).values(
          handlers.map((m) => ({
            eventId: row.id,
            handlerModule: m.id,
            nextAttemptAt: scope.now,
          })),
        );
      }
      scope.emitted.push(row.id);
      return row.id;
    },
  };
}
export type EventsApi = ReturnType<typeof createEventsApi>;
