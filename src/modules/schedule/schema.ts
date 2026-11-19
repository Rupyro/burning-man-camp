import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { CATEGORIES } from "./rules/schedule";

// Every table and enum starts with "schedule_" (DATA_MODEL.md §10). FKs only to base tables.

export const scheduleCategoryEnum = pgEnum("schedule_category", CATEGORIES);

/** One thing the camp offers: a class, a meal, a party, a ritual. */
export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 120 }).notNull(),
    description: varchar("description", { length: 1000 }).notNull().default(""),
    category: scheduleCategoryEnum("category").notNull().default("class"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    location: varchar("location", { length: 120 }).notNull().default("At camp"),
    hostPersonId: uuid("host_person_id").references(() => people.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedule_events_edition_idx").on(t.editionId, t.startsAt)],
);
