ALTER TABLE "procurement_items" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
CREATE INDEX "procurement_items_import_batch_ix" ON "procurement_items" USING btree ("import_batch_id");