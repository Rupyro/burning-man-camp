import {
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { EARLY_STATES, PASS_STATES, TICKET_STATES } from "./rules/gate";

// Every table and enum starts with "tickets_" (DATA_MODEL.md §10). FKs only to base tables.

export const ticketsTicketEnum = pgEnum("tickets_ticket_state", TICKET_STATES);
export const ticketsPassEnum = pgEnum("tickets_pass_state", PASS_STATES);
export const ticketsEarlyEnum = pgEnum("tickets_early_state", EARLY_STATES);

/** Each member's ticket, vehicle pass and early-arrival pass for one edition. They set it. */
export const ticketsStatus = pgTable(
  "tickets_status",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    ticket: ticketsTicketEnum("ticket").notNull().default("none"),
    vehiclePass: ticketsPassEnum("vehicle_pass").notNull().default("not_needed"),
    earlyArrival: ticketsEarlyEnum("early_arrival").notNull().default("no"),
    note: varchar("note", { length: 200 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tickets_status_uq").on(t.editionId, t.personId)],
);

/** What the event gave the camp this edition: Stewards tickets, vehicle passes, early passes. */
export const ticketsAllocations = pgTable("tickets_allocations", {
  editionId: uuid("edition_id")
    .primaryKey()
    .references(() => editions.id, { onDelete: "restrict" }),
  stewards: integer("stewards").notNull().default(0),
  vehiclePasses: integer("vehicle_passes").notNull().default(0),
  earlyPasses: integer("early_passes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
