CREATE TYPE "public"."registers_kind" AS ENUM('fuel', 'flame', 'burn', 'stake');--> statement-breakpoint
CREATE TABLE "registers_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"kind" "registers_kind" NOT NULL,
	"label" varchar(120) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"pulled" integer DEFAULT 0 NOT NULL,
	"location" varchar(120) DEFAULT '' NOT NULL,
	"notes" varchar(500) DEFAULT '' NOT NULL,
	"owner_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registers_items" ADD CONSTRAINT "registers_items_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registers_items" ADD CONSTRAINT "registers_items_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registers_items_edition_idx" ON "registers_items" USING btree ("edition_id","kind");