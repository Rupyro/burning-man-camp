import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { APPLICATION_STATUSES } from "./rules/journey";

// Every table and enum starts with "applicant_" (spec applicants). FKs only to base tables;
// the Finance camp fee is a soft reference (fee_ref_id, no FK).

const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
};
const at = (name: string) => timestamp(name, { withTimezone: true });

export const applicantStatusEnum = pgEnum("applicant_status", APPLICATION_STATUSES);

export const applicantApplications = pgTable(
  "applicant_applications",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    status: applicantStatusEnum("status").notNull().default("draft"),
    /** PLACEHOLDER form answers, by question key (rules/form.ts). No medical or dietary data. */
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    submittedAt: at("submitted_at"),
    interviewAt: at("interview_at"),
    interviewDoneAt: at("interview_done_at"),
    decidedAt: at("decided_at"),
    decidedByPersonId: uuid("decided_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    /** Snapshot from finance.fee.created (integer cents). */
    feeCents: bigint("fee_cents", { mode: "number" }),
    feeCurrency: char("fee_currency", { length: 3 }),
    feeRefType: varchar("fee_ref_type", { length: 40 }),
    feeRefId: uuid("fee_ref_id"),
    paidAt: at("paid_at"),
    joinedAt: at("joined_at"),
    /** Welcome list (Oct 28 2026): when the new member said they'd read the camp guide. */
    guideReadAt: at("guide_read_at"),
    /** Private to reviewers. */
    leadNote: text("lead_note"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("applicant_applications_person_uq").on(t.editionId, t.personId),
    index("applicant_applications_status_idx").on(t.editionId, t.status),
  ],
);

export const applicantDocuments = pgTable(
  "applicant_documents",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applicantApplications.id, { onDelete: "cascade" }),
    docKey: varchar("doc_key", { length: 40 }).notNull(),
    doneAt: at("done_at").notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex("applicant_documents_uq").on(t.applicationId, t.docKey)],
);

// Oe-aa-sies Family fast track (Nov 1 2026).
export const applicantFamilyDecisionEnum = pgEnum("applicant_family_decision", [
  "waiting",
  "approved",
  "asked",
  "declined",
]);

/** The years a returning member says they camped with us, and whether an admin confirmed them. */
export const applicantFamilyYears = pgTable(
  "applicant_family_years",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applicantApplications.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    leadConfirmed: boolean("lead_confirmed").notNull().default(false),
    /** Import batch this year came from (base import_batches; no FK across the boundary). */
    importBatchId: uuid("import_batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("applicant_family_years_uq").on(t.applicationId, t.year)],
);

/** Their memories: the six short questions about past years. */
export const applicantFamilyAnswers = pgTable("applicant_family_answers", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => applicantApplications.id, { onDelete: "cascade" }),
  teams: jsonb("teams").$type<string[]>().notNull().default([]),
  led: boolean("led").notNull().default(false),
  ledWhat: text("led_what"),
  buildPieces: jsonb("build_pieces").$type<string[]>().notNull().default([]),
  goodAt: jsonb("good_at").$type<string[]>().notNull().default([]),
  loveTo: jsonb("love_to").$type<string[]>().notNull().default([]),
  anythingElse: text("anything_else"),
  ...stamps,
});

/** The welcome decision for one returning member. */
export const applicantFamilyApprovals = pgTable("applicant_family_approvals", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => applicantApplications.id, { onDelete: "cascade" }),
  decision: applicantFamilyDecisionEnum("decision").notNull().default("waiting"),
  decidedByPersonId: uuid("decided_by_person_id").references(() => people.id, {
    onDelete: "restrict",
  }),
  decidedAt: at("decided_at"),
  note: text("note"),
  suggestedRoleShown: text("suggested_role_shown"),
  ...stamps,
});
