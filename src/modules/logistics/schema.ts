import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { editions, people } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { LOAD_STATUSES } from "./rules/loads";

// Every table and enum starts with "logistics_" (DATA_MODEL.md §6). FKs only to base tables.
// Places are camp-wide; vehicles, loads, items, travel plans and rides are per edition.

const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
};
const edition = () =>
  uuid("edition_id")
    .notNull()
    .references(() => editions.id, { onDelete: "restrict" });
const person = (name: string) => uuid(name).references(() => people.id, { onDelete: "set null" });

export const logisticsPlaceKindEnum = pgEnum("logistics_place_kind", [
  "storage",
  "container_yard",
  "site",
  "pickup",
  "airport",
  "city_area",
  "supplier",
]);
export const logisticsVehicleKindEnum = pgEnum("logistics_vehicle_kind", [
  "car",
  "truck",
  "trailer",
  "container_truck",
  "mutant_vehicle",
]);
export const logisticsDirectionEnum = pgEnum("logistics_load_direction", [
  "outbound",
  "return",
  "internal",
]);
export const logisticsLoadStatusEnum = pgEnum("logistics_load_status", LOAD_STATUSES);
export const logisticsTravelDirectionEnum = pgEnum("logistics_travel_direction", [
  "to_burn",
  "from_burn",
]);
export const logisticsTravelModeEnum = pgEnum("logistics_travel_mode", [
  "offering_ride",
  "need_ride",
  "own_arrangement",
]);
export const logisticsTimeOfDayEnum = pgEnum("logistics_time_of_day", [
  "morning",
  "afternoon",
  "evening",
  "flexible",
]);
export const logisticsMatchStatusEnum = pgEnum("logistics_match_status", [
  "proposed",
  "accepted",
  "declined",
  "cancelled",
]);

export const logisticsPlaces = pgTable(
  "logistics_places",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    kind: logisticsPlaceKindEnum("kind").notNull().default("pickup"),
    addressText: text("address_text"),
    notes: text("notes"),
    ...stamps,
  },
  (t) => [uniqueIndex("logistics_places_name_uq").on(sql`lower(${t.name})`)],
);

export const logisticsVehicles = pgTable("logistics_vehicles", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  editionId: edition(),
  label: text("label").notNull(),
  kind: logisticsVehicleKindEnum("kind").notNull().default("truck"),
  driverPersonId: person("driver_person_id"),
  seats: smallint("seats"),
  cargoNotes: text("cargo_notes"),
  ...stamps,
});

export const logisticsLoads = pgTable(
  "logistics_loads",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: edition(),
    name: text("name").notNull(),
    direction: logisticsDirectionEnum("direction").notNull().default("outbound"),
    vehicleId: uuid("vehicle_id").references(() => logisticsVehicles.id, { onDelete: "set null" }),
    originPlaceId: uuid("origin_place_id").references(() => logisticsPlaces.id, {
      onDelete: "restrict",
    }),
    /** Null = a gap for its critical items until someone picks one (L8). */
    destinationPlaceId: uuid("destination_place_id").references(() => logisticsPlaces.id, {
      onDelete: "restrict",
    }),
    departsAt: timestamp("departs_at", { withTimezone: true }),
    status: logisticsLoadStatusEnum("status").notNull().default("planned"),
    deliveredConfirmedAt: timestamp("delivered_confirmed_at", { withTimezone: true }),
    deliveredConfirmedByPersonId: person("delivered_confirmed_by_person_id"),
    notes: text("notes"),
    ...stamps,
  },
  (t) => [index("logistics_loads_edition_ix").on(t.editionId, t.status)],
);

export const logisticsLoadItems = pgTable(
  "logistics_load_items",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: edition(),
    /** Null = needs a load (e.g. from procurement.need.marked_critical). */
    loadId: uuid("load_id").references(() => logisticsLoads.id, { onDelete: "set null" }),
    sourceRefType: varchar("source_ref_type", { length: 40 }),
    sourceRefId: uuid("source_ref_id"),
    /** Unique: a duplicate delivery of the same event writes nothing. */
    sourceEventId: uuid("source_event_id"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }).notNull().default(1),
    unit: varchar("unit", { length: 16 }).notNull().default("pcs"),
    isCritical: boolean("is_critical").notNull().default(false),
    neededBy: date("needed_by"),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    packedByPersonId: person("packed_by_person_id"),
    ...stamps,
  },
  (t) => [
    index("logistics_load_items_load_ix").on(t.loadId),
    index("logistics_load_items_critical_ix").on(t.editionId).where(sql`${t.isCritical}`),
    uniqueIndex("logistics_load_items_event_uq").on(t.sourceEventId),
    check("logistics_load_items_qty_ck", sql`${t.quantity} > 0`),
  ],
);

export const logisticsTravelPlans = pgTable(
  "logistics_travel_plans",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: edition(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    direction: logisticsTravelDirectionEnum("direction").notNull(),
    mode: logisticsTravelModeEnum("mode").notNull(),
    areaPlaceId: uuid("area_place_id").references(() => logisticsPlaces.id, {
      onDelete: "set null",
    }),
    areaDetail: text("area_detail"),
    travelDate: date("travel_date"),
    timeOfDay: logisticsTimeOfDayEnum("time_of_day").notNull().default("flexible"),
    seatsOffered: smallint("seats_offered"),
    seatsNeeded: smallint("seats_needed"),
    carriesCargo: boolean("carries_cargo").notNull().default(false),
    notes: text("notes"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("logistics_travel_plans_uq").on(t.editionId, t.personId, t.direction),
    check(
      "logistics_travel_seats_ck",
      sql`(${t.seatsOffered} is null or ${t.seatsOffered} between 1 and 20) and (${t.seatsNeeded} is null or ${t.seatsNeeded} between 1 and 10)`,
    ),
  ],
);

export const logisticsRideMatches = pgTable(
  "logistics_ride_matches",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    driverPlanId: uuid("driver_plan_id")
      .notNull()
      .references(() => logisticsTravelPlans.id, { onDelete: "restrict" }),
    passengerPlanId: uuid("passenger_plan_id")
      .notNull()
      .references(() => logisticsTravelPlans.id, { onDelete: "restrict" }),
    seats: smallint("seats").notNull().default(1),
    status: logisticsMatchStatusEnum("status").notNull().default("proposed"),
    askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...stamps,
  },
  (t) => [
    uniqueIndex("logistics_ride_matches_uq").on(t.driverPlanId, t.passengerPlanId),
    check("logistics_ride_seats_ck", sql`${t.seats} between 1 and 10`),
    check("logistics_ride_not_self_ck", sql`${t.driverPlanId} <> ${t.passengerPlanId}`),
  ],
);
