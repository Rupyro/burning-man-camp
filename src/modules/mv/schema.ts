import { boolean, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";

// Every table starts with "mv_" (DATA_MODEL.md §10). FKs only to base tables.

/** A member who offers to drive the camp's mutant vehicle, and whether they're cleared. */
export const mvDrivers = pgTable(
  "mv_drivers",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Cleared by the DMV contact (license seen, briefed on the vehicle's rules). */
    cleared: boolean("cleared").notNull().default(false),
    note: varchar("note", { length: 200 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mv_drivers_person_uq").on(t.editionId, t.personId)],
);
