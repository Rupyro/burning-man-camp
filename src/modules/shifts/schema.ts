import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { buildAreas, editions, people, skills } from "@/base/api/schema";
import { newId } from "@/lib/ids";

// Shifts (docs plan-shifts.md). Every table and enum starts with "shifts_"; FKs only to base
// tables. Settings are typed columns, never JSON. Nobody is ever assigned without consent.

const at = (name: string) => timestamp(name, { withTimezone: true });
const person = (name: string) => uuid(name).references(() => people.id, { onDelete: "restrict" });
const stamps = {
  createdAt: at("created_at").notNull().defaultNow(),
  updatedAt: at("updated_at").notNull().defaultNow(),
  version: integer("version").notNull().default(1),
};

export const shiftsCategoryEnum = pgEnum("shifts_category", [
  "kitchen",
  "moop",
  "mutant_vehicle",
  "infrastructure",
  "hosting",
  "build",
  "strike",
  "other",
]);
export const shiftsPhaseEnum = pgEnum("shifts_phase", ["build", "burn", "strike"]);
export const shiftsChecklistSectionEnum = pgEnum("shifts_checklist_section", [
  "before",
  "setup",
  "during",
  "cleanup",
  "resources",
  "final",
]);
export const shiftsSlotStatusEnum = pgEnum("shifts_slot_status", [
  "open",
  "filled",
  "cancelled",
  "closed_out",
]);
export const shiftsSignupSourceEnum = pgEnum("shifts_signup_source", [
  "claimed",
  "lead_added_with_consent",
  "swap",
  /** Cover arranged on the paper HELP sheet at the Burn, recorded by a lead afterwards. */
  "help_sheet",
]);
export const shiftsSignupStatusEnum = pgEnum("shifts_signup_status", [
  "claimed",
  "confirmed",
  "completed",
  "no_show",
  "released",
  "swapped_out",
]);
export const shiftsCoverKindEnum = pgEnum("shifts_cover_kind", ["swap", "give_away", "ask_cover"]);
export const shiftsCoverReasonEnum = pgEnum("shifts_cover_reason", [
  "clash",
  "unwell",
  "overwhelmed",
]);
export const shiftsCoverStatusEnum = pgEnum("shifts_cover_status", [
  "requested",
  "accepted",
  "lead_pending",
  "confirmed",
  "declined",
  "cancelled",
  "expired",
]);
export const shiftsHandoverOutcomeEnum = pgEnum("shifts_handover_outcome", [
  "all_good",
  "needs_attention",
  "missing",
]);
export const shiftsHandoverItemKindEnum = pgEnum("shifts_handover_item_kind", [
  "needs_attention",
  "missing",
]);
export const shiftsPrecreditKindEnum = pgEnum("shifts_precredit_kind", [
  "design",
  "sourcing",
  "logistics",
  "building",
  "organising",
]);

/** One row per edition: the editable defaults (freeze, minimums, credit cap). */
export const shiftsSettings = pgTable(
  "shifts_settings",
  {
    editionId: uuid("edition_id")
      .primaryKey()
      .references(() => editions.id, { onDelete: "restrict" }),
    freezeAt: at("freeze_at").notNull(),
    minDutyHours: smallint("min_duty_hours").notNull().default(8),
    /** Build and strike minimum, in whole days (not hours). */
    minBuildStrikeDays: smallint("min_build_strike_days").notNull().default(4),
    /** Max pre-Burn credit, as a percent of the duty minimum (default 50). */
    maxPrecreditPercent: smallint("max_precredit_percent").notNull().default(50),
    /** Silent no-shows (no cover asked) before the lead is privately flagged. */
    silentNoShowFlagAt: smallint("silent_no_show_flag_at").notNull().default(2),
    updatedByPersonId: person("updated_by_person_id"),
    ...stamps,
  },
  (t) => [
    check(
      "shifts_settings_ranges_ck",
      sql`${t.minDutyHours} between 0 and 200 and ${t.minBuildStrikeDays} between 0 and 60 and ${t.maxPrecreditPercent} between 0 and 100 and ${t.silentNoShowFlagAt} between 1 and 20`,
    ),
  ],
);

export const shiftsDutyTypes = pgTable(
  "shifts_duty_types",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 40 }).notNull(),
    name: text("name").notNull(),
    category: shiftsCategoryEnum("category").notNull(),
    phase: shiftsPhaseEnum("phase").notNull().default("burn"),
    description: text("description"),
    /** Specialist / safety-critical: claiming needs the skill, swaps need a lead's OK. */
    isSpecialist: boolean("is_specialist").notNull().default(false),
    requiredSkillId: uuid("required_skill_id").references(() => skills.id, {
      onDelete: "restrict",
    }),
    leadPersonId: person("lead_person_id"),
    backupPersonId: person("backup_person_id"),
    needsHandover: boolean("needs_handover").notNull().default(false),
    minStaff: smallint("min_staff").notNull().default(1),
    maxStaff: smallint("max_staff").notNull().default(1),
    ...stamps,
  },
  (t) => [
    uniqueIndex("shifts_duty_types_key_uq").on(t.editionId, t.key),
    check(
      "shifts_duty_types_staff_ck",
      sql`${t.minStaff} >= 1 and ${t.maxStaff} >= ${t.minStaff} and ${t.maxStaff} <= 50`,
    ),
    check(
      "shifts_duty_types_backup_ck",
      sql`${t.backupPersonId} is null or ${t.backupPersonId} is distinct from ${t.leadPersonId}`,
    ),
  ],
);

export const shiftsChecklistItems = pgTable(
  "shifts_checklist_items",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    dutyTypeId: uuid("duty_type_id")
      .notNull()
      .references(() => shiftsDutyTypes.id, { onDelete: "cascade" }),
    section: shiftsChecklistSectionEnum("section").notNull(),
    position: smallint("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [uniqueIndex("shifts_checklist_items_pos_uq").on(t.dutyTypeId, t.section, t.position)],
);

export const shiftsSlots = pgTable(
  "shifts_slots",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    dutyTypeId: uuid("duty_type_id")
      .notNull()
      .references(() => shiftsDutyTypes.id, { onDelete: "restrict" }),
    /** Optional build area for build-week shifts. */
    buildAreaId: uuid("build_area_id").references(() => buildAreas.id, { onDelete: "set null" }),
    startsAt: at("starts_at").notNull(),
    endsAt: at("ends_at").notNull(),
    /** Null = the duty type's staffing. */
    minStaff: smallint("min_staff"),
    maxStaff: smallint("max_staff"),
    status: shiftsSlotStatusEnum("status").notNull().default("open"),
    /** Places still empty at close-out (unclaimed, tracked apart from no-shows). */
    unfilledAtCloseOut: smallint("unfilled_at_close_out"),
    closedOutByPersonId: person("closed_out_by_person_id"),
    closedOutAt: at("closed_out_at"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("shifts_slots_uq").on(t.dutyTypeId, t.startsAt),
    index("shifts_slots_edition_start_idx").on(t.editionId, t.startsAt),
    check("shifts_slots_time_ck", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "shifts_slots_staff_ck",
      sql`coalesce(${t.minStaff}, 1) >= 1 and coalesce(${t.maxStaff}, 50) >= coalesce(${t.minStaff}, 1) and coalesce(${t.maxStaff}, 1) <= 50`,
    ),
    check(
      "shifts_slots_closed_ck",
      sql`(${t.status} = 'closed_out') = (${t.closedOutAt} is not null and ${t.closedOutByPersonId} is not null and ${t.unfilledAtCloseOut} is not null)`,
    ),
  ],
);

export const shiftsSignups = pgTable(
  "shifts_signups",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => shiftsSlots.id, { onDelete: "restrict" }),
    personId: person("person_id").notNull(),
    source: shiftsSignupSourceEnum("source").notNull().default("claimed"),
    status: shiftsSignupStatusEnum("status").notNull().default("claimed"),
    /** Lead who marked completed / no-show at close-out (after the Burn; never automatic).
     * Until then a past shift is unrecorded. Only completed counts as credit. */
    markedByPersonId: person("marked_by_person_id"),
    markedAt: at("marked_at"),
    ...stamps,
  },
  (t) => [
    check(
      "shifts_signups_marked_ck",
      sql`(${t.status} in ('completed', 'no_show')) = (${t.markedByPersonId} is not null and ${t.markedAt} is not null)`,
    ),
    // One live signup per person per shift (released / swapped-out rows are history).
    uniqueIndex("shifts_signups_live_uq")
      .on(t.slotId, t.personId)
      .where(sql`${t.status} not in ('released', 'swapped_out')`),
    index("shifts_signups_person_idx").on(t.personId),
  ],
);

export const shiftsCoverRequests = pgTable(
  "shifts_cover_requests",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    fromSignupId: uuid("from_signup_id")
      .notNull()
      .references(() => shiftsSignups.id, { onDelete: "restrict" }),
    /** Who it's offered to. A swap always names one qualified member (never open); give-away
     * and ask-for-cover may be open (null). Only that member can accept a swap. */
    toPersonId: person("to_person_id"),
    kind: shiftsCoverKindEnum("kind").notNull(),
    reason: shiftsCoverReasonEnum("reason").notNull(),
    status: shiftsCoverStatusEnum("status").notNull().default("requested"),
    acceptedByPersonId: person("accepted_by_person_id"),
    leadDecidedByPersonId: person("lead_decided_by_person_id"),
    decidedAt: at("decided_at"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("shifts_cover_requests_open_uq")
      .on(t.fromSignupId)
      .where(sql`${t.status} in ('requested', 'accepted', 'lead_pending')`),
    check(
      "shifts_cover_requests_swap_named_ck",
      sql`${t.kind} <> 'swap' or (${t.toPersonId} is not null and (${t.acceptedByPersonId} is null or ${t.acceptedByPersonId} = ${t.toPersonId}))`,
    ),
    check(
      "shifts_cover_requests_accepted_ck",
      sql`${t.status} not in ('accepted', 'lead_pending', 'confirmed') or ${t.kind} = 'ask_cover' or ${t.acceptedByPersonId} is not null`,
    ),
  ],
);

export const shiftsChecklistTicks = pgTable(
  "shifts_checklist_ticks",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => shiftsSlots.id, { onDelete: "restrict" }),
    checklistItemId: uuid("checklist_item_id")
      .notNull()
      .references(() => shiftsChecklistItems.id, { onDelete: "restrict" }),
    tickedByPersonId: person("ticked_by_person_id").notNull(),
    tickedAt: at("ticked_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shifts_checklist_ticks_uq").on(t.slotId, t.checklistItemId)],
);

export const shiftsHandovers = pgTable("shifts_handovers", {
  id: uuid("id").primaryKey().$defaultFn(newId),
  slotId: uuid("slot_id")
    .notNull()
    .references(() => shiftsSlots.id, { onDelete: "restrict" })
    .unique(),
  byPersonId: person("by_person_id").notNull(),
  outcome: shiftsHandoverOutcomeEnum("outcome").notNull(),
  createdAt: at("created_at").notNull().defaultNow(),
});

export const shiftsHandoverItems = pgTable(
  "shifts_handover_items",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => shiftsHandovers.id, { onDelete: "cascade" }),
    checklistItemId: uuid("checklist_item_id").references(() => shiftsChecklistItems.id, {
      onDelete: "restrict",
    }),
    kind: shiftsHandoverItemKindEnum("kind").notNull(),
    note: varchar("note", { length: 280 }),
  },
  (t) => [
    check(
      "shifts_handover_items_what_ck",
      sql`${t.checklistItemId} is not null or ${t.note} is not null`,
    ),
  ],
);

export const shiftsPrecredits = pgTable(
  "shifts_precredits",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: person("person_id").notNull(),
    kind: shiftsPrecreditKindEnum("kind").notNull(),
    hours: smallint("hours").notNull(),
    grantedByPersonId: person("granted_by_person_id").notNull(),
    ...stamps,
  },
  (t) => [
    uniqueIndex("shifts_precredits_uq").on(t.editionId, t.personId, t.kind),
    check("shifts_precredits_hours_ck", sql`${t.hours} between 1 and 200`),
    check("shifts_precredits_not_self_ck", sql`${t.grantedByPersonId} <> ${t.personId}`),
  ],
);

export const shiftsStandbyStatusEnum = pgEnum("shifts_standby_status", [
  "waiting",
  "offered",
  "took",
  "passed",
  "left",
]);

/** People waiting for a place on a full shift (automatic rule 1, Oct 28 2026). When someone drops
 * the shift, the first person waiting is offered it; nobody is put on a shift without saying yes. */
export const shiftsStandby = pgTable(
  "shifts_standby",
  {
    id: uuid("id").primaryKey().$defaultFn(newId),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => shiftsSlots.id, { onDelete: "restrict" }),
    personId: person("person_id").notNull(),
    status: shiftsStandbyStatusEnum("status").notNull().default("waiting"),
    /** Who dropped the place that was offered (shown as "Tom can no longer do it"). */
    droppedByPersonId: person("dropped_by_person_id"),
    offeredAt: at("offered_at"),
    decidedAt: at("decided_at"),
    ...stamps,
  },
  (t) => [
    uniqueIndex("shifts_standby_live_uq")
      .on(t.slotId, t.personId)
      .where(sql`${t.status} in ('waiting', 'offered')`),
    index("shifts_standby_slot_idx").on(t.slotId, t.createdAt),
  ],
);
