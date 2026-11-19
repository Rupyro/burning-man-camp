import { boolean, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";

// Every table starts with "exodus_" (DATA_MODEL.md §10). FKs only to base tables.

/** When one member leaves the event, and whether they stay for the final sweep. */
export const exodusDepartures = pgTable(
  "exodus_departures",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    departsAt: timestamp("departs_at", { withTimezone: true }).notNull(),
    staysForSweep: boolean("stays_for_sweep").notNull().default(false),
    /** Ride, car or bus: free text, no names of others. */
    travel: varchar("travel", { length: 200 }).notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("exodus_departures_person_uq").on(t.editionId, t.personId)],
);
