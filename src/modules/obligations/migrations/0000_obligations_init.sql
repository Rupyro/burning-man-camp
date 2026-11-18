CREATE TYPE "public"."obligation_authority" AS ENUM('afrikaburn', 'dmv', 'fuel_team', 'sound_team', 'supplier_depot', 'quicket', 'internal');--> statement-breakpoint
CREATE TYPE "public"."obligation_category" AS ENUM('registration', 'wap', 'mutant_vehicle', 'sound', 'lnt', 'fire_safety', 'gas_fuel', 'water_ice', 'food_safety', 'supplier', 'tickets', 'exit_signoff', 'other');--> statement-breakpoint
CREATE TABLE "obligation_details" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"key" varchar(60) NOT NULL,
	"authority" "obligation_authority" NOT NULL,
	"category" "obligation_category" NOT NULL,
	"source_url" text,
	"source_doc_slug" text,
	"date_confirmed" boolean DEFAULT false NOT NULL,
	"previous_year_date" date,
	"required_documents" text[] DEFAULT '{}' NOT NULL,
	"submitted_at" timestamp with time zone,
	"confirmation_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obligation_details" ADD CONSTRAINT "obligation_details_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_details" ADD CONSTRAINT "obligation_details_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "obligation_details_edition_key_uq" ON "obligation_details" USING btree ("edition_id","key");--> statement-breakpoint
CREATE INDEX "obligation_details_category_idx" ON "obligation_details" USING btree ("edition_id","category");