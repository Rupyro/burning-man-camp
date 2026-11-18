CREATE TYPE "public"."obligation_document_status" AS ENUM('needed', 'done');--> statement-breakpoint
CREATE TABLE "obligation_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" "obligation_document_status" DEFAULT 'needed' NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_person_id" uuid,
	CONSTRAINT "obligation_documents_done_ck" CHECK (("obligation_documents"."status" = 'done') = ("obligation_documents"."done_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "obligation_documents" ADD CONSTRAINT "obligation_documents_task_id_obligation_details_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."obligation_details"("task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_documents" ADD CONSTRAINT "obligation_documents_done_by_person_id_people_id_fk" FOREIGN KEY ("done_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "obligation_documents_name_uq" ON "obligation_documents" USING btree ("task_id","name");--> statement-breakpoint
CREATE INDEX "obligation_documents_task_idx" ON "obligation_documents" USING btree ("task_id","position");--> statement-breakpoint
-- Data: one checklist row per old document name, in the same order (duplicates kept once).
INSERT INTO "obligation_documents" ("id", "task_id", "position", "name")
SELECT gen_random_uuid(), d."task_id", (min(x.ord) - 1)::smallint, left(btrim(x.name), 120)
FROM "obligation_details" d, unnest(d."required_documents") WITH ORDINALITY AS x(name, ord)
WHERE btrim(x.name) <> ''
GROUP BY d."task_id", left(btrim(x.name), 120);--> statement-breakpoint
ALTER TABLE "obligation_details" DROP COLUMN "required_documents";