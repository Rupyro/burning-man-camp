ALTER TYPE "public"."procurement_need_status" ADD VALUE 'built';--> statement-breakpoint
ALTER TYPE "public"."procurement_need_status" ADD VALUE 'not_needed';--> statement-breakpoint
CREATE TABLE "procurement_item_teams" (
	"item_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_item_teams_item_id_team_id_pk" PRIMARY KEY("item_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "procurement_items" ADD COLUMN "build_area_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_locations" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_stock" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "procurement_item_teams" ADD CONSTRAINT "procurement_item_teams_item_id_procurement_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."procurement_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_item_teams" ADD CONSTRAINT "procurement_item_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "procurement_item_teams_team_ix" ON "procurement_item_teams" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_build_area_id_build_areas_id_fk" FOREIGN KEY ("build_area_id") REFERENCES "public"."build_areas"("id") ON DELETE set null ON UPDATE no action;