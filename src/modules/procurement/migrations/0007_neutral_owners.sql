ALTER TABLE "procurement_items" ALTER COLUMN "owner_label" SET DATA TYPE text;--> statement-breakpoint
UPDATE "procurement_items" SET "owner_label" = CASE "owner_label" WHEN 'oeaasies' THEN 'ours' WHEN 'khoena' THEN 'borrowed' WHEN 'shared' THEN 'borrowed' ELSE "owner_label" END;--> statement-breakpoint
ALTER TABLE "procurement_items" ALTER COLUMN "owner_label" SET DEFAULT 'ours'::text;--> statement-breakpoint
DROP TYPE "public"."procurement_owner_label";--> statement-breakpoint
CREATE TYPE "public"."procurement_owner_label" AS ENUM('ours', 'borrowed', 'rented');--> statement-breakpoint
ALTER TABLE "procurement_items" ALTER COLUMN "owner_label" SET DEFAULT 'ours'::"public"."procurement_owner_label";--> statement-breakpoint
ALTER TABLE "procurement_items" ALTER COLUMN "owner_label" SET DATA TYPE "public"."procurement_owner_label" USING "owner_label"::"public"."procurement_owner_label";