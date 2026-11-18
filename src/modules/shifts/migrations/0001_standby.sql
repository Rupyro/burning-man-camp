CREATE TYPE "public"."shifts_standby_status" AS ENUM('waiting', 'offered', 'took', 'passed', 'left');--> statement-breakpoint
CREATE TABLE "shifts_standby" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slot_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"status" "shifts_standby_status" DEFAULT 'waiting' NOT NULL,
	"dropped_by_person_id" uuid,
	"offered_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shifts_standby" ADD CONSTRAINT "shifts_standby_slot_id_shifts_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."shifts_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_standby" ADD CONSTRAINT "shifts_standby_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts_standby" ADD CONSTRAINT "shifts_standby_dropped_by_person_id_people_id_fk" FOREIGN KEY ("dropped_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_standby_live_uq" ON "shifts_standby" USING btree ("slot_id","person_id") WHERE "shifts_standby"."status" in ('waiting', 'offered');--> statement-breakpoint
CREATE INDEX "shifts_standby_slot_idx" ON "shifts_standby" USING btree ("slot_id","created_at");