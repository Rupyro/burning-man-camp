CREATE TYPE "public"."procurement_item_category" AS ENUM('tool', 'kitchen_equipment', 'building_material', 'electrical', 'plumbing', 'safety', 'decor', 'consumable', 'food', 'camping', 'sound_lighting', 'other');--> statement-breakpoint
CREATE TYPE "public"."procurement_condition" AS ENUM('good', 'needs_repair', 'broken', 'missing');--> statement-breakpoint
CREATE TYPE "public"."procurement_location_kind" AS ENUM('container', 'storage', 'site_area', 'person');--> statement-breakpoint
CREATE TYPE "public"."procurement_move_reason" AS ENUM('count', 'purchase', 'load', 'consumed', 'broken', 'returned');--> statement-breakpoint
CREATE TYPE "public"."procurement_need_source" AS ENUM('manual', 'template');--> statement-breakpoint
CREATE TYPE "public"."procurement_need_status" AS ENUM('needed', 'have_it', 'to_buy', 'to_borrow', 'purchase_requested', 'ordered', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."procurement_owner_label" AS ENUM('oeaasies', 'khoena', 'shared', 'borrowed', 'rented');--> statement-breakpoint
CREATE TABLE "procurement_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "procurement_item_category" DEFAULT 'other' NOT NULL,
	"unit" varchar(16) DEFAULT 'pcs' NOT NULL,
	"is_asset" boolean DEFAULT true NOT NULL,
	"owner_label" "procurement_owner_label" DEFAULT 'oeaasies' NOT NULL,
	"is_bottleneck" boolean DEFAULT false NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "procurement_location_kind" DEFAULT 'container' NOT NULL,
	"description" text,
	"keys_held_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_needs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_needed" numeric(10, 2) NOT NULL,
	"quantity_on_hand_snapshot" numeric(10, 2),
	"status" "procurement_need_status" DEFAULT 'needed' NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"source" "procurement_need_source" DEFAULT 'manual' NOT NULL,
	"supplier_id" uuid,
	"needed_by" date,
	"owner_person_id" uuid,
	"raised_by_person_id" uuid,
	"estimate_cents" bigint,
	"spend_request_ref_id" uuid,
	"task_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "procurement_needs_qty_ck" CHECK ("procurement_needs"."quantity_needed" > 0),
	CONSTRAINT "procurement_needs_estimate_ck" CHECK ("procurement_needs"."estimate_cents" is null or "procurement_needs"."estimate_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "procurement_stock" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"condition" "procurement_condition" DEFAULT 'good' NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"counted_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "procurement_stock_qty_ck" CHECK ("procurement_stock"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement_stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"condition" "procurement_condition" NOT NULL,
	"delta" numeric(10, 2) NOT NULL,
	"reason" "procurement_move_reason" NOT NULL,
	"note" text,
	"actor_person_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"contact_name" text,
	"contact_phone" varchar(32),
	"email" text,
	"website" text,
	"notes" text,
	"last_used_year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "procurement_locations" ADD CONSTRAINT "procurement_locations_keys_held_by_person_id_people_id_fk" FOREIGN KEY ("keys_held_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_item_id_procurement_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."procurement_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_supplier_id_procurement_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."procurement_suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_raised_by_person_id_people_id_fk" FOREIGN KEY ("raised_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_needs" ADD CONSTRAINT "procurement_needs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock" ADD CONSTRAINT "procurement_stock_item_id_procurement_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."procurement_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock" ADD CONSTRAINT "procurement_stock_location_id_procurement_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."procurement_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock" ADD CONSTRAINT "procurement_stock_counted_by_person_id_people_id_fk" FOREIGN KEY ("counted_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock_movements" ADD CONSTRAINT "procurement_stock_movements_item_id_procurement_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."procurement_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock_movements" ADD CONSTRAINT "procurement_stock_movements_from_location_id_procurement_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."procurement_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock_movements" ADD CONSTRAINT "procurement_stock_movements_to_location_id_procurement_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."procurement_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_stock_movements" ADD CONSTRAINT "procurement_stock_movements_actor_person_id_people_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_items_name_uq" ON "procurement_items" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "procurement_items_category_ix" ON "procurement_items" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_locations_name_uq" ON "procurement_locations" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "procurement_needs_status_ix" ON "procurement_needs" USING btree ("edition_id","status");--> statement-breakpoint
CREATE INDEX "procurement_needs_item_ix" ON "procurement_needs" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_stock_uq" ON "procurement_stock" USING btree ("item_id","location_id","condition");--> statement-breakpoint
CREATE INDEX "procurement_moves_item_ix" ON "procurement_stock_movements" USING btree ("item_id","at");