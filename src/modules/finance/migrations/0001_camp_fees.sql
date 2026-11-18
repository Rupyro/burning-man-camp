CREATE TYPE "public"."finance_fee_status" AS ENUM('due', 'paid', 'waived');--> statement-breakpoint
CREATE TABLE "finance_camp_fees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'ZAR' NOT NULL,
	"status" "finance_fee_status" DEFAULT 'due' NOT NULL,
	"source_ref_type" varchar(40) NOT NULL,
	"source_ref_id" uuid NOT NULL,
	"paid_at" timestamp with time zone,
	"recorded_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "finance_camp_fees_amount_ck" CHECK ("finance_camp_fees"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance_camp_fees" ADD CONSTRAINT "finance_camp_fees_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_camp_fees" ADD CONSTRAINT "finance_camp_fees_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_camp_fees" ADD CONSTRAINT "finance_camp_fees_recorded_by_person_id_people_id_fk" FOREIGN KEY ("recorded_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_camp_fees_source_uq" ON "finance_camp_fees" USING btree ("source_ref_type","source_ref_id");--> statement-breakpoint
CREATE INDEX "finance_camp_fees_edition_idx" ON "finance_camp_fees" USING btree ("edition_id","status");