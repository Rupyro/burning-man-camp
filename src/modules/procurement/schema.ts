import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { buildAreas, editions, people, tasks, teams } from "@/base/api/schema";
import { newId } from "@/lib/ids";
import { NEED_STATUSES } from "./rules/status";

// Every table and enum starts with "procurement_" (DATA_MODEL.md §5). FKs only to base tables.
// The catalogue, places and stock are camp-wide (persist across years); needs are per edition.

const qty = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" });
const stamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
};

// Frozen keys (plan: labels come from camp.config.ts owners; changing keys or the default needs a migration).
export const procurementOwnerEnum = pgEnum("procurement_owner_label", [
  "oeaasies",
  "khoena",
  "shared",
  "borrowed",
  "rented",
]);
export const procurementLocationKindEnum = pgEnum("procurement_location_kind", [
  "container",
  "storage",
  "site_area",
  "person",
]);
export const procurementConditionEnum = pgEnum("procurement_condition", [
  "good",
  "needs_repair",
  "broken",
  "missing",
]);
export const procurementMoveReasonEnum = pgEnum("procurement_move_reason", [
  "count",
  "purchase",
  "load",
  "consumed",
  "broken",
  "returned",
]);
export const procurementNeedStatusEnum = pgEnum("procurement_need_status", NEED_STATUSES);
export const procurementNeedSourceEnum = pgEnum("procurement_need_source", ["manual", "template"]);

export const procurementItems = pgTable(
  "procurement_items",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    // Text since plan PR 11 (was a 12-value enum): a built-in or camp-own key, checked in
    // rules/csv.ts (isCampCategory), not by the database.
    category: varchar("category", { length: 40 }).notNull().default("other"),
    unit: varchar("unit", { length: 16 }).notNull().default("pcs"),
    isAsset: boolean("is_asset").notNull().default(true),
    ownerLabel: procurementOwnerEnum("owner_label").notNull().default("oeaasies"),
    isBottleneck: boolean("is_bottleneck").notNull().default(false),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Import batch this item came from (base import_batches; no FK across the boundary). */
    importBatchId: uuid("import_batch_id"),
    /** Who looks after this item (set by hand or from the tool-list import). */
    responsiblePersonId: uuid("responsible_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    buildAreaId: uuid("build_area_id").references(() => buildAreas.id, { onDelete: "set null" }),
    ...stamps,
  },
  (t) => [
    uniqueIndex("procurement_items_name_uq").on(sql`lower(${t.name})`),
    index("procurement_items_category_ix").on(t.category),
    index("procurement_items_import_batch_ix").on(t.importBatchId),
  ],
);

export const procurementLocations = pgTable(
  "procurement_locations",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    name: text("name").notNull(),
    kind: procurementLocationKindEnum("kind").notNull().default("container"),
    description: text("description"),
    keysHeldByPersonId: uuid("keys_held_by_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    importBatchId: uuid("import_batch_id"),
    ...stamps,
  },
  (t) => [uniqueIndex("procurement_locations_name_uq").on(sql`lower(${t.name})`)],
);

export const procurementStock = pgTable(
  "procurement_stock",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    itemId: uuid("item_id")
      .notNull()
      .references(() => procurementItems.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => procurementLocations.id, { onDelete: "restrict" }),
    condition: procurementConditionEnum("condition").notNull().default("good"),
    quantity: qty("quantity").notNull(),
    countedAt: timestamp("counted_at", { withTimezone: true }).notNull().defaultNow(),
    countedByPersonId: uuid("counted_by_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    importBatchId: uuid("import_batch_id"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("procurement_stock_uq").on(t.itemId, t.locationId, t.condition),
    check("procurement_stock_qty_ck", sql`${t.quantity} >= 0`),
  ],
);

/** Append-only: every stock change, so counts are explainable. */
export const procurementStockMovements = pgTable(
  "procurement_stock_movements",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    itemId: uuid("item_id")
      .notNull()
      .references(() => procurementItems.id, { onDelete: "restrict" }),
    fromLocationId: uuid("from_location_id").references(() => procurementLocations.id),
    toLocationId: uuid("to_location_id").references(() => procurementLocations.id),
    condition: procurementConditionEnum("condition").notNull(),
    /** Signed change in quantity at the location (for counts: new minus old). */
    delta: qty("delta").notNull(),
    reason: procurementMoveReasonEnum("reason").notNull(),
    note: text("note"),
    actorPersonId: uuid("actor_person_id").references(() => people.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("procurement_moves_item_ix").on(t.itemId, t.at)],
);

export const procurementSuppliers = pgTable("procurement_suppliers", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  name: text("name").notNull(),
  category: text("category"),
  contactName: text("contact_name"),
  /** Sensitive-lite: shown only with procurement.supplier.contact (P3). */
  contactPhone: varchar("contact_phone", { length: 32 }),
  email: text("email"),
  website: text("website"),
  notes: text("notes"),
  lastUsedYear: smallint("last_used_year"),
  ...stamps,
});

export const procurementNeeds = pgTable(
  "procurement_needs",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => procurementItems.id, { onDelete: "restrict" }),
    quantityNeeded: qty("quantity_needed").notNull(),
    quantityOnHandSnapshot: qty("quantity_on_hand_snapshot"),
    status: procurementNeedStatusEnum("status").notNull().default("needed"),
    isCritical: boolean("is_critical").notNull().default(false),
    source: procurementNeedSourceEnum("source").notNull().default("manual"),
    supplierId: uuid("supplier_id").references(() => procurementSuppliers.id, {
      onDelete: "set null",
    }),
    neededBy: date("needed_by"),
    ownerPersonId: uuid("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    raisedByPersonId: uuid("raised_by_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    /** Optional estimate for the spend request, integer cents. */
    estimateCents: bigint("estimate_cents", { mode: "number" }),
    /** Soft ref to finance.spend_request, set by the finance.spend.decided event. */
    spendRequestRefId: uuid("spend_request_ref_id"),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    notes: text("notes"),
    importBatchId: uuid("import_batch_id"),
    ...stamps,
  },
  (t) => [
    index("procurement_needs_status_ix").on(t.editionId, t.status),
    index("procurement_needs_item_ix").on(t.itemId),
    check("procurement_needs_qty_ck", sql`${t.quantityNeeded} > 0`),
    check(
      "procurement_needs_estimate_ck",
      sql`${t.estimateCents} is null or ${t.estimateCents} > 0`,
    ),
  ],
);

/**
 * "Ask the camp" log (Oct 28 2026). One row per thing that happened: a lead asked, or fixed what
 * the app did ("Looks right", "Change owner", "Change date"). Fixes point at the ask they fix, so
 * the corrections can be read back to improve the routing. Rows are only ever added.
 */
export const procurementAskLog = pgTable(
  "procurement_ask_log",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    /** Null on the ask itself; on a fix, the ask it fixes. */
    askId: uuid("ask_id"),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 20 }).notNull(),
    text: text("text"),
    router: varchar("router", { length: 10 }),
    guessed: boolean("guessed").notNull().default(false),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    needId: uuid("need_id").references(() => procurementNeeds.id, { onDelete: "set null" }),
    ownerPersonId: uuid("owner_person_id").references(() => people.id, { onDelete: "set null" }),
    dueOn: date("due_on"),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    /** Estimated AI cost of this row in cents (0 for the demo router). */
    aiCostCents: integer("ai_cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("procurement_ask_log_edition_ix").on(t.editionId, t.createdAt),
    index("procurement_ask_log_ask_ix").on(t.askId),
    check(
      "procurement_ask_log_action_ck",
      sql`${t.action} in ('asked', 'looks_right', 'change_owner', 'change_date')`,
    ),
  ],
);

/**
 * Drafts (Oct 28 2026): a vendor email or WhatsApp update the app wrote for a lead. The lead can
 * edit, discard or send it; nothing goes out without them pressing a button.
 */
export const procurementDrafts = pgTable(
  "procurement_drafts",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    kind: varchar("kind", { length: 10 }).notNull(),
    ask: text("ask").notNull(),
    toText: text("to_text").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    writer: varchar("writer", { length: 10 }).notNull(),
    status: varchar("status", { length: 10 }).notNull().default("draft"),
    /** Estimated AI cost of writing this draft in cents (0 for the demo writer). */
    aiCostCents: integer("ai_cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("procurement_drafts_edition_ix").on(t.editionId, t.createdAt),
    check("procurement_drafts_kind_ck", sql`${t.kind} in ('email', 'whatsapp')`),
    check("procurement_drafts_status_ck", sql`${t.status} in ('draft', 'sent', 'discarded')`),
  ],
);

/** Every step on a draft (drafted, edited, discarded, sent, opened_whatsapp). Only ever added. */
export const procurementDraftLog = pgTable(
  "procurement_draft_log",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => procurementDrafts.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("procurement_draft_log_draft_ix").on(t.draftId),
    check(
      "procurement_draft_log_action_ck",
      sql`${t.action} in ('drafted', 'edited', 'discarded', 'sent', 'opened_whatsapp')`,
    ),
  ],
);

/** Which teams (departments) use an item. Many to many. */
export const procurementItemTeams = pgTable(
  "procurement_item_teams",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => procurementItems.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    importBatchId: uuid("import_batch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.teamId] }),
    index("procurement_item_teams_team_ix").on(t.teamId),
  ],
);
