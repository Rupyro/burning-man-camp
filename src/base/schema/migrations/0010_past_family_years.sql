CREATE TABLE "past_family_years" (
	"id" uuid PRIMARY KEY NOT NULL,
	"person_id" uuid,
	"email" text,
	"display_name" text,
	"year" smallint NOT NULL,
	"notes" text,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "past_family_years_year_ck" CHECK ("past_family_years"."year" >= 2023)
);
--> statement-breakpoint
ALTER TABLE "past_family_years" ADD CONSTRAINT "past_family_years_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "past_family_years_email_year_uq" ON "past_family_years" USING btree (lower("email"),"year");--> statement-breakpoint
CREATE INDEX "past_family_years_person_idx" ON "past_family_years" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "past_family_years_batch_idx" ON "past_family_years" USING btree ("import_batch_id");