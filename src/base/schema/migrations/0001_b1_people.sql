CREATE TYPE "public"."availability_kind" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."crew_commitment" AS ENUM('none', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."member_diet" AS ENUM('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status_import" AS ENUM('unknown', 'deposit_paid', 'paid_in_full', 'waived', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."tent_choice" AS ENUM('camp_dome', 'large_bell', 'byo_tent', 'caravan_or_car', 'undecided');--> statement-breakpoint
CREATE TABLE "anchor_dates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"key" varchar(40) NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"source_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_member_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"kind" "availability_kind" DEFAULT 'available' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "availability_windows_order" CHECK ("availability_windows"."ends_on" >= "availability_windows"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "member_admin_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_member_id" uuid NOT NULL,
	"author_person_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_skills" (
	"person_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" smallint,
	"verified_by_person_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_skills_person_id_skill_id_pk" PRIMARY KEY("person_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(40) NOT NULL,
	"label" text NOT NULL,
	"is_qualification" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "skills_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "payment_status" "payment_status_import" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "payment_status_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "arrival_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "departure_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "arrival_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "early_leave_reason" text;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "build_commitment" "crew_commitment" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "strike_commitment" "crew_commitment" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "tent_choice" "tent_choice" DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "diet" "member_diet";--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "allergies" text;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "availability_note" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "pronouns" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "first_burn_year" smallint;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
ALTER TABLE "anchor_dates" ADD CONSTRAINT "anchor_dates_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_edition_member_id_edition_members_id_fk" FOREIGN KEY ("edition_member_id") REFERENCES "public"."edition_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_admin_notes" ADD CONSTRAINT "member_admin_notes_edition_member_id_edition_members_id_fk" FOREIGN KEY ("edition_member_id") REFERENCES "public"."edition_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_admin_notes" ADD CONSTRAINT "member_admin_notes_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_skills" ADD CONSTRAINT "person_skills_verified_by_person_id_people_id_fk" FOREIGN KEY ("verified_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anchor_dates_edition_key_uq" ON "anchor_dates" USING btree ("edition_id","key");--> statement-breakpoint
CREATE INDEX "availability_windows_member_idx" ON "availability_windows" USING btree ("edition_member_id","starts_on");--> statement-breakpoint
CREATE INDEX "member_admin_notes_member_idx" ON "member_admin_notes" USING btree ("edition_member_id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_id_teams_id_fk" FOREIGN KEY ("parent_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edition_members_edition_arrival_idx" ON "edition_members" USING btree ("edition_id","arrival_at");--> statement-breakpoint
ALTER TABLE "edition_members" ADD CONSTRAINT "edition_members_departure_after_arrival" CHECK ("edition_members"."departure_at" is null or "edition_members"."arrival_at" is null or "edition_members"."departure_at" >= "edition_members"."arrival_at");