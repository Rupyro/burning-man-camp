CREATE TYPE "public"."village_direction" AS ENUM('lend', 'borrow');--> statement-breakpoint
CREATE TYPE "public"."village_resource" AS ENUM('water', 'power', 'tools', 'transport', 'shade', 'other');--> statement-breakpoint
CREATE TABLE "village_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"partner" varchar(80) NOT NULL,
	"direction" "village_direction" NOT NULL,
	"resource" "village_resource" DEFAULT 'other' NOT NULL,
	"item" varchar(120) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" varchar(300) DEFAULT '' NOT NULL,
	"returned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "village_shares" ADD CONSTRAINT "village_shares_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "village_shares_edition_idx" ON "village_shares" USING btree ("edition_id","partner");