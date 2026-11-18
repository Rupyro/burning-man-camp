import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { idColumn } from "./columns";
import { people } from "./core";

// DATA_MODEL.md §12: notifications, alert dedupe, the email outbox and job runs
// (docs/specs/b2-task-engine.md A1–A7, N1–N4, J1). Titles and payloads carry safe fields only.

export const notificationUrgencyEnum = pgEnum("notification_urgency", ["immediate", "digest"]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email_immediate",
  "email_digest",
  "off",
]);
export const digestFrequencyEnum = pgEnum("digest_frequency", ["daily", "weekly"]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "sending",
  "sent",
  "failed",
  "suppressed",
]);
export const jobStatusEnum = pgEnum("job_status", ["running", "succeeded", "failed"]);

const person = (name: string) => uuid(name).references(() => people.id, { onDelete: "restrict" });
const at = (name: string) => timestamp(name, { withTimezone: true });

export const alertRules = pgTable(
  "alert_rules",
  {
    /** base: due_soon, overdue, unowned, dependency_risk; modules: "<module>.<rule>". */
    key: varchar("key", { length: 60 }).primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    /** Thresholds in days; null = the code default (rules/alerts.ts). Each rule uses its own. */
    remindDaysBefore: smallint("remind_days_before"),
    remindAgainDaysBefore: smallint("remind_again_days_before"),
    escalateLeadAfterDays: smallint("escalate_lead_after_days"),
    escalateCampAfterDays: smallint("escalate_camp_after_days"),
    withinDays: smallint("within_days"),
    escalateWithinDays: smallint("escalate_within_days"),
    /** Hour thresholds for rules that run close to a start time (e.g. shifts); null = code default. */
    remindHoursBefore: smallint("remind_hours_before"),
    remindAgainHoursBefore: smallint("remind_again_hours_before"),
    escalateLeadHoursBefore: smallint("escalate_lead_hours_before"),
    updatedByPersonId: person("updated_by_person_id"),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "alert_rules_days_ck",
      sql`coalesce(${t.remindDaysBefore}, 0) between 0 and 60 and coalesce(${t.remindAgainDaysBefore}, 0) between 0 and 60 and coalesce(${t.escalateLeadAfterDays}, 0) between 0 and 60 and coalesce(${t.escalateCampAfterDays}, 0) between 0 and 60 and coalesce(${t.withinDays}, 1) between 1 and 60 and coalesce(${t.escalateWithinDays}, 0) between 0 and 60`,
    ),
    check(
      "alert_rules_hours_ck",
      sql`coalesce(${t.remindHoursBefore}, 1) between 1 and 720 and coalesce(${t.remindAgainHoursBefore}, 1) between 1 and 720 and coalesce(${t.escalateLeadHoursBefore}, 1) between 1 and 720`,
    ),
  ],
);

/** One row per (rule, entity, level, fingerprint) that has fired; a new due date is a new row. */
export const alertStates = pgTable(
  "alert_states",
  {
    id: idColumn(),
    ruleKey: varchar("rule_key", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    /** 0 owner, 1 team leads, 2 camp leads. */
    level: smallint("level").notNull(),
    fingerprint: text("fingerprint").notNull(),
    firstFiredAt: at("first_fired_at").notNull(),
    lastFiredAt: at("last_fired_at").notNull(),
    resolvedAt: at("resolved_at"),
  },
  (t) => [
    uniqueIndex("alert_states_dedupe_uq").on(
      t.ruleKey,
      t.entityType,
      t.entityId,
      t.level,
      t.fingerprint,
    ),
    index("alert_states_open_idx").on(t.entityType, t.entityId).where(sql`${t.resolvedAt} is null`),
    check("alert_states_level_range", sql`${t.level} between 0 and 2`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: idColumn(),
    recipientPersonId: person("recipient_person_id").notNull(),
    /** e.g. task.assigned, task.overdue, claim.decided, task.comment; modules namespace theirs. */
    type: varchar("type", { length: 40 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** In-app link, e.g. /tasks/<id>. */
    href: text("href").notNull(),
    urgency: notificationUrgencyEnum("urgency").notNull(),
    readAt: at("read_at"),
    digestedAt: at("digested_at"),
    alertStateId: uuid("alert_state_id").references(() => alertStates.id, { onDelete: "set null" }),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_recipient_read_idx").on(t.recipientPersonId, t.readAt),
    index("notifications_undigested_idx")
      .on(t.recipientPersonId, t.digestedAt)
      .where(sql`${t.digestedAt} is null`),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    personId: person("person_id").notNull(),
    /** A notification type, or '*' for "everything else". */
    type: varchar("type", { length: 40 }).notNull().default("*"),
    channel: notificationChannelEnum("channel").notNull(),
    digestFrequency: digestFrequencyEnum("digest_frequency").notNull().default("daily"),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.type] })],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: idColumn(),
    toPersonId: person("to_person_id"),
    toEmail: text("to_email").notNull(),
    template: varchar("template", { length: 60 }).notNull(),
    /** { subject, text, link? } built from safe fields. */
    payload: jsonb("payload").notNull(),
    /** Same key never queues twice (e.g. "notification:<id>", "digest:<person>:<date>"). */
    dedupeKey: text("dedupe_key").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    nextAttemptAt: at("next_attempt_at").notNull().defaultNow(),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    sentAt: at("sent_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_outbox_dedupe_uq").on(t.dedupeKey),
    index("email_outbox_status_next_idx").on(t.status, t.nextAttemptAt),
  ],
);

/** Append-only record of each job run (tick, digest, outbox send, modules' jobs). */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: idColumn(),
    job: varchar("job", { length: 60 }).notNull(),
    startedAt: at("started_at").notNull(),
    finishedAt: at("finished_at"),
    status: jobStatusEnum("status").notNull().default("running"),
    stats: jsonb("stats").notNull().default({}),
    error: text("error"),
  },
  (t) => [index("job_runs_job_started_idx").on(t.job, t.startedAt)],
);
