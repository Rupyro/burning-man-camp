import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { idColumn } from "./columns";
import { people } from "./core";

// DATA_MODEL.md §12: audit log, feature flags, domain-event outbox.

export const auditActorKindEnum = pgEnum("audit_actor_kind", ["person", "system", "import"]);
export const auditSignificanceEnum = pgEnum("audit_significance", [
  "activity",
  "significant",
  "security",
]);
export const moduleAudienceEnum = pgEnum("module_audience", ["everyone", "pilot", "admins"]);
export const eventDeliveryStatusEnum = pgEnum("event_delivery_status", [
  "pending",
  "done",
  "failed",
  "skipped",
]);

/** Append-only. The app only ever inserts (see docs/runbook.md for the DB grant). */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: idColumn(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorPersonId: uuid("actor_person_id").references(() => people.id, { onDelete: "restrict" }),
    actorKind: auditActorKindEnum("actor_kind").notNull(),
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    editionId: uuid("edition_id"),
    changes: jsonb("changes"),
    significance: auditSignificanceEnum("significance").notNull().default("activity"),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
  },
  (t) => [
    index("audit_events_entity_idx").on(t.entityType, t.entityId, t.occurredAt),
    index("audit_events_actor_idx").on(t.actorPersonId, t.occurredAt),
    index("audit_events_action_idx").on(t.action, t.occurredAt),
  ],
);

/** One row per module (feature flag). Created from manifest.flag on first use. */
export const moduleSettings = pgTable("module_settings", {
  moduleId: varchar("module_id", { length: 40 }).primaryKey(),
  enabled: boolean("enabled").notNull(),
  audience: moduleAudienceEnum("audience").notNull().default("everyone"),
  updatedByPersonId: uuid("updated_by_person_id").references(() => people.id, {
    onDelete: "restrict",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Camp settings for the automatic rules (Oct 28 2026). One row per changed setting; anything
 * missing uses the default in base/settings/automation.ts. Values are whole numbers (days,
 * cents, or 0/1 for off/on). */
export const automationSettings = pgTable("automation_settings", {
  key: varchar("key", { length: 40 }).primaryKey(),
  value: integer("value").notNull(),
  updatedByPersonId: uuid("updated_by_person_id").references(() => people.id, {
    onDelete: "restrict",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only outbox, written in the same transaction as the change that caused it. */
export const domainEvents = pgTable(
  "domain_events",
  {
    id: idColumn(),
    name: varchar("name", { length: 80 }).notNull(),
    version: smallint("version").notNull(),
    payload: jsonb("payload").notNull(),
    emittedByModule: varchar("emitted_by_module", { length: 40 }).notNull(),
    actorPersonId: uuid("actor_person_id").references(() => people.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domain_events_occurred_idx").on(t.occurredAt)],
);

export const domainEventDeliveries = pgTable(
  "domain_event_deliveries",
  {
    id: idColumn(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => domainEvents.id, { onDelete: "restrict" }),
    handlerModule: varchar("handler_module", { length: 40 }).notNull(),
    status: eventDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("domain_event_deliveries_event_handler_uq").on(t.eventId, t.handlerModule),
    index("domain_event_deliveries_due_idx")
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} in ('pending', 'failed')`),
  ],
);
