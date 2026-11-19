import { index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { KINDS } from "./rules/registers";

// Every table and enum starts with "registers_" (DATA_MODEL.md §10). FKs only to base tables.

export const registersKindEnum = pgEnum("registers_kind", KINDS);

/** One line in a safety register: a fuel store, a flame effect, or a batch of stakes. */
export const registersItems = pgTable(
  "registers_items",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    kind: registersKindEnum("kind").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    /** Fuel: amount in the event's unit. Stakes: how many went in. Flame: number of effects. */
    quantity: integer("quantity").notNull().default(1),
    /** Stakes pulled at strike (stakes only). */
    pulled: integer("pulled").notNull().default(0),
    location: varchar("location", { length: 120 }).notNull().default(""),
    notes: varchar("notes", { length: 500 }).notNull().default(""),
    ownerPersonId: uuid("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("registers_items_edition_idx").on(t.editionId, t.kind)],
);
