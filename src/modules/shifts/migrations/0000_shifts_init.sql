CREATE TYPE "public"."shifts_category" AS ENUM('kitchen', 'moop', 'mutant_vehicle', 'infrastructure', 'hosting', 'build', 'strike', 'other');--> statement-breakpoint
CREATE TYPE "public"."shifts_checklist_section" AS ENUM('before', 'setup', 'during', 'cleanup', 'resources', 'final');--> statement-breakpoint
CREATE TYPE "public"."shifts_cover_kind" AS ENUM('swap', 'give_away', 'ask_cover');--> statement-breakpoint
CREATE TYPE "public"."shifts_cover_reason" AS ENUM('clash', 'unwell', 'overwhelmed');--> statement-breakpoint
CREATE TYPE "public"."shifts_cover_status" AS ENUM('requested', 'accepted', 'lead_pending', 'confirmed', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."shifts_handover_item_kind" AS ENUM('needs_attention', 'missing');--> statement-breakpoint
CREATE TYPE "public"."shifts_handover_outcome" AS ENUM('all_good', 'needs_attention', 'missing');--> statement-breakpoint
CREATE TYPE "public"."shifts_phase" AS ENUM('build', 'burn', 'strike');--> statement-breakpoint
CREATE TYPE "public"."shifts_precredit_kind" AS ENUM('design', 'sourcing', 'logistics', 'building', 'organising');--> statement-breakpoint
CREATE TYPE "public"."shifts_signup_source" AS ENUM('claimed', 'lead_added_with_consent', 'swap', 'help_sheet');--> statement-breakpoint
CREATE TYPE "public"."shifts_signup_status" AS ENUM('claimed', 'confirmed', 'completed', 'no_show', 'released', 'swapped_out');--> statement-breakpoint
CREATE TYPE "public"."shifts_slot_status" AS ENUM('open', 'filled', 'cancelled', 'closed_out');--> statement-breakpoint
CREATE TABLE "shifts_checklist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"duty_type_id" uuid NOT NULL,
	"section" "shifts_checklist_section" NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts_checklist_ticks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slot_id" uuid NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"ticked_by_person_id" uuid NOT NULL,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts_cover_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_signup_id" uuid NOT NULL,
	"to_person_id" uuid,
	"kind" "shifts_cover_kind" NOT NULL,
	"reason" "shifts_cover_reason" NOT NULL,
	"status" "shifts_cover_status" DEFAULT 'requested' NOT NULL,
	"accepted_by_person_id" uuid,
	"lead_decided_by_person_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_cover_requests_swap_named_ck" CHECK ("shifts_cover_requests"."kind" <> 'swap' or ("shifts_cover_requests"."to_person_id" is not null and ("shifts_cover_requests"."accepted_by_person_id" is null or "shifts_cover_requests"."accepted_by_person_id" = "shifts_cover_requests"."to_person_id"))),
	CONSTRAINT "shifts_cover_requests_accepted_ck" CHECK ("shifts_cover_requests"."status" not in ('accepted', 'lead_pending', 'confirmed') or "shifts_cover_requests"."kind" = 'ask_cover' or "shifts_cover_requests"."accepted_by_person_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "shifts_duty_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"key" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"category" "shifts_category" NOT NULL,
	"phase" "shifts_phase" DEFAULT 'burn' NOT NULL,
	"description" text,
	"is_specialist" boolean DEFAULT false NOT NULL,
	"required_skill_id" uuid,
	"lead_person_id" uuid,
	"backup_person_id" uuid,
	"needs_handover" boolean DEFAULT false NOT NULL,
	"min_staff" smallint DEFAULT 1 NOT NULL,
	"max_staff" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_duty_types_staff_ck" CHECK ("shifts_duty_types"."min_staff" >= 1 and "shifts_duty_types"."max_staff" >= "shifts_duty_types"."min_staff" and "shifts_duty_types"."max_staff" <= 50),
	CONSTRAINT "shifts_duty_types_backup_ck" CHECK ("shifts_duty_types"."backup_person_id" is null or "shifts_duty_types"."backup_person_id" is distinct from "shifts_duty_types"."lead_person_id")
);
--> statement-breakpoint
CREATE TABLE "shifts_handover_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handover_id" uuid NOT NULL,
	"checklist_item_id" uuid,
	"kind" "shifts_handover_item_kind" NOT NULL,
	"note" varchar(280),
	CONSTRAINT "shifts_handover_items_what_ck" CHECK ("shifts_handover_items"."checklist_item_id" is not null or "shifts_handover_items"."note" is not null)
);
--> statement-breakpoint
CREATE TABLE "shifts_handovers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slot_id" uuid NOT NULL,
	"by_person_id" uuid NOT NULL,
	"outcome" "shifts_handover_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_handovers_slot_id_unique" UNIQUE("slot_id")
);
--> statement-breakpoint
CREATE TABLE "shifts_precredits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "shifts_precredit_kind" NOT NULL,
	"hours" smallint NOT NULL,
	"granted_by_person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_precredits_hours_ck" CHECK ("shifts_precredits"."hours" between 1 and 200),
	CONSTRAINT "shifts_precredits_not_self_ck" CHECK ("shifts_precredits"."granted_by_person_id" <> "shifts_precredits"."person_id")
);
--> statement-breakpoint
CREATE TABLE "shifts_settings" (
	"edition_id" uuid PRIMARY KEY NOT NULL,
	"freeze_at" timestamp with time zone NOT NULL,
	"min_duty_hours" smallint DEFAULT 8 NOT NULL,
	"min_build_strike_days" smallint DEFAULT 4 NOT NULL,
	"max_precredit_percent" smallint DEFAULT 50 NOT NULL,
	"silent_no_show_flag_at" smallint DEFAULT 2 NOT NULL,
	"updated_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_settings_ranges_ck" CHECK ("shifts_settings"."min_duty_hours" between 0 and 200 and "shifts_settings"."min_build_strike_days" between 0 and 60 and "shifts_settings"."max_precredit_percent" between 0 and 100 and "shifts_settings"."silent_no_show_flag_at" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "shifts_signups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slot_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"source" "shifts_signup_source" DEFAULT 'claimed' NOT NULL,
	"status" "shifts_signup_status" DEFAULT 'claimed' NOT NULL,
	"marked_by_person_id" uuid,
	"marked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_signups_marked_ck" CHECK (("shifts_signups"."status" in ('completed', 'no_show')) = ("shifts_signups"."marked_by_person_id" is not null and "shifts_signups"."marked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "shifts_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"duty_type_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"min_staff" smallint,
	"max_staff" smallint,
	"status" "shifts_slot_status" DEFAULT 'open' NOT NULL,
	"unfilled_at_close_out" smallint,
	"closed_out_by_person_id" uuid,
	"closed_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "shifts_slots_time_ck" CHECK ("shifts_slots"."ends_at" > "shifts_slots"."starts_at"),
	CONSTRAINT "shifts_slots_staff_ck" CHECK (coalesce("shifts_slots"."min_staff", 1) >= 1 and coalesce("shifts_slots"."max_staff", 50) >= coalesce("shifts_slots"."min_staff", 1) and coalesce("shifts_slots"."max_staff", 1) <= 50),
	CONSTRAINT "shifts_slots_closed_ck" CHECK (("shifts_slots"."status" = 'closed_out') = ("shifts_slots"."closed_out_at" is not null and "shifts_slots"."closed_out_by_person_id" is not null and "shifts_slots"."unfilled_at_close_out" is not null))
);
--> statement-breakpoint
ALTER TABLE "shifts_checklist_items" ADD CONSTRAINT "shifts_checklist_items_duty_type_id_shifts_duty_types_id_fk" FOREIGN KEY ("duty_type_id") REFERENCES "public"."shifts_duty_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_checklist_ticks" ADD CONSTRAINT "shifts_checklist_ticks_slot_id_shifts_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."shifts_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_checklist_ticks" ADD CONSTRAINT "shifts_checklist_ticks_checklist_item_id_shifts_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."shifts_checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_checklist_ticks" ADD CONSTRAINT "shifts_checklist_ticks_ticked_by_person_id_people_id_fk" FOREIGN KEY ("ticked_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_cover_requests" ADD CONSTRAINT "shifts_cover_requests_from_signup_id_shifts_signups_id_fk" FOREIGN KEY ("from_signup_id") REFERENCES "public"."shifts_signups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_cover_requests" ADD CONSTRAINT "shifts_cover_requests_to_person_id_people_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_cover_requests" ADD CONSTRAINT "shifts_cover_requests_accepted_by_person_id_people_id_fk" FOREIGN KEY ("accepted_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_cover_requests" ADD CONSTRAINT "shifts_cover_requests_lead_decided_by_person_id_people_id_fk" FOREIGN KEY ("lead_decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_duty_types" ADD CONSTRAINT "shifts_duty_types_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_duty_types" ADD CONSTRAINT "shifts_duty_types_required_skill_id_skills_id_fk" FOREIGN KEY ("required_skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_duty_types" ADD CONSTRAINT "shifts_duty_types_lead_person_id_people_id_fk" FOREIGN KEY ("lead_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_duty_types" ADD CONSTRAINT "shifts_duty_types_backup_person_id_people_id_fk" FOREIGN KEY ("backup_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_handover_items" ADD CONSTRAINT "shifts_handover_items_handover_id_shifts_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."shifts_handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_handover_items" ADD CONSTRAINT "shifts_handover_items_checklist_item_id_shifts_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."shifts_checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_handovers" ADD CONSTRAINT "shifts_handovers_slot_id_shifts_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."shifts_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_handovers" ADD CONSTRAINT "shifts_handovers_by_person_id_people_id_fk" FOREIGN KEY ("by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_precredits" ADD CONSTRAINT "shifts_precredits_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_precredits" ADD CONSTRAINT "shifts_precredits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_precredits" ADD CONSTRAINT "shifts_precredits_granted_by_person_id_people_id_fk" FOREIGN KEY ("granted_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_settings" ADD CONSTRAINT "shifts_settings_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_settings" ADD CONSTRAINT "shifts_settings_updated_by_person_id_people_id_fk" FOREIGN KEY ("updated_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_signups" ADD CONSTRAINT "shifts_signups_slot_id_shifts_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."shifts_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_signups" ADD CONSTRAINT "shifts_signups_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_signups" ADD CONSTRAINT "shifts_signups_marked_by_person_id_people_id_fk" FOREIGN KEY ("marked_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_slots" ADD CONSTRAINT "shifts_slots_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_slots" ADD CONSTRAINT "shifts_slots_duty_type_id_shifts_duty_types_id_fk" FOREIGN KEY ("duty_type_id") REFERENCES "public"."shifts_duty_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_slots" ADD CONSTRAINT "shifts_slots_closed_out_by_person_id_people_id_fk" FOREIGN KEY ("closed_out_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_checklist_items_pos_uq" ON "shifts_checklist_items" USING btree ("duty_type_id","section","position");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_checklist_ticks_uq" ON "shifts_checklist_ticks" USING btree ("slot_id","checklist_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_cover_requests_open_uq" ON "shifts_cover_requests" USING btree ("from_signup_id") WHERE "shifts_cover_requests"."status" in ('requested', 'accepted', 'lead_pending');--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_duty_types_key_uq" ON "shifts_duty_types" USING btree ("edition_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_precredits_uq" ON "shifts_precredits" USING btree ("edition_id","person_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_signups_live_uq" ON "shifts_signups" USING btree ("slot_id","person_id") WHERE "shifts_signups"."status" not in ('released', 'swapped_out');--> statement-breakpoint
CREATE INDEX "shifts_signups_person_idx" ON "shifts_signups" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_slots_uq" ON "shifts_slots" USING btree ("duty_type_id","starts_at");--> statement-breakpoint
CREATE INDEX "shifts_slots_edition_start_idx" ON "shifts_slots" USING btree ("edition_id","starts_at");