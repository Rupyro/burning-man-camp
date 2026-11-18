CREATE TABLE "accommodation_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"tent_type" text NOT NULL,
	"size" text,
	"sleeps" smallint,
	"price_cents" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_areas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "accommodation_option_id" uuid;--> statement-breakpoint
ALTER TABLE "edition_members" ADD COLUMN "tent_mate_person_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "build_area_id" uuid;--> statement-breakpoint
ALTER TABLE "past_family_years" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "accommodation_options" ADD CONSTRAINT "accommodation_options_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_areas" ADD CONSTRAINT "build_areas_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accommodation_options_edition_idx" ON "accommodation_options" USING btree ("edition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "build_areas_name_uq" ON "build_areas" USING btree ("edition_id",lower("name"));--> statement-breakpoint
ALTER TABLE "edition_members" ADD CONSTRAINT "edition_members_accommodation_option_id_accommodation_options_id_fk" FOREIGN KEY ("accommodation_option_id") REFERENCES "public"."accommodation_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_members" ADD CONSTRAINT "edition_members_tent_mate_person_id_people_id_fk" FOREIGN KEY ("tent_mate_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_build_area_id_build_areas_id_fk" FOREIGN KEY ("build_area_id") REFERENCES "public"."build_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Officer and lead roles are per year: refuse an assignment without an edition (Nov 2 review).
CREATE OR REPLACE FUNCTION role_assignments_year_required() RETURNS trigger AS $$
BEGIN
  IF NEW.edition_id IS NULL AND EXISTS (
    SELECT 1 FROM roles r WHERE r.id = NEW.role_id AND (r.kind = 'officer' OR r.key LIKE '%lead%')
  ) THEN
    RAISE EXCEPTION 'Officer and lead roles need a year (edition)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER role_assignments_year_required BEFORE INSERT OR UPDATE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION role_assignments_year_required();
