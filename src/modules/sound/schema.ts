import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";

// Every table starts with "sound_" (DATA_MODEL.md §10). FKs only to base tables.

/** The camp's sound plan for one edition: quiet hours, a level limit and where speakers face. */
export const soundPlans = pgTable("sound_plans", {
  editionId: uuid("edition_id")
    .primaryKey()
    .references(() => editions.id, { onDelete: "restrict" }),
  quietFrom: varchar("quiet_from", { length: 5 }).notNull().default("03:00"),
  quietUntil: varchar("quiet_until", { length: 5 }).notNull().default("10:00"),
  maxDb: integer("max_db").notNull().default(100),
  speakersFace: varchar("speakers_face", { length: 120 }),
  notes: varchar("notes", { length: 1000 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A neighbor's visit or complaint about sound, and what the camp did about it. */
export const soundNeighborLog = pgTable(
  "sound_neighbor_log",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    at: timestamp("at", { withTimezone: true }).notNull(),
    neighbor: varchar("neighbor", { length: 80 }).notNull(),
    what: varchar("what", { length: 500 }).notNull(),
    action: varchar("action", { length: 500 }),
    loggedByPersonId: uuid("logged_by_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sound_neighbor_log_edition_idx").on(t.editionId, t.at)],
);
