CREATE TYPE "public"."applicant_status" AS ENUM('draft', 'applied', 'interview_scheduled', 'accepted', 'joined', 'declined');--> statement-breakpoint
CREATE TABLE "applicant_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "applicant_status" DEFAULT 'draft' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"interview_at" timestamp with time zone,
	"interview_done_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decided_by_person_id" uuid,
	"fee_cents" bigint,
	"fee_currency" char(3),
	"fee_ref_type" varchar(40),
	"fee_ref_id" uuid,
	"paid_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"lead_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applicant_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"application_id" uuid NOT NULL,
	"doc_key" varchar(40) NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant_applications" ADD CONSTRAINT "applicant_applications_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_applications" ADD CONSTRAINT "applicant_applications_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_applications" ADD CONSTRAINT "applicant_applications_decided_by_person_id_people_id_fk" FOREIGN KEY ("decided_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_documents" ADD CONSTRAINT "applicant_documents_application_id_applicant_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applicant_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_applications_person_uq" ON "applicant_applications" USING btree ("edition_id","person_id");--> statement-breakpoint
CREATE INDEX "applicant_applications_status_idx" ON "applicant_applications" USING btree ("edition_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_documents_uq" ON "applicant_documents" USING btree ("application_id","doc_key");