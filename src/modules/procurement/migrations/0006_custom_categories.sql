-- Plan PR 11: procurement_items.category goes from the 12-value enum to text, so camps can add
-- their own categories (checked in rules/csv.ts). Every existing value is kept as the same text.
ALTER TABLE "procurement_items" ALTER COLUMN "category" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "procurement_items" ALTER COLUMN "category" SET DATA TYPE varchar(40) USING "category"::text;--> statement-breakpoint
ALTER TABLE "procurement_items" ALTER COLUMN "category" SET DEFAULT 'other';--> statement-breakpoint
DROP TYPE "public"."procurement_item_category";
