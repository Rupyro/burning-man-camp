CREATE TYPE "public"."schedule_category" AS ENUM('class', 'food', 'party', 'ritual', 'care', 'other');--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"category" "schedule_category" DEFAULT 'class' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" varchar(120) DEFAULT 'At camp' NOT NULL,
	"host_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_host_person_id_people_id_fk" FOREIGN KEY ("host_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_events_edition_idx" ON "schedule_events" USING btree ("edition_id","starts_at");