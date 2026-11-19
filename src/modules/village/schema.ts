import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { DIRECTIONS, RESOURCES } from "./rules/village";

// Every table and enum starts with "village_" (DATA_MODEL.md §10). FKs only to base tables.

export const villageDirectionEnum = pgEnum("village_direction", DIRECTIONS);
export const villageResourceEnum = pgEnum("village_resource", RESOURCES);

/** Something lent to or borrowed from a partner camp in the village. */
export const villageShares = pgTable(
  "village_shares",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    partner: varchar("partner", { length: 80 }).notNull(),
    direction: villageDirectionEnum("direction").notNull(),
    resource: villageResourceEnum("resource").notNull().default("other"),
    item: varchar("item", { length: 120 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    notes: varchar("notes", { length: 300 }).notNull().default(""),
    returned: boolean("returned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("village_shares_edition_idx").on(t.editionId, t.partner)],
);
