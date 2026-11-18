CREATE TYPE "public"."logistics_load_direction" AS ENUM('outbound', 'return', 'internal');--> statement-breakpoint
CREATE TYPE "public"."logistics_load_status" AS ENUM('planned', 'packing', 'in_transit', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."logistics_match_status" AS ENUM('proposed', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."logistics_place_kind" AS ENUM('storage', 'container_yard', 'site', 'pickup', 'airport', 'city_area', 'supplier');--> statement-breakpoint
CREATE TYPE "public"."logistics_time_of_day" AS ENUM('morning', 'afternoon', 'evening', 'flexible');--> statement-breakpoint
CREATE TYPE "public"."logistics_travel_direction" AS ENUM('to_burn', 'from_burn');--> statement-breakpoint
CREATE TYPE "public"."logistics_travel_mode" AS ENUM('offering_ride', 'need_ride', 'own_arrangement');--> statement-breakpoint
CREATE TYPE "public"."logistics_vehicle_kind" AS ENUM('car', 'bakkie', 'truck', 'trailer', 'container_truck', 'mutant_vehicle');--> statement-breakpoint
CREATE TABLE "logistics_load_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"load_id" uuid,
	"source_ref_type" varchar(40),
	"source_ref_id" uuid,
	"source_event_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
	"unit" varchar(16) DEFAULT 'pcs' NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"needed_by" date,
	"packed_at" timestamp with time zone,
	"packed_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "logistics_load_items_qty_ck" CHECK ("logistics_load_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "logistics_loads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"direction" "logistics_load_direction" DEFAULT 'outbound' NOT NULL,
	"vehicle_id" uuid,
	"origin_place_id" uuid,
	"destination_place_id" uuid,
	"departs_at" timestamp with time zone,
	"status" "logistics_load_status" DEFAULT 'planned' NOT NULL,
	"delivered_confirmed_at" timestamp with time zone,
	"delivered_confirmed_by_person_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_places" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "logistics_place_kind" DEFAULT 'pickup' NOT NULL,
	"address_text" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_ride_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_plan_id" uuid NOT NULL,
	"passenger_plan_id" uuid NOT NULL,
	"seats" smallint DEFAULT 1 NOT NULL,
	"status" "logistics_match_status" DEFAULT 'proposed' NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "logistics_ride_seats_ck" CHECK ("logistics_ride_matches"."seats" between 1 and 10),
	CONSTRAINT "logistics_ride_not_self_ck" CHECK ("logistics_ride_matches"."driver_plan_id" <> "logistics_ride_matches"."passenger_plan_id")
);
--> statement-breakpoint
CREATE TABLE "logistics_travel_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"direction" "logistics_travel_direction" NOT NULL,
	"mode" "logistics_travel_mode" NOT NULL,
	"area_place_id" uuid,
	"area_detail" text,
	"travel_date" date,
	"time_of_day" "logistics_time_of_day" DEFAULT 'flexible' NOT NULL,
	"seats_offered" smallint,
	"seats_needed" smallint,
	"carries_cargo" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "logistics_travel_seats_ck" CHECK (("logistics_travel_plans"."seats_offered" is null or "logistics_travel_plans"."seats_offered" between 1 and 20) and ("logistics_travel_plans"."seats_needed" is null or "logistics_travel_plans"."seats_needed" between 1 and 10))
);
--> statement-breakpoint
CREATE TABLE "logistics_vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"edition_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" "logistics_vehicle_kind" DEFAULT 'bakkie' NOT NULL,
	"driver_person_id" uuid,
	"seats" smallint,
	"cargo_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "logistics_load_items" ADD CONSTRAINT "logistics_load_items_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_load_items" ADD CONSTRAINT "logistics_load_items_load_id_logistics_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."logistics_loads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_load_items" ADD CONSTRAINT "logistics_load_items_packed_by_person_id_people_id_fk" FOREIGN KEY ("packed_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_loads" ADD CONSTRAINT "logistics_loads_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_loads" ADD CONSTRAINT "logistics_loads_vehicle_id_logistics_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."logistics_vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_loads" ADD CONSTRAINT "logistics_loads_origin_place_id_logistics_places_id_fk" FOREIGN KEY ("origin_place_id") REFERENCES "public"."logistics_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_loads" ADD CONSTRAINT "logistics_loads_destination_place_id_logistics_places_id_fk" FOREIGN KEY ("destination_place_id") REFERENCES "public"."logistics_places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_loads" ADD CONSTRAINT "logistics_loads_delivered_confirmed_by_person_id_people_id_fk" FOREIGN KEY ("delivered_confirmed_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_ride_matches" ADD CONSTRAINT "logistics_ride_matches_driver_plan_id_logistics_travel_plans_id_fk" FOREIGN KEY ("driver_plan_id") REFERENCES "public"."logistics_travel_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_ride_matches" ADD CONSTRAINT "logistics_ride_matches_passenger_plan_id_logistics_travel_plans_id_fk" FOREIGN KEY ("passenger_plan_id") REFERENCES "public"."logistics_travel_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_travel_plans" ADD CONSTRAINT "logistics_travel_plans_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_travel_plans" ADD CONSTRAINT "logistics_travel_plans_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_travel_plans" ADD CONSTRAINT "logistics_travel_plans_area_place_id_logistics_places_id_fk" FOREIGN KEY ("area_place_id") REFERENCES "public"."logistics_places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."editions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ADD CONSTRAINT "logistics_vehicles_driver_person_id_people_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "logistics_load_items_load_ix" ON "logistics_load_items" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "logistics_load_items_critical_ix" ON "logistics_load_items" USING btree ("edition_id") WHERE "logistics_load_items"."is_critical";--> statement-breakpoint
CREATE UNIQUE INDEX "logistics_load_items_event_uq" ON "logistics_load_items" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "logistics_loads_edition_ix" ON "logistics_loads" USING btree ("edition_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "logistics_places_name_uq" ON "logistics_places" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "logistics_ride_matches_uq" ON "logistics_ride_matches" USING btree ("driver_plan_id","passenger_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "logistics_travel_plans_uq" ON "logistics_travel_plans" USING btree ("edition_id","person_id","direction");