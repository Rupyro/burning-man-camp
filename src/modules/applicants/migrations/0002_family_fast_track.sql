CREATE TYPE "public"."applicant_family_decision" AS ENUM('waiting', 'approved', 'asked', 'declined');--> statement-breakpoint
CREATE TABLE "applicant_family_answers" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"teams" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"led" boolean DEFAULT false NOT NULL,
	"led_what" text,
	"build_pieces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"good_at" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"love_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"anything_else" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_family_approvals" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"decision" "applicant_family_decision" DEFAULT 'waiting' NOT NULL,
	"decided_by_person_id" uuid,
	"decided_at" timestamp with time zone,
	"note" text,
	"suggested_role_shown" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_family_years" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"lead_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant_family_answers" ADD CONSTRAINT "applicant_family_answers_application_id_applicant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applicant_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_family_approvals" ADD CONSTRAINT "applicant_family_approvals_application_id_applicant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applicant_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_family_approvals" ADD CONSTRAINT "applicant_family_approvals_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_family_years" ADD CONSTRAINT "applicant_family_years_application_id_applicant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applicant_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_family_years_uq" ON "applicant_family_years" USING btree ("application_id","year");