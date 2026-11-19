CREATE TABLE "sound_neighbor_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"neighbor" varchar(80) NOT NULL,
	"what" varchar(500) NOT NULL,
	"action" varchar(500),
	"logged_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_plans" (
	"edition_id" uuid PRIMARY KEY NOT NULL,
	"quiet_from" varchar(5) DEFAULT '03:00' NOT NULL,
	"quiet_until" varchar(5) DEFAULT '10:00' NOT NULL,
	"max_db" integer DEFAULT 100 NOT NULL,
	"speakers_face" varchar(120),
	"notes" varchar(1000),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sound_neighbor_log" ADD CONSTRAINT "sound_neighbor_log_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_neighbor_log" ADD CONSTRAINT "sound_neighbor_log_logged_by_person_id_people_id_fk" FOREIGN KEY ("logged_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_plans" ADD CONSTRAINT "sound_plans_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sound_neighbor_log_edition_idx" ON "sound_neighbor_log" USING btree ("edition_id","at");