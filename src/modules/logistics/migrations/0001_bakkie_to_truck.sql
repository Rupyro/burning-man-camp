ALTER TABLE "logistics_vehicles" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
UPDATE "logistics_vehicles" SET "kind" = 'truck' WHERE "kind" = 'bakkie';--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ALTER COLUMN "kind" SET DEFAULT 'truck'::text;--> statement-breakpoint
DROP TYPE "public"."logistics_vehicle_kind";--> statement-breakpoint
CREATE TYPE "public"."logistics_vehicle_kind" AS ENUM('car', 'truck', 'trailer', 'container_truck', 'mutant_vehicle');--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ALTER COLUMN "kind" SET DEFAULT 'truck'::"public"."logistics_vehicle_kind";--> statement-breakpoint
ALTER TABLE "logistics_vehicles" ALTER COLUMN "kind" SET DATA TYPE "public"."logistics_vehicle_kind" USING "kind"::"public"."logistics_vehicle_kind";