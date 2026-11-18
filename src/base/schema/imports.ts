import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
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

// Ingestion stage (c): one batch per uploaded sheet, one row per CSV line with the cleaner's
// label and the admin's decision. Rows imported later (stage d) carry import_batch_id so a whole
// batch can be undone (stage e). Holds raw values: admin-only screens read it.

/** kind: members | tools | family. status: review | approved | imported | rolled_back. */
export const importBatches = pgTable(
  "import_batches",
  {
    id: idColumn(),
    kind: varchar("kind", { length: 20 }).notNull(),
    fileName: text("file_name").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("review"),
    /** The cleaner's shareable summary: counts, issue codes, warnings (no values). */
    summary: jsonb("summary").notNull(),
    headers: jsonb("headers").notNull(),
    uploadedByPersonId: uuid("uploaded_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    approvedByPersonId: uuid("approved_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [index("import_batches_uploaded_idx").on(t.uploadedAt)],
);

/** decision: pending | accept | fix | skip. */
export const importBatchRows = pgTable(
  "import_batch_rows",
  {
    id: idColumn(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    line: integer("line").notNull(),
    label: varchar("label", { length: 20 }).notNull(),
    issues: jsonb("issues").notNull(),
    changes: jsonb("changes").notNull(),
    raw: jsonb("raw").notNull(),
    cleaned: jsonb("cleaned").notNull(),
    /** CSV line of the earlier row this one repeats, if any. */
    duplicateOfLine: integer("duplicate_of_line"),
    decision: varchar("decision", { length: 10 }).notNull().default("pending"),
    /** Admin's corrected values, by field (decision = fix). */
    fix: jsonb("fix"),
    /** A person name found in the status column, set as who's responsible (opt-in). */
    setResponsible: boolean("set_responsible").notNull().default(false),
    decidedByPersonId: uuid("decided_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("import_batch_rows_line_uq").on(t.batchId, t.line)],
);

/** Past Oe-aa-sies Family years (2023 onward) from old sheets, by person or email. Read with the
 * applicants' confirmed family years for the journey and badges. */
export const pastFamilyYears = pgTable(
  "past_family_years",
  {
    id: idColumn(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    email: text("email"),
    displayName: text("display_name"),
    year: smallint("year").notNull(),
    /** What they did that year (e.g. kitchen lead). */
    role: text("role"),
    notes: text("notes"),
    importBatchId: uuid("import_batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("past_family_years_email_year_uq").on(sql`lower(${t.email})`, t.year),
    index("past_family_years_person_idx").on(t.personId),
    index("past_family_years_batch_idx").on(t.importBatchId),
    check("past_family_years_year_ck", sql`${t.year} >= 2023`),
  ],
);
