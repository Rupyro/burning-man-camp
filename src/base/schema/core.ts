import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  date,
  index,
  integer,
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
import { user } from "./auth";
import { idColumn, standardColumns } from "./columns";

// DATA_MODEL.md §1–2: editions, people, the per-year member record, teams, roles.
// B1 (docs/specs/b1-people-teams-roles.md) added the profile, travel and diet fields,
// anchor dates, skills, availability windows and admin-only notes.

export const editionStatusEnum = pgEnum("edition_status", [
  "planning",
  "active",
  "closed",
  "archived",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "prospect",
  "waitlisted",
  "confirmed",
  "withdrawn",
  "removed",
]);
export const directoryVisibilityEnum = pgEnum("directory_visibility", [
  "hidden",
  "members",
  "members_with_contact",
]);
export const roleKindEnum = pgEnum("role_kind", ["system", "capability", "officer"]);
export const teamRoleEnum = pgEnum("team_role", ["lead", "co_lead", "member"]);
export const paymentStatusEnum = pgEnum("payment_status_import", [
  "unknown",
  "deposit_paid",
  "paid_in_full",
  "waived",
  "overdue",
]);
export const crewCommitmentEnum = pgEnum("crew_commitment", ["none", "partial", "full"]);
export const tentChoiceEnum = pgEnum("tent_choice", [
  "camp_dome",
  "large_bell",
  "byo_tent",
  "caravan_or_car",
  "undecided",
]);
export const dietEnum = pgEnum("member_diet", [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "other",
]);
export const availabilityKindEnum = pgEnum("availability_kind", ["available", "unavailable"]);

export const editions = pgTable("editions", {
  id: idColumn(),
  year: smallint("year").notNull().unique(),
  title: text("title").notNull(),
  status: editionStatusEnum("status").notNull().default("planning"),
  memberCapacity: smallint("member_capacity"),
  clonedFromEditionId: uuid("cloned_from_edition_id"),
  ...standardColumns(),
});

export const campSettings = pgTable(
  "camp_settings",
  {
    id: idColumn(),
    singleton: boolean("singleton").notNull().default(true).unique(),
    name: text("name").notNull(),
    refPrefix: varchar("ref_prefix", { length: 6 }).notNull(),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    defaultCurrency: char("default_currency", { length: 3 }).notNull().default("USD"),
    currentEditionId: uuid("current_edition_id").references(() => editions.id),
    digestHourLocal: smallint("digest_hour_local").notNull().default(7),
    ...standardColumns(),
  },
  (t) => [check("camp_settings_singleton", sql`${t.singleton} = true`)],
);

export const people = pgTable(
  "people",
  {
    id: idColumn(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    legalFirstName: text("legal_first_name"),
    legalLastName: text("legal_last_name"),
    playaName: text("playa_name"),
    displayName: text("display_name").notNull(),
    /** Stored lower-cased by the app; unique among live rows. */
    email: text("email").notNull(),
    phoneE164: text("phone_e164"),
    countryCode: char("country_code", { length: 2 }),
    pronouns: text("pronouns"),
    bio: text("bio"),
    firstBurnYear: smallint("first_burn_year"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    directoryVisibility: directoryVisibilityEnum("directory_visibility")
      .notNull()
      .default("members"),
    /** Set when the row came from an import batch (stage d), so the batch can be undone. */
    importBatchId: uuid("import_batch_id"),
    ...standardColumns(),
  },
  (t) => [
    uniqueIndex("people_email_live_uq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("people_user_id_uq").on(t.userId),
    index("people_display_name_idx").on(sql`lower(${t.displayName})`),
    index("people_import_batch_idx").on(t.importBatchId),
  ],
);

export const editionMembers = pgTable(
  "edition_members",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    status: memberStatusEnum("status").notNull().default("prospect"),
    /** Read-only import from the dues sheet; the app never collects money. */
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unknown"),
    paymentStatusSyncedAt: timestamp("payment_status_synced_at", { withTimezone: true }),
    arrivalAt: timestamp("arrival_at", { withTimezone: true }),
    departureAt: timestamp("departure_at", { withTimezone: true }),
    arrivalConfirmed: boolean("arrival_confirmed").notNull().default(false),
    earlyLeaveReason: text("early_leave_reason"),
    buildCommitment: crewCommitmentEnum("build_commitment").notNull().default("none"),
    strikeCommitment: crewCommitmentEnum("strike_commitment").notNull().default("none"),
    tentChoice: tentChoiceEnum("tent_choice").notNull().default("undecided"),
    /** The accommodation option picked for this year (accommodation_options). */
    accommodationOptionId: uuid("accommodation_option_id").references(
      () => accommodationOptions.id,
      { onDelete: "set null" },
    ),
    tentMatePersonId: uuid("tent_mate_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
    /** Normal camp data (Ruchir, 11 Oct 2026); never logged. Read via member.view_dietary. */
    diet: dietEnum("diet"),
    allergies: text("allergies"),
    availabilityNote: text("availability_note"),
    importSource: text("import_source"),
    /** Burn Mode (Ruchir, Oct 28 2026): each person opts in at camp; null = off. */
    burnModeOnAt: timestamp("burn_mode_on_at", { withTimezone: true }),
    /** "Not yet" on the arrival-day Burn Mode prompt. */
    burnPromptDismissedAt: timestamp("burn_prompt_dismissed_at", { withTimezone: true }),
    ...standardColumns(),
  },
  (t) => [
    uniqueIndex("edition_members_edition_person_uq").on(t.editionId, t.personId),
    index("edition_members_edition_status_idx").on(t.editionId, t.status),
    index("edition_members_edition_arrival_idx").on(t.editionId, t.arrivalAt),
    check(
      "edition_members_departure_after_arrival",
      sql`${t.departureAt} is null or ${t.arrivalAt} is null or ${t.departureAt} >= ${t.arrivalAt}`,
    ),
  ],
);

/** Named dates templates and reminders schedule against ("build start − 14 days"). */
export const anchorDates = pgTable(
  "anchor_dates",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 40 }).notNull(),
    label: text("label").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    sourceNote: text("source_note"),
    ...standardColumns(),
  },
  (t) => [uniqueIndex("anchor_dates_edition_key_uq").on(t.editionId, t.key)],
);

/** Admin-only. A separate table so a query bug on edition_members can't leak it. */
export const memberAdminNotes = pgTable(
  "member_admin_notes",
  {
    id: idColumn(),
    editionMemberId: uuid("edition_member_id")
      .notNull()
      .references(() => editionMembers.id, { onDelete: "restrict" }),
    authorPersonId: uuid("author_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    body: text("body").notNull(),
    ...standardColumns(),
  },
  (t) => [index("member_admin_notes_member_idx").on(t.editionMemberId)],
);

export const skills = pgTable("skills", {
  id: idColumn(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  label: text("label").notNull(),
  /** Needs a lead to verify (e.g. tractor driver). */
  isQualification: boolean("is_qualification").notNull().default(false),
  ...standardColumns(),
});

export const personSkills = pgTable(
  "person_skills",
  {
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    level: smallint("level"),
    verifiedByPersonId: uuid("verified_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.personId, t.skillId] })],
);

export const availabilityWindows = pgTable(
  "availability_windows",
  {
    id: idColumn(),
    editionMemberId: uuid("edition_member_id")
      .notNull()
      .references(() => editionMembers.id, { onDelete: "cascade" }),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    kind: availabilityKindEnum("kind").notNull().default("available"),
    note: text("note"),
    ...standardColumns(),
  },
  (t) => [
    index("availability_windows_member_idx").on(t.editionMemberId, t.startsOn),
    check("availability_windows_order", sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: idColumn(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    /** sha-256 of the token; the raw token only ever appears in the email link. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedByPersonId: uuid("invited_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...standardColumns(),
  },
  (t) => [index("invites_person_idx").on(t.personId)],
);

export const roles = pgTable("roles", {
  id: idColumn(),
  key: varchar("key", { length: 40 }).notNull().unique(),
  label: text("label").notNull(),
  kind: roleKindEnum("kind").notNull(),
  description: text("description"),
  ...standardColumns(),
});

export const teams = pgTable(
  "teams",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 40 }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentTeamId: uuid("parent_team_id").references((): AnyPgColumn => teams.id, {
      onDelete: "restrict",
    }),
    whatsappInviteUrl: text("whatsapp_invite_url"),
    ...standardColumns(),
  },
  (t) => [uniqueIndex("teams_edition_key_uq").on(t.editionId, t.key)],
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: idColumn(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    role: teamRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    ...standardColumns(),
  },
  (t) => [
    uniqueIndex("team_memberships_team_person_uq").on(t.teamId, t.personId),
    index("team_memberships_person_idx").on(t.personId),
  ],
);

/** Team notices (Oct 28 2026): a lead's short message to their team, shown until ends_at. */
export const teamNotices = pgTable(
  "team_notices",
  {
    id: idColumn(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    authorPersonId: uuid("author_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    ...standardColumns(),
  },
  (t) => [index("team_notices_team_ends_idx").on(t.teamId, t.endsAt)],
);

/** Who tapped "Got it" on a team notice, and when. */
export const teamNoticeReads = pgTable(
  "team_notice_reads",
  {
    id: idColumn(),
    noticeId: uuid("notice_id")
      .notNull()
      .references(() => teamNotices.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("team_notice_reads_notice_person_uq").on(t.noticeId, t.personId)],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: idColumn(),
    /** null = permanent (e.g. admin) */
    editionId: uuid("edition_id").references(() => editions.id, { onDelete: "restrict" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    scopeTeamId: uuid("scope_team_id").references(() => teams.id, { onDelete: "restrict" }),
    grantedByPersonId: uuid("granted_by_person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...standardColumns(),
  },
  (t) => [
    uniqueIndex("role_assignments_live_uq")
      .on(
        sql`coalesce(${t.editionId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.personId,
        t.roleId,
        sql`coalesce(${t.scopeTeamId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      )
      .where(sql`${t.deletedAt} is null`),
    index("role_assignments_person_idx").on(t.personId),
  ],
);

/** What the camp offers to sleep in each year (tent type, size, how many it sleeps, price). */
export const accommodationOptions = pgTable(
  "accommodation_options",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    tentType: text("tent_type").notNull(),
    size: text("size"),
    sleeps: smallint("sleeps"),
    /** Integer cents (USD). */
    priceCents: integer("price_cents"),
    notes: text("notes"),
    ...standardColumns(),
  },
  (t) => [index("accommodation_options_edition_idx").on(t.editionId)],
);

/** Build areas per year (Cloud, Ossewa tunnel, DJ booth...), linked from items, tasks and shifts. */
export const buildAreas = pgTable(
  "build_areas",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    notes: text("notes"),
    ...standardColumns(),
  },
  (t) => [uniqueIndex("build_areas_name_uq").on(t.editionId, sql`lower(${t.name})`)],
);

/** "What to bring" ticks (Nov 2026): one row per person, edition and packing-list item ticked. */
export const packingTicks = pgTable(
  "packing_ticks",
  {
    id: idColumn(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    itemKey: varchar("item_key", { length: 60 }).notNull(),
    tickedAt: timestamp("ticked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("packing_ticks_person_item_uq").on(t.editionId, t.personId, t.itemKey)],
);
