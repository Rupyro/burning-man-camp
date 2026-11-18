import { and, eq, inArray, lte } from "drizzle-orm";
import { Actor } from "../authz/actor";
import type { Db } from "../db/client";
import { getModuleFlags } from "../flags/flags";
import { buildActionContext } from "../guard/context";
import type { Registry } from "../registry/runtime";
import type { DomainEventEnvelope } from "../registry/types";
import { domainEventDeliveries, domainEvents, editions } from "../schema";

export const MAX_DELIVERY_ATTEMPTS = 5;

export interface DispatchResult {
  done: number;
  skipped: number;
  failed: number;
}

/**
 * Deliver pending events to handlers. Each handler runs in its own transaction
 * with a system actor, and the delivery is marked done in that same transaction.
 * Disabled (or removed) modules are marked `skipped`. Failures back off
 * exponentially; after 5 attempts the delivery stays `failed` ("stuck events").
 * Called right after commit by the guard; the B2 jobs tick will call it for retries.
 * Events a handler emits (e.g. Finance answering an accepted applicant with a fee) are delivered
 * right after, up to 3 hops deep; anything left waits for the tick.
 */
export async function dispatchEvents(
  db: Db,
  registry: Registry,
  opts: { eventIds?: string[]; now?: Date; limit?: number; depth?: number } = {},
): Promise<DispatchResult> {
  const now = opts.now ?? new Date();
  const result: DispatchResult = { done: 0, skipped: 0, failed: 0 };
  const conditions = [
    inArray(domainEventDeliveries.status, ["pending", "failed"] as const),
    lte(domainEventDeliveries.nextAttemptAt, now),
  ];
  if (opts.eventIds) {
    if (opts.eventIds.length === 0) return result;
    conditions.push(inArray(domainEventDeliveries.eventId, opts.eventIds));
  }
  const due = await db
    .select({ delivery: domainEventDeliveries, event: domainEvents })
    .from(domainEventDeliveries)
    .innerJoin(domainEvents, eq(domainEvents.id, domainEventDeliveries.eventId))
    .where(and(...conditions))
    .orderBy(domainEvents.occurredAt)
    .limit(opts.limit ?? 100);
  if (!due.length) return result;

  const flags = await getModuleFlags(db, registry);
  const followUps: string[] = [];
  for (const { delivery, event } of due) {
    if (delivery.attempts >= MAX_DELIVERY_ATTEMPTS) continue;
    const manifest = registry.get(delivery.handlerModule);
    const load = manifest?.events?.handles?.[event.name];
    if (!manifest || !load || !flags.get(manifest.id)?.enabled) {
      await db
        .update(domainEventDeliveries)
        .set({
          status: "skipped",
          doneAt: now,
          lastError: manifest ? "module switched off" : "module not registered",
        })
        .where(eq(domainEventDeliveries.id, delivery.id));
      result.skipped++;
      continue;
    }
    const envelope: DomainEventEnvelope = {
      id: event.id,
      name: event.name,
      version: event.version,
      payload: event.payload,
      emittedByModule: event.emittedByModule,
      editionId: event.editionId,
      occurredAt: event.occurredAt,
    };
    try {
      const handler = (await load()).default;
      const emitted: string[] = [];
      await db.transaction(async (tx) => {
        const [edition] = event.editionId
          ? await tx
              .select({ id: editions.id, year: editions.year })
              .from(editions)
              .where(eq(editions.id, event.editionId))
          : [];
        const ctx = buildActionContext(tx, {
          db,
          registry,
          moduleId: manifest.id,
          actor: Actor.system(event.editionId),
          edition: edition ?? { id: event.editionId ?? "", year: 0 },
          now,
          emitted,
        });
        await handler(ctx, envelope);
        await tx
          .update(domainEventDeliveries)
          .set({ status: "done", doneAt: now, attempts: delivery.attempts + 1, lastError: null })
          .where(eq(domainEventDeliveries.id, delivery.id));
      });
      result.done++;
      followUps.push(...emitted);
    } catch (error) {
      const attempts = delivery.attempts + 1;
      await db
        .update(domainEventDeliveries)
        .set({
          status: "failed",
          attempts,
          nextAttemptAt: new Date(now.getTime() + 2 ** attempts * 60_000),
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
        })
        .where(eq(domainEventDeliveries.id, delivery.id));
      result.failed++;
    }
  }
  const depth = opts.depth ?? 0;
  if (followUps.length && depth < 3) {
    const next = await dispatchEvents(db, registry, { eventIds: followUps, now, depth: depth + 1 });
    result.done += next.done;
    result.skipped += next.skipped;
    result.failed += next.failed;
  }
  return result;
}
