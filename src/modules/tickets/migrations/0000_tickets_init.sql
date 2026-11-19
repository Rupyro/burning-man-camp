CREATE TYPE "public"."tickets_early_state" AS ENUM('no', 'requested', 'have');--> statement-breakpoint
CREATE TYPE "public"."tickets_pass_state" AS ENUM('not_needed', 'need', 'have');--> statement-breakpoint
CREATE TYPE "public"."tickets_ticket_state" AS ENUM('none', 'looking', 'stewards_offered', 'have');--> statement-breakpoint
CREATE TABLE "tickets_allocations" (
	"edition_id" uuid PRIMARY KEY NOT NULL,
	"stewards" integer DEFAULT 0 NOT NULL,
	"vehicle_passes" integer DEFAULT 0 NOT NULL,
	"early_passes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets_status" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"ticket" "tickets_ticket_state" DEFAULT 'none' NOT NULL,
	"vehicle_pass" "tickets_pass_state" DEFAULT 'not_needed' NOT NULL,
	"early_arrival" "tickets_early_state" DEFAULT 'no' NOT NULL,
	"note" varchar(200),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets_allocations" ADD CONSTRAINT "tickets_allocations_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets_status" ADD CONSTRAINT "tickets_status_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets_status" ADD CONSTRAINT "tickets_status_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_status_uq" ON "tickets_status" USING btree ("edition_id","person_id");