import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions, people, tasks } from "@/base/api/schema";
import { newId } from "@/lib/ids";

// Every table and enum starts with "obligation_" (DATA_MODEL.md §10). FKs only to base tables.

export const obligationAuthorityEnum = pgEnum("obligation_authority", [
  "afrikaburn",
  "burning_man",
  "dmv",
  "fuel_team",
  "sound_team",
  "supplier_depot",
  "quicket",
  "internal",
]);

export const obligationCategoryEnum = pgEnum("obligation_category", [
  "registration",
  "wap",
  "mutant_vehicle",
  "sound",
  "lnt",
  "fire_safety",
  "gas_fuel",
  "water_ice",
  "food_safety",
  "supplier",
  "tickets",
  "exit_signoff",
  "other",
]);

/** 1:1 extension of a base task with kind "obligations.obligation". */
export const obligationDetails = pgTable(
  "obligation_details",
  {
    taskId: uuid("task_id")
      .primaryKey()
      .references(() => tasks.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    /** Stable slug per edition (seeding, year rollover), e.g. "mv_registration". */
    key: varchar("key", { length: 60 }).notNull(),
    authority: obligationAuthorityEnum("authority").notNull(),
    category: obligationCategoryEnum("category").notNull(),
    sourceUrl: text("source_url"),
    sourceDocSlug: text("source_doc_slug"),
    dateConfirmed: boolean("date_confirmed").notNull().default(false),
    previousYearDate: date("previous_year_date"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    confirmationRef: text("confirmation_ref"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    uniqueIndex("obligation_details_edition_key_uq").on(t.editionId, t.key),
    index("obligation_details_category_idx").on(t.editionId, t.category),
  ],
);

export const obligationDocumentStatusEnum = pgEnum("obligation_document_status", [
  "needed",
  "done",
]);

/** What an obligation needs handed in, as a checklist (one row per document, in order). */
export const obligationDocuments = pgTable(
  "obligation_documents",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    taskId: uuid("task_id")
      .notNull()
      .references(() => obligationDetails.taskId, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    status: obligationDocumentStatusEnum("status").notNull().default("needed"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneByPersonId: uuid("done_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
  },
  (t) => [
    uniqueIndex("obligation_documents_name_uq").on(t.taskId, t.name),
    index("obligation_documents_task_idx").on(t.taskId, t.position),
    check("obligation_documents_done_ck", sql`(${t.status} = 'done') = (${t.doneAt} is not null)`),
  ],
);

/** Someone passed a camp quiz this edition (e.g. leave-no-trace). One row per person per quiz. */
export const obligationQuizPasses = pgTable(
  "obligation_quiz_passes",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    quizKey: varchar("quiz_key", { length: 40 }).notNull(),
    passedAt: timestamp("passed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("obligation_quiz_passes_uq").on(t.editionId, t.personId, t.quizKey)],
);
